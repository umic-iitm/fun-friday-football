let gameRenderer = null;
let gameActive = false;
let gameSocket = null;
let animFrameId = null;
let latestGameState = null;
let prevGameState = null;
let stateReceivedAt = 0;
let mySocketId = null;
const LERP_DURATION = 50; // ms to interpolate between states

// Input state
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false,
  pass: false,
  sprint: false,
};

// Key mappings
const KEY_MAP = {
  'ArrowUp': 'up', 'w': 'up', 'W': 'up',
  'ArrowDown': 'down', 's': 'down', 'S': 'down',
  'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
  'ArrowRight': 'right', 'd': 'right', 'D': 'right',
  ' ': 'kick',
  'p': 'pass', 'P': 'pass',
  'Shift': 'sprint',
};

function startGame(socket, data) {
  gameSocket = socket;
  mySocketId = socket.id;
  gameActive = true;

  const canvas = document.getElementById('gameCanvas');
  gameRenderer = new Renderer(canvas);

  // Listen for game state
  socket.on('gameState', (state) => {
    prevGameState = latestGameState;
    latestGameState = state;
    stateReceivedAt = performance.now();
  });

  // Start render loop with interpolation
  function renderLoop() {
    if (!gameActive) return;
    if (latestGameState) {
      const renderState = interpolateState(prevGameState, latestGameState);
      gameRenderer.render(renderState, mySocketId);
    }
    animFrameId = requestAnimationFrame(renderLoop);
  }
  renderLoop();

  // Input handlers
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
}

function stopGame() {
  gameActive = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  if (gameSocket) {
    gameSocket.off('gameState');
  }
  latestGameState = null;
  prevGameState = null;
}

function interpolateState(prev, latest) {
  if (!prev || !latest || prev.state !== 'playing' || latest.state !== 'playing') return latest;

  const elapsed = performance.now() - stateReceivedAt;
  const t = Math.min(elapsed / LERP_DURATION, 1);

  const lerp = (a, b) => a + (b - a) * t;

  const players = latest.players.map((lp) => {
    const pp = prev.players.find(p => p.id === lp.id);
    if (!pp) return lp;
    return {
      ...lp,
      x: lerp(pp.x, lp.x),
      y: lerp(pp.y, lp.y),
    };
  });

  return {
    ...latest,
    players,
    ball: {
      ...latest.ball,
      x: lerp(prev.ball.x, latest.ball.x),
      y: lerp(prev.ball.y, latest.ball.y),
      vx: latest.ball.vx,
      vy: latest.ball.vy,
    },
  };
}

let lastInputSent = '';

function onKeyDown(e) {
  const action = KEY_MAP[e.key];
  if (!action) return;
  e.preventDefault();

  if (action === 'kick' || action === 'pass') {
    // One-shot actions — send immediately
    keys[action] = true;
    sendInput();
    keys[action] = false;
  } else {
    keys[action] = true;
    sendInput();
  }
}

function onKeyUp(e) {
  const action = KEY_MAP[e.key];
  if (!action) return;
  e.preventDefault();

  if (action !== 'kick' && action !== 'pass') {
    keys[action] = false;
    sendInput();
  }
}

function sendInput() {
  if (!gameSocket || !gameActive) return;

  // Only send if input changed (or kick)
  const inputStr = JSON.stringify(keys);
  if (inputStr !== lastInputSent || keys.kick || keys.pass) {
    lastInputSent = inputStr;
    gameSocket.emit('playerInput', { ...keys });
  }
}
