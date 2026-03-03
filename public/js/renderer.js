// Pitch and game constants (must match server)
const PITCH = {
  WIDTH: 1200,
  HEIGHT: 700,
  PADDING: 40,
  LINE_WIDTH: 2,
  CENTER_CIRCLE_RADIUS: 70,
  GOAL_WIDTH: 10,
  GOAL_HEIGHT: 140,
  PENALTY_AREA_WIDTH: 130,
  PENALTY_AREA_HEIGHT: 320,
  GOAL_AREA_WIDTH: 55,
  GOAL_AREA_HEIGHT: 170,
};

const PLAYER_RADIUS = 16;
const BALL_RADIUS = 8;

const TEAM_COLORS = {
  A: { fill: '#e53e3e', stroke: '#c53030', light: '#feb2b2', name: 'Red' },
  B: { fill: '#3182ce', stroke: '#2b6cb0', light: '#90cdf4', name: 'Blue' },
};

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const aspectRatio = PITCH.WIDTH / PITCH.HEIGHT;
    let w = window.innerWidth;
    let h = window.innerHeight;

    if (w / h > aspectRatio) {
      w = h * aspectRatio;
    } else {
      h = w / aspectRatio;
    }

    this.canvas.width = PITCH.WIDTH;
    this.canvas.height = PITCH.HEIGHT;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = (window.innerWidth - w) / 2 + 'px';
    this.canvas.style.top = (window.innerHeight - h) / 2 + 'px';
  }

  render(gameState, myId) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    this.drawPitch(ctx);
    this.drawPlayers(ctx, gameState.players, myId);
    this.drawBall(ctx, gameState.ball);
    this.drawHUD(ctx, gameState);

    if (gameState.state === 'countdown') {
      this.drawCountdown(ctx, gameState.countdownTimer);
    }

    if (gameState.state === 'goalScored') {
      this.drawGoalCelebration(ctx, gameState.lastGoalTeam);
    }
  }

  drawPitch(ctx) {
    const p = PITCH.PADDING;
    const w = PITCH.WIDTH - p * 2;
    const h = PITCH.HEIGHT - p * 2;
    const cx = PITCH.WIDTH / 2;
    const cy = PITCH.HEIGHT / 2;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, PITCH.HEIGHT);
    bgGrad.addColorStop(0, '#1a472a');
    bgGrad.addColorStop(1, '#0d2818');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    // Pitch grass with stripes
    for (let i = 0; i < 12; i++) {
      const stripeW = w / 12;
      ctx.fillStyle = i % 2 === 0 ? '#2d8a4e' : '#34a058';
      ctx.fillRect(p + i * stripeW, p, stripeW, h);
    }

    // Outer boundary
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = PITCH.LINE_WIDTH;
    ctx.strokeRect(p, p, w, h);

    // Center line
    ctx.beginPath();
    ctx.moveTo(cx, p);
    ctx.lineTo(cx, p + h);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, PITCH.CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    // Penalty areas
    const paW = PITCH.PENALTY_AREA_WIDTH;
    const paH = PITCH.PENALTY_AREA_HEIGHT;
    // Left
    ctx.strokeRect(p, cy - paH / 2, paW, paH);
    // Right
    ctx.strokeRect(p + w - paW, cy - paH / 2, paW, paH);

    // Goal areas
    const gaW = PITCH.GOAL_AREA_WIDTH;
    const gaH = PITCH.GOAL_AREA_HEIGHT;
    // Left
    ctx.strokeRect(p, cy - gaH / 2, gaW, gaH);
    // Right
    ctx.strokeRect(p + w - gaW, cy - gaH / 2, gaW, gaH);

    // Penalty spots
    ctx.beginPath();
    ctx.arc(p + paW - 20, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p + w - paW + 20, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Corner arcs
    const cornerR = 15;
    ctx.beginPath(); ctx.arc(p, p, cornerR, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(p + w, p, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(p, p + h, cornerR, -Math.PI / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(p + w, p + h, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke();

    // Goals
    const goalH = PITCH.GOAL_HEIGHT;
    const goalW = PITCH.GOAL_WIDTH;

    // Left goal (net effect)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(p - goalW, cy - goalH / 2, goalW, goalH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p, cy - goalH / 2);
    ctx.lineTo(p - goalW, cy - goalH / 2);
    ctx.lineTo(p - goalW, cy + goalH / 2);
    ctx.lineTo(p, cy + goalH / 2);
    ctx.stroke();

    // Right goal
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(p + w, cy - goalH / 2, goalW, goalH);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(p + w, cy - goalH / 2);
    ctx.lineTo(p + w + goalW, cy - goalH / 2);
    ctx.lineTo(p + w + goalW, cy + goalH / 2);
    ctx.lineTo(p + w, cy + goalH / 2);
    ctx.stroke();

    ctx.lineWidth = PITCH.LINE_WIDTH;
  }

  drawPlayers(ctx, players, myId) {
    players.forEach(player => {
      const colors = TEAM_COLORS[player.team];
      const isMe = player.id === myId;

      // Highlight ring for own player
      if (isMe) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_RADIUS + 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Shadow
      ctx.beginPath();
      ctx.ellipse(player.x + 2, player.y + PLAYER_RADIUS - 2, PLAYER_RADIUS * 0.8, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();

      // Player circle
      const grad = ctx.createRadialGradient(
        player.x - 4, player.y - 4, 2,
        player.x, player.y, PLAYER_RADIUS
      );
      grad.addColorStop(0, colors.light || colors.fill);
      grad.addColorStop(1, colors.fill);

      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Name label
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(player.name, player.x, player.y - PLAYER_RADIUS - 7);
      ctx.fillText(player.name, player.x, player.y - PLAYER_RADIUS - 7);

      // Stamina bar (only for own player)
      if (isMe && player.stamina < 100) {
        const barW = 30;
        const barH = 4;
        const barX = player.x - barW / 2;
        const barY = player.y + PLAYER_RADIUS + 6;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        const staminaPct = player.stamina / 100;
        const staminaColor = staminaPct > 0.3 ? '#48bb78' : '#fc8181';
        ctx.fillStyle = staminaColor;
        ctx.fillRect(barX, barY, barW * staminaPct, barH);
      }
    });
  }

  drawBall(ctx, ball) {
    // Shadow
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + BALL_RADIUS + 2, BALL_RADIUS * 0.9, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // Ball
    const ballGrad = ctx.createRadialGradient(
      ball.x - 2, ball.y - 2, 1,
      ball.x, ball.y, BALL_RADIUS
    );
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#cccccc');

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ball pattern (pentagon shapes)
    ctx.fillStyle = '#555';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = ball.x + Math.cos(angle) * BALL_RADIUS * 0.5;
      const py = ball.y + Math.sin(angle) * BALL_RADIUS * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHUD(ctx, state) {
    // Scoreboard background
    const hudW = 280;
    const hudH = 40;
    const hudX = PITCH.WIDTH / 2 - hudW / 2;
    const hudY = 3;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 8);
    ctx.fill();

    // Team A score
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = TEAM_COLORS.A.fill;
    ctx.fillText('RED', hudX + 45, hudY + 27);

    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(state.score.A, hudX + 100, hudY + 28);

    // Dash
    ctx.fillStyle = '#888';
    ctx.fillText('-', hudX + hudW / 2, hudY + 28);

    // Team B score
    ctx.fillText(state.score.B, hudX + hudW - 100, hudY + 28);

    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillStyle = TEAM_COLORS.B.fill;
    ctx.fillText('BLU', hudX + hudW - 45, hudY + 27);

    // Timer
    const minutes = Math.floor(state.matchTimer / 60);
    const seconds = Math.floor(state.matchTimer % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(PITCH.WIDTH / 2 - 30, hudY + hudH + 3, 60, 22, 6);
    ctx.fill();

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = state.matchTimer < 30 ? '#fc8181' : '#fff';
    ctx.fillText(timeStr, PITCH.WIDTH / 2, hudY + hudH + 18);
  }

  drawCountdown(ctx, timer) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    const num = Math.ceil(timer);
    ctx.font = 'bold 120px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;

    const text = num > 0 ? num.toString() : 'GO!';
    ctx.strokeText(text, PITCH.WIDTH / 2, PITCH.HEIGHT / 2 + 40);
    ctx.fillText(text, PITCH.WIDTH / 2, PITCH.HEIGHT / 2 + 40);
  }

  drawGoalCelebration(ctx, team) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    const colors = TEAM_COLORS[team];

    ctx.font = 'bold 80px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeText('GOAL!', PITCH.WIDTH / 2, PITCH.HEIGHT / 2 - 10);
    ctx.fillText('GOAL!', PITCH.WIDTH / 2, PITCH.HEIGHT / 2 - 10);

    ctx.font = 'bold 30px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${colors.name} Team Scores!`, PITCH.WIDTH / 2, PITCH.HEIGHT / 2 + 40);
  }
}
