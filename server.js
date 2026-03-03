const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameEngine = require('./game/GameEngine');
const { GAME, TEAMS, TEAM_COLORS } = require('./game/constants');
const { generateRoomCode } = require('./game/utils');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.static(path.join(__dirname, 'public')));

// Room storage
const rooms = new Map(); // roomCode -> room data

function createRoom(hostId, hostName) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const room = {
    code,
    hostId,
    players: new Map(), // socketId -> { name, team, ready }
    engine: null,
    state: 'lobby', // lobby | playing | finished
  };

  room.players.set(hostId, { name: hostName, team: TEAMS.A });
  rooms.set(code, room);
  return room;
}

function getRoomForSocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

function getPlayerList(room) {
  const list = [];
  for (const [id, p] of room.players) {
    list.push({ id, name: p.name, team: p.team, isHost: id === room.hostId });
  }
  return list;
}

function teamCount(room, team) {
  let count = 0;
  for (const p of room.players.values()) {
    if (p.team === team) count++;
  }
  return count;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new room
  socket.on('createRoom', (name, callback) => {
    if (!name || name.trim().length === 0) {
      return callback({ error: 'Name is required' });
    }
    const room = createRoom(socket.id, name.trim().substring(0, 15));
    socket.join(room.code);
    console.log(`Room ${room.code} created by ${name}`);
    callback({ roomCode: room.code, players: getPlayerList(room) });
  });

  // Join an existing room
  socket.on('joinRoom', (data, callback) => {
    const { name, roomCode } = data;
    if (!name || name.trim().length === 0) {
      return callback({ error: 'Name is required' });
    }
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) return callback({ error: 'Room not found' });
    if (room.state !== 'lobby') return callback({ error: 'Game already in progress' });
    if (room.players.size >= GAME.MAX_PLAYERS_PER_TEAM * 2) {
      return callback({ error: 'Room is full' });
    }

    // Auto-assign to team with fewer players
    const teamACount = teamCount(room, TEAMS.A);
    const teamBCount = teamCount(room, TEAMS.B);
    const team = teamACount <= teamBCount ? TEAMS.A : TEAMS.B;

    room.players.set(socket.id, { name: name.trim().substring(0, 15), team });
    socket.join(code);

    console.log(`${name} joined room ${code} on Team ${team}`);
    callback({ roomCode: code, players: getPlayerList(room), yourTeam: team });

    // Notify others
    socket.to(code).emit('playerJoined', { players: getPlayerList(room) });
  });

  // Switch team
  socket.on('switchTeam', (callback) => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.state !== 'lobby') return;

    const player = room.players.get(socket.id);
    const newTeam = player.team === TEAMS.A ? TEAMS.B : TEAMS.A;

    if (teamCount(room, newTeam) >= GAME.MAX_PLAYERS_PER_TEAM) {
      return callback({ error: 'Team is full' });
    }

    player.team = newTeam;
    callback({ team: newTeam });
    io.to(room.code).emit('playerJoined', { players: getPlayerList(room) });
  });

  // Start game (host only)
  socket.on('startGame', () => {
    const room = getRoomForSocket(socket.id);
    if (!room || room.state !== 'lobby') return;
    if (socket.id !== room.hostId) return;

    const teamACount = teamCount(room, TEAMS.A);
    const teamBCount = teamCount(room, TEAMS.B);
    if (teamACount === 0 || teamBCount === 0) {
      socket.emit('gameError', 'Both teams need at least one player');
      return;
    }

    // Create game engine
    room.engine = new GameEngine(room.code);
    room.state = 'playing';

    // Add all players to engine
    for (const [id, p] of room.players) {
      room.engine.addPlayer(id, p.name, p.team);
    }

    // Start the match
    room.engine.startMatch();

    // Broadcast game started
    io.to(room.code).emit('gameStarted', {
      players: getPlayerList(room),
    });

    // Game state broadcast loop
    room.broadcastInterval = setInterval(() => {
      if (!room.engine) return;

      const state = room.engine.getState();
      io.to(room.code).emit('gameState', state);

      if (state.state === 'finished') {
        clearInterval(room.broadcastInterval);
        room.state = 'finished';
        io.to(room.code).emit('gameFinished', {
          score: state.score,
          players: getPlayerList(room),
        });
      }
    }, 1000 / GAME.TICK_RATE);

    console.log(`Game started in room ${room.code}`);
  });

  // Player input
  socket.on('playerInput', (input) => {
    const room = getRoomForSocket(socket.id);
    if (!room || !room.engine) return;
    room.engine.setPlayerInput(socket.id, input);
  });

  // Play again (host only)
  socket.on('playAgain', () => {
    const room = getRoomForSocket(socket.id);
    if (!room) return;
    if (socket.id !== room.hostId) return;

    // Clean up old engine
    if (room.engine) {
      room.engine.destroy();
      room.engine = null;
    }
    if (room.broadcastInterval) {
      clearInterval(room.broadcastInterval);
    }

    room.state = 'lobby';
    io.to(room.code).emit('backToLobby', { players: getPlayerList(room) });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = getRoomForSocket(socket.id);
    if (!room) return;

    room.players.delete(socket.id);

    if (room.engine) {
      room.engine.removePlayer(socket.id);
    }

    // If room is empty, clean up
    if (room.players.size === 0) {
      if (room.engine) room.engine.destroy();
      if (room.broadcastInterval) clearInterval(room.broadcastInterval);
      rooms.delete(room.code);
      console.log(`Room ${room.code} destroyed (empty)`);
      return;
    }

    // If host left, assign new host
    if (socket.id === room.hostId) {
      room.hostId = room.players.keys().next().value;
      console.log(`New host in ${room.code}: ${room.hostId}`);
    }

    io.to(room.code).emit('playerLeft', {
      playerId: socket.id,
      players: getPlayerList(room),
      newHostId: room.hostId,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ⚽  Fun Friday Football  ⚽');
  console.log('  ─────────────────────────');
  console.log(`  Server running on port ${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log('');
  console.log('  Share this URL with your team!');
  console.log('');
});
