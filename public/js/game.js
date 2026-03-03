let gameRenderer = null;
let gameActive = false;
let gameSocket = null;
let animFrameId = null;
let latestGameState = null;
let mySocketId = null;

// Input state
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  kick: false,
  sprint: false,
};

// Key mappings
const KEY_MAP = {
  'ArrowUp': 'up', 'w': 'up', 'W': 'up',
  'ArrowDown': 'down', 's': 'down', 'S': 'down',
  'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
  'ArrowRight': 'right', 'd': 'right', 'D': 'right',
  ' ': 'kick',
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
    latestGameState = state;
  });

  // Start render loop
  function renderLoop() {
    if (!gameActive) return;
    if (latestGameState) {
      gameRenderer.render(latestGameState, mySocketId);
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
}

let lastInputSent = '';

function onKeyDown(e) {
  const action = KEY_MAP[e.key];
  if (!action) return;
  e.preventDefault();

  if (action === 'kick') {
    // Kick is a one-shot — send immediately
    keys.kick = true;
    sendInput();
    keys.kick = false;
  } else {
    keys[action] = true;
    sendInput();
  }
}

function onKeyUp(e) {
  const action = KEY_MAP[e.key];
  if (!action) return;
  e.preventDefault();

  if (action !== 'kick') {
    keys[action] = false;
    sendInput();
  }
}

function sendInput() {
  if (!gameSocket || !gameActive) return;

  // Only send if input changed (or kick)
  const inputStr = JSON.stringify(keys);
  if (inputStr !== lastInputSent || keys.kick) {
    lastInputSent = inputStr;
    gameSocket.emit('playerInput', { ...keys });
  }
}
