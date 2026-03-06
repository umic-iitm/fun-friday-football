const { GAME, PITCH, PLAYER, BALL, TEAMS, FORMATIONS_9 } = require('./constants');
const { distance, normalize, clamp, magnitude, resolveCircleCollision } = require('./utils');

class GameEngine {
  constructor(roomCode, matchDuration) {
    this.roomCode = roomCode;
    this.players = new Map(); // socketId -> player state
    this.ball = this.createBall();
    this.score = { A: 0, B: 0 };
    this.state = 'waiting'; // waiting | countdown | playing | goalScored | halftime | finished
    this.matchDuration = matchDuration || GAME.MATCH_DURATION;
    this.matchTimer = this.matchDuration;
    this.halfTimeDone = false;
    this.halfTimeTimer = 0;
    this.countdownTimer = 0;
    this.goalScoredTimer = 0;
    this.lastGoalTeam = null;
    this.loopInterval = null;
    this.lastTick = Date.now();
  }

  createBall() {
    return {
      x: PITCH.WIDTH / 2,
      y: PITCH.HEIGHT / 2,
      vx: 0,
      vy: 0,
      radius: BALL.RADIUS,
    };
  }

  addPlayer(socketId, name, team, isGK = false) {
    const teamPlayers = this.getTeamPlayers(team);
    // GK always gets position index 0 (goalkeeper slot)
    const posIndex = isGK ? 0 : teamPlayers.filter(p => !p.isGK).length + 1;
    const pos = this.getFormationPosition(team, isGK ? 0 : posIndex);

    this.players.set(socketId, {
      id: socketId,
      name: name,
      team: team,
      isGK: isGK,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      radius: PLAYER.RADIUS,
      stamina: PLAYER.STAMINA_MAX,
      input: { up: false, down: false, left: false, right: false, kick: false, pass: false, sprint: false },
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getTeamPlayers(team) {
    return [...this.players.values()].filter(p => p.team === team);
  }

  getFormationPosition(team, index) {
    const formation = FORMATIONS_9[index % FORMATIONS_9.length];
    const pitchLeft = PITCH.PADDING;
    const pitchTop = PITCH.PADDING;
    const pitchW = PITCH.WIDTH - PITCH.PADDING * 2;
    const pitchH = PITCH.HEIGHT - PITCH.PADDING * 2;

    if (team === TEAMS.A) {
      return {
        x: pitchLeft + formation.x * (pitchW / 2),
        y: pitchTop + formation.y * pitchH,
      };
    } else {
      return {
        x: pitchLeft + pitchW - formation.x * (pitchW / 2),
        y: pitchTop + formation.y * pitchH,
      };
    }
  }

  setPlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (player) {
      player.input = input;
    }
  }

  startCountdown() {
    this.state = 'countdown';
    this.countdownTimer = GAME.COUNTDOWN_DURATION;
    this.resetPositions();
  }

  startMatch() {
    this.state = 'countdown';
    this.countdownTimer = GAME.COUNTDOWN_DURATION;
    this.score = { A: 0, B: 0 };
    this.matchTimer = this.matchDuration;
    this.halfTimeDone = false;
    this.resetPositions();
    this.startLoop();
  }

  startLoop() {
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.lastTick = Date.now();
    this.loopInterval = setInterval(() => this.tick(), 1000 / GAME.TICK_RATE);
  }

  stopLoop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  resetPositions() {
    this.ball.x = PITCH.WIDTH / 2;
    this.ball.y = PITCH.HEIGHT / 2;
    this.ball.vx = 0;
    this.ball.vy = 0;

    // Reset each team: GK first at index 0, then outfield players
    [TEAMS.A, TEAMS.B].forEach(team => {
      const teamPlayers = this.getTeamPlayers(team);
      const gk = teamPlayers.find(p => p.isGK);
      const outfield = teamPlayers.filter(p => !p.isGK);

      if (gk) {
        const pos = this.getFormationPosition(team, 0);
        gk.x = pos.x; gk.y = pos.y;
        gk.vx = 0; gk.vy = 0; gk.stamina = PLAYER.STAMINA_MAX;
      }
      outfield.forEach((p, i) => {
        const pos = this.getFormationPosition(team, i + 1);
        p.x = pos.x; p.y = pos.y;
        p.vx = 0; p.vy = 0; p.stamina = PLAYER.STAMINA_MAX;
      });
    });
  }

  tick() {
    const now = Date.now();
    const dt = (now - this.lastTick) / (1000 / GAME.TICK_RATE);
    this.lastTick = now;

    if (this.state === 'countdown') {
      this.countdownTimer -= 1 / GAME.TICK_RATE;
      if (this.countdownTimer <= 0) {
        this.state = 'playing';
      }
      return;
    }

    if (this.state === 'goalScored') {
      this.goalScoredTimer -= 1 / GAME.TICK_RATE;
      if (this.goalScoredTimer <= 0) {
        this.startCountdown();
      }
      return;
    }

    if (this.state === 'halftime') {
      this.halfTimeTimer -= 1 / GAME.TICK_RATE;
      if (this.halfTimeTimer <= 0) {
        this.halfTimeDone = true;
        this.startCountdown();
      }
      return;
    }

    if (this.state !== 'playing') return;

    // Update match timer
    this.matchTimer -= 1 / GAME.TICK_RATE;
    if (this.matchTimer <= 0) {
      this.matchTimer = 0;
      this.state = 'finished';
      this.stopLoop();
      return;
    }

    // Check for half-time
    if (!this.halfTimeDone && this.matchTimer <= this.matchDuration / 2) {
      this.state = 'halftime';
      this.halfTimeTimer = GAME.HALFTIME_DURATION;
      this.resetPositions();
      return;
    }

    // Update players
    for (const player of this.players.values()) {
      this.updatePlayer(player, dt);
    }

    // Update ball
    this.updateBall(dt);

    // Player-ball collisions
    for (const player of this.players.values()) {
      this.handlePlayerBallCollision(player);
    }

    // Player-player collisions
    const playerArr = [...this.players.values()];
    for (let i = 0; i < playerArr.length; i++) {
      for (let j = i + 1; j < playerArr.length; j++) {
        resolveCircleCollision(
          playerArr[i], playerArr[j],
          PLAYER.RADIUS, PLAYER.RADIUS,
          PLAYER.MASS, PLAYER.MASS,
          PLAYER.BOUNCE
        );
      }
    }

    // Check goals
    this.checkGoals();

    // Clamp positions
    this.clampPositions();
  }

  updatePlayer(player, dt) {
    const { input } = player;
    let ax = 0, ay = 0;

    if (input.up) ay -= 1;
    if (input.down) ay += 1;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;

    // Normalize diagonal movement
    const inputMag = magnitude(ax, ay);
    if (inputMag > 0) {
      ax /= inputMag;
      ay /= inputMag;
    }

    // Sprint
    const isSprinting = input.sprint && player.stamina > PLAYER.STAMINA_MIN_TO_SPRINT && inputMag > 0;
    const maxSpeed = isSprinting ? PLAYER.SPRINT_SPEED : PLAYER.MAX_SPEED;

    if (isSprinting) {
      player.stamina = Math.max(0, player.stamina - PLAYER.STAMINA_DRAIN);
    } else {
      player.stamina = Math.min(PLAYER.STAMINA_MAX, player.stamina + PLAYER.STAMINA_REGEN);
    }

    // Apply acceleration
    if (inputMag > 0) {
      player.vx += ax * PLAYER.ACCELERATION * dt;
      player.vy += ay * PLAYER.ACCELERATION * dt;
    } else {
      // Decelerate
      player.vx *= PLAYER.DECELERATION;
      player.vy *= PLAYER.DECELERATION;
    }

    // Clamp speed
    const speed = magnitude(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }

    // Very small velocities -> stop
    if (Math.abs(player.vx) < 0.01) player.vx = 0;
    if (Math.abs(player.vy) < 0.01) player.vy = 0;

    // Update position
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Handle kick
    if (input.kick) {
      this.handleKick(player);
      input.kick = false; // one-shot
    }

    // Handle pass
    if (input.pass) {
      this.handlePass(player);
      input.pass = false; // one-shot
    }
  }

  handleKick(player) {
    const dist = distance(player, this.ball);
    if (dist > PLAYER.RADIUS + BALL.RADIUS + PLAYER.KICK_RANGE) return;

    const dir = normalize(this.ball.x - player.x, this.ball.y - player.y);
    // Kick power scales with proximity
    const proximityFactor = 1 - (dist / (PLAYER.RADIUS + BALL.RADIUS + PLAYER.KICK_RANGE));
    const power = PLAYER.KICK_POWER * (0.5 + 0.5 * proximityFactor);

    this.ball.vx = dir.x * power;
    this.ball.vy = dir.y * power;
  }

  handlePass(player) {
    // Must be near the ball to pass
    const distToBall = distance(player, this.ball);
    if (distToBall > PLAYER.RADIUS + BALL.RADIUS + PLAYER.KICK_RANGE) return;

    // Find nearest teammate (excluding self)
    let nearestTeammate = null;
    let nearestDist = Infinity;
    for (const p of this.players.values()) {
      if (p.id === player.id || p.team !== player.team) continue;
      const d = distance(player, p);
      if (d < nearestDist) {
        nearestDist = d;
        nearestTeammate = p;
      }
    }

    if (!nearestTeammate) return;

    // Direct the ball toward the nearest teammate
    const dir = normalize(nearestTeammate.x - this.ball.x, nearestTeammate.y - this.ball.y);
    // Pass power scales with distance — stronger for farther teammates, capped
    const power = Math.min(PLAYER.KICK_POWER * 0.85, 4 + nearestDist * 0.02);

    this.ball.vx = dir.x * power;
    this.ball.vy = dir.y * power;
  }

  updateBall(dt) {
    this.ball.vx *= BALL.FRICTION;
    this.ball.vy *= BALL.FRICTION;

    // Cap speed
    const speed = magnitude(this.ball.vx, this.ball.vy);
    if (speed > BALL.MAX_SPEED) {
      this.ball.vx = (this.ball.vx / speed) * BALL.MAX_SPEED;
      this.ball.vy = (this.ball.vy / speed) * BALL.MAX_SPEED;
    }

    // Very small velocities -> stop
    if (Math.abs(this.ball.vx) < 0.05) this.ball.vx = 0;
    if (Math.abs(this.ball.vy) < 0.05) this.ball.vy = 0;

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Wall bouncing (top and bottom)
    const pitchTop = PITCH.PADDING + BALL.RADIUS;
    const pitchBottom = PITCH.HEIGHT - PITCH.PADDING - BALL.RADIUS;

    if (this.ball.y < pitchTop) {
      this.ball.y = pitchTop;
      this.ball.vy = Math.abs(this.ball.vy) * BALL.BOUNCE_WALL;
    }
    if (this.ball.y > pitchBottom) {
      this.ball.y = pitchBottom;
      this.ball.vy = -Math.abs(this.ball.vy) * BALL.BOUNCE_WALL;
    }

    // Left/right walls (but not in goal area)
    const pitchLeft = PITCH.PADDING + BALL.RADIUS;
    const pitchRight = PITCH.WIDTH - PITCH.PADDING - BALL.RADIUS;
    const goalTop = PITCH.HEIGHT / 2 - PITCH.GOAL_HEIGHT / 2;
    const goalBottom = PITCH.HEIGHT / 2 + PITCH.GOAL_HEIGHT / 2;

    if (this.ball.x < pitchLeft && !(this.ball.y > goalTop && this.ball.y < goalBottom)) {
      this.ball.x = pitchLeft;
      this.ball.vx = Math.abs(this.ball.vx) * BALL.BOUNCE_WALL;
    }
    if (this.ball.x > pitchRight && !(this.ball.y > goalTop && this.ball.y < goalBottom)) {
      this.ball.x = pitchRight;
      this.ball.vx = -Math.abs(this.ball.vx) * BALL.BOUNCE_WALL;
    }

    // Goal post bouncing (top and bottom of goal opening)
    if (this.ball.x <= pitchLeft + BALL.RADIUS || this.ball.x >= pitchRight - BALL.RADIUS) {
      if (Math.abs(this.ball.y - goalTop) < BALL.RADIUS + 3) {
        this.ball.vy = Math.abs(this.ball.vy) * BALL.BOUNCE_WALL;
        this.ball.y = goalTop + BALL.RADIUS + 3;
      }
      if (Math.abs(this.ball.y - goalBottom) < BALL.RADIUS + 3) {
        this.ball.vy = -Math.abs(this.ball.vy) * BALL.BOUNCE_WALL;
        this.ball.y = goalBottom - BALL.RADIUS - 3;
      }
    }
  }

  handlePlayerBallCollision(player) {
    const dist = distance(player, this.ball);
    const minDist = PLAYER.RADIUS + BALL.RADIUS;

    if (dist >= minDist || dist === 0) return;

    // Auto-dribble: if player is moving slowly toward ball
    const playerSpeed = magnitude(player.vx, player.vy);
    if (playerSpeed < BALL.DRIBBLE_SPEED && playerSpeed > 0.1) {
      const dir = normalize(player.vx, player.vy);
      this.ball.vx = dir.x * playerSpeed * 1.1;
      this.ball.vy = dir.y * playerSpeed * 1.1;

      // Push ball ahead of player
      const pushDir = normalize(this.ball.x - player.x, this.ball.y - player.y);
      this.ball.x = player.x + pushDir.x * (minDist + 2);
      this.ball.y = player.y + pushDir.y * (minDist + 2);
      return;
    }

    // Normal collision
    resolveCircleCollision(
      player, this.ball,
      PLAYER.RADIUS, BALL.RADIUS,
      PLAYER.MASS, BALL.MASS,
      BALL.BOUNCE_PLAYER
    );
  }

  checkGoals() {
    const goalTop = PITCH.HEIGHT / 2 - PITCH.GOAL_HEIGHT / 2;
    const goalBottom = PITCH.HEIGHT / 2 + PITCH.GOAL_HEIGHT / 2;

    // Ball in left goal (Team B scores)
    if (this.ball.x < PITCH.PADDING - PITCH.GOAL_WIDTH &&
        this.ball.y > goalTop && this.ball.y < goalBottom) {
      this.score.B++;
      this.onGoalScored(TEAMS.B);
      return;
    }

    // Ball in right goal (Team A scores)
    if (this.ball.x > PITCH.WIDTH - PITCH.PADDING + PITCH.GOAL_WIDTH &&
        this.ball.y > goalTop && this.ball.y < goalBottom) {
      this.score.A++;
      this.onGoalScored(TEAMS.A);
      return;
    }
  }

  onGoalScored(team) {
    this.state = 'goalScored';
    this.lastGoalTeam = team;
    this.goalScoredTimer = 2; // 2 seconds celebration
  }

  clampPositions() {
    const pitchLeft = PITCH.PADDING + PLAYER.RADIUS;
    const pitchRight = PITCH.WIDTH - PITCH.PADDING - PLAYER.RADIUS;
    const pitchTop = PITCH.PADDING + PLAYER.RADIUS;
    const pitchBottom = PITCH.HEIGHT - PITCH.PADDING - PLAYER.RADIUS;
    const halfLine = PITCH.WIDTH / 2;

    for (const player of this.players.values()) {
      if (player.isGK) {
        // GK restricted to their own half
        if (player.team === TEAMS.A) {
          player.x = clamp(player.x, pitchLeft, halfLine - PLAYER.RADIUS);
        } else {
          player.x = clamp(player.x, halfLine + PLAYER.RADIUS, pitchRight);
        }
      } else {
        player.x = clamp(player.x, pitchLeft, pitchRight);
      }
      player.y = clamp(player.y, pitchTop, pitchBottom);
    }
  }

  getState() {
    const r1 = (v) => Math.round(v * 10) / 10;

    const players = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        team: p.team,
        isGK: p.isGK,
        x: r1(p.x),
        y: r1(p.y),
        vx: r1(p.vx),
        vy: r1(p.vy),
        stamina: Math.round(p.stamina),
      });
    }

    return {
      players,
      ball: {
        x: r1(this.ball.x),
        y: r1(this.ball.y),
        vx: r1(this.ball.vx),
        vy: r1(this.ball.vy),
      },
      score: this.score,
      state: this.state,
      matchTimer: r1(this.matchTimer),
      countdownTimer: Math.ceil(this.countdownTimer),
      halfTimeTimer: Math.ceil(this.halfTimeTimer),
      lastGoalTeam: this.lastGoalTeam,
    };
  }

  destroy() {
    this.stopLoop();
    this.players.clear();
  }
}

module.exports = GameEngine;
