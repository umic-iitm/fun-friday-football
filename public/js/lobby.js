const socket = io();

// Screens
const landingScreen = document.getElementById('landing');
const lobbyScreen = document.getElementById('lobby');
const gameScreen = document.getElementById('gameScreen');
const resultsScreen = document.getElementById('results');

// Landing elements
const playerNameInput = document.getElementById('playerName');
const btnCreate = document.getElementById('btnCreate');
const btnJoinShow = document.getElementById('btnJoinShow');
const joinSection = document.getElementById('joinSection');
const roomCodeInput = document.getElementById('roomCodeInput');
const btnJoin = document.getElementById('btnJoin');
const landingError = document.getElementById('landingError');

// Lobby elements
const roomCodeDisplay = document.getElementById('roomCode');
const teamAList = document.getElementById('teamAList');
const teamBList = document.getElementById('teamBList');
const btnSwitchTeam = document.getElementById('btnSwitchTeam');
const btnStart = document.getElementById('btnStart');
const lobbyError = document.getElementById('lobbyError');

// Results elements
const resultTitle = document.getElementById('resultTitle');
const resultScoreA = document.getElementById('resultScoreA');
const resultScoreB = document.getElementById('resultScoreB');
const btnPlayAgain = document.getElementById('btnPlayAgain');
const waitHost = document.getElementById('waitHost');

let currentRoom = null;
let isHost = false;

function showScreen(screen) {
  [landingScreen, lobbyScreen, gameScreen, resultsScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function updatePlayerList(players) {
  teamAList.innerHTML = '';
  teamBList.innerHTML = '';

  players.forEach(p => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    li.appendChild(nameSpan);

    const badgeContainer = document.createElement('span');
    badgeContainer.style.display = 'flex';
    badgeContainer.style.gap = '4px';
    badgeContainer.style.alignItems = 'center';

    // GK badge or GK button (host only)
    if (p.isGK) {
      const badge = document.createElement('span');
      badge.className = 'gk-badge';
      badge.textContent = 'GK';
      badgeContainer.appendChild(badge);
    }

    // Host can toggle GK for any player
    if (isHost) {
      const gkBtn = document.createElement('button');
      gkBtn.className = 'gk-btn' + (p.isGK ? ' gk-active' : '');
      gkBtn.textContent = p.isGK ? 'Remove GK' : 'Set GK';
      gkBtn.addEventListener('click', () => {
        socket.emit('setGoalkeeper', { playerId: p.id, team: p.team }, (response) => {
          if (response.error) showError(lobbyError, response.error);
        });
      });
      badgeContainer.appendChild(gkBtn);
    }

    if (p.isHost) {
      const badge = document.createElement('span');
      badge.className = 'host-badge';
      badge.textContent = 'HOST';
      badgeContainer.appendChild(badge);
    }
    if (p.id === socket.id) {
      const badge = document.createElement('span');
      badge.className = 'you-badge';
      badge.textContent = 'YOU';
      badgeContainer.appendChild(badge);
    }
    li.appendChild(badgeContainer);

    if (p.team === 'A') {
      teamAList.appendChild(li);
    } else {
      teamBList.appendChild(li);
    }
  });

  // Update host status
  const me = players.find(p => p.id === socket.id);
  if (me) {
    isHost = me.isHost;
    btnStart.classList.toggle('hidden', !isHost);
  }
}

// Landing - Create Room
btnCreate.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) return showError(landingError, 'Please enter your name');

  socket.emit('createRoom', name, (response) => {
    if (response.error) return showError(landingError, response.error);
    currentRoom = response.roomCode;
    isHost = true;
    roomCodeDisplay.textContent = response.roomCode;
    updatePlayerList(response.players);
    showScreen(lobbyScreen);
  });
});

// Landing - Show Join
btnJoinShow.addEventListener('click', () => {
  joinSection.classList.toggle('hidden');
  roomCodeInput.focus();
});

// Landing - Join Room
btnJoin.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) return showError(landingError, 'Please enter your name');
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) return showError(landingError, 'Please enter a room code');

  socket.emit('joinRoom', { name, roomCode }, (response) => {
    if (response.error) return showError(landingError, response.error);
    currentRoom = response.roomCode;
    roomCodeDisplay.textContent = response.roomCode;
    updatePlayerList(response.players);
    showScreen(lobbyScreen);
  });
});

// Enter key support
playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnCreate.click();
});
roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnJoin.click();
});

// Lobby - Switch Team
btnSwitchTeam.addEventListener('click', () => {
  socket.emit('switchTeam', (response) => {
    if (response.error) showError(lobbyError, response.error);
  });
});

// Lobby - Start Game
btnStart.addEventListener('click', () => {
  socket.emit('startGame');
});

// Socket events
socket.on('playerJoined', (data) => {
  updatePlayerList(data.players);
});

socket.on('playerLeft', (data) => {
  updatePlayerList(data.players);
});

socket.on('gameError', (msg) => {
  showError(lobbyError, msg);
});

socket.on('gameStarted', (data) => {
  showScreen(gameScreen);
  startGame(socket, data);
});

socket.on('gameFinished', (data) => {
  stopGame();
  resultScoreA.textContent = data.score.A;
  resultScoreB.textContent = data.score.B;

  if (data.score.A > data.score.B) {
    resultTitle.textContent = 'Red Team Wins!';
    resultTitle.style.color = '#e53e3e';
  } else if (data.score.B > data.score.A) {
    resultTitle.textContent = 'Blue Team Wins!';
    resultTitle.style.color = '#3182ce';
  } else {
    resultTitle.textContent = "It's a Draw!";
    resultTitle.style.color = '#ffd700';
  }

  // Show play again button only for host
  const me = data.players.find(p => p.id === socket.id);
  isHost = me && me.isHost;
  btnPlayAgain.classList.toggle('hidden', !isHost);
  waitHost.classList.toggle('hidden', isHost);

  showScreen(resultsScreen);
});

socket.on('backToLobby', (data) => {
  stopGame();
  updatePlayerList(data.players);
  showScreen(lobbyScreen);
});

btnPlayAgain.addEventListener('click', () => {
  socket.emit('playAgain');
});
