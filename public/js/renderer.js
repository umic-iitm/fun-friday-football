// Pitch and game constants (must match server)
const PITCH = {
  WIDTH: 1800,
  HEIGHT: 1000,
  PADDING: 50,
  LINE_WIDTH: 2,
  CENTER_CIRCLE_RADIUS: 90,
  GOAL_WIDTH: 14,
  GOAL_HEIGHT: 180,
  PENALTY_AREA_WIDTH: 165,
  PENALTY_AREA_HEIGHT: 400,
  GOAL_AREA_WIDTH: 70,
  GOAL_AREA_HEIGHT: 220,
};

const PLAYER_RADIUS = 18;
const BALL_RADIUS = 9;

const TEAM_COLORS = {
  A: {
    jersey: '#c0392b', jerseyLight: '#e74c3c', jerseyDark: '#962d22',
    shorts: '#2c3e50', socks: '#c0392b',
    skin: '#f5cba7', skinDark: '#e0ac69',
    name: 'Chennai&Pune',
    shortName: 'CHE&PUN',
    gkJersey: '#f39c12', gkJerseyLight: '#f1c40f', gkJerseyDark: '#d68910',
  },
  B: {
    jersey: '#2471a3', jerseyLight: '#3498db', jerseyDark: '#1a5276',
    shorts: '#ecf0f1', socks: '#2471a3',
    skin: '#f5cba7', skinDark: '#e0ac69',
    name: 'Trivandrum&Kochi',
    shortName: 'TRV&KCH',
    gkJersey: '#27ae60', gkJerseyLight: '#2ecc71', gkJerseyDark: '#1e8449',
  },
};

// Pre-computed frame counter for animations
let frameCount = 0;

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pitchCache = null;
    this.particles = [];
    this.goalFlashAlpha = 0;
    this.goalFlashTeam = null;
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
    this.pitchCache = null; // force redraw
  }

  render(gameState, myId) {
    frameCount++;
    const ctx = this.ctx;

    // Draw cached pitch (static elements)
    if (!this.pitchCache) {
      this.buildPitchCache();
    }
    ctx.drawImage(this.pitchCache, 0, 0);

    // Sort players by Y for depth (lower Y drawn first)
    const sortedPlayers = [...gameState.players].sort((a, b) => a.y - b.y);

    // Draw player shadows first (all of them)
    sortedPlayers.forEach(player => this.drawPlayerShadow(ctx, player));

    // Draw ball shadow
    this.drawBallShadow(ctx, gameState.ball);

    // Draw players
    sortedPlayers.forEach(player => {
      this.drawPlayer(ctx, player, player.id === myId);
    });

    // Draw ball
    this.drawBall(ctx, gameState.ball);

    // Draw HUD
    this.drawHUD(ctx, gameState);

    // Draw overlays
    if (gameState.state === 'countdown') {
      this.drawCountdown(ctx, gameState.countdownTimer);
    }

    if (gameState.state === 'goalScored') {
      this.drawGoalCelebration(ctx, gameState.lastGoalTeam);
    }

    if (gameState.state === 'halftime') {
      this.drawHalfTime(ctx, gameState.halfTimeTimer);
    }

    // Update particles
    this.updateParticles(ctx);

    // GK gloves overlay (drawn last, always on top)
    const me = gameState.players.find(p => p.id === myId);
    if (me && me.isGK) {
      this.drawGlovesOverlay(ctx, me);
    }
  }

  buildPitchCache() {
    const offscreen = document.createElement('canvas');
    offscreen.width = PITCH.WIDTH;
    offscreen.height = PITCH.HEIGHT;
    const ctx = offscreen.getContext('2d');
    this.drawPitch(ctx);
    this.pitchCache = offscreen;
  }

  drawPitch(ctx) {
    const p = PITCH.PADDING;
    const w = PITCH.WIDTH - p * 2;
    const h = PITCH.HEIGHT - p * 2;
    const cx = PITCH.WIDTH / 2;
    const cy = PITCH.HEIGHT / 2;

    // Stadium surround (dark area outside pitch)
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    // Advertising boards effect along edges
    const boardH = 12;
    // Top board
    this.drawAdBoard(ctx, p - boardH, p - boardH, w + boardH * 2, boardH);
    // Bottom board
    this.drawAdBoard(ctx, p - boardH, p + h, w + boardH * 2, boardH);
    // Left board (above/below goal)
    const goalTop = cy - PITCH.GOAL_HEIGHT / 2;
    const goalBot = cy + PITCH.GOAL_HEIGHT / 2;
    this.drawAdBoard(ctx, p - boardH, p - boardH, boardH, goalTop - p + boardH);
    this.drawAdBoard(ctx, p - boardH, goalBot, boardH, p + h - goalBot + boardH);
    // Right board
    this.drawAdBoard(ctx, p + w, p - boardH, boardH, goalTop - p + boardH);
    this.drawAdBoard(ctx, p + w, goalBot, boardH, p + h - goalBot + boardH);

    // Grass base
    const grassGrad = ctx.createLinearGradient(0, p, 0, p + h);
    grassGrad.addColorStop(0, '#2e8b3e');
    grassGrad.addColorStop(0.5, '#34a045');
    grassGrad.addColorStop(1, '#2e8b3e');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(p, p, w, h);

    // Mowing stripes (diagonal FIFA style)
    const stripeCount = 18;
    const stripeW = w / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      }
      ctx.fillRect(p + i * stripeW, p, stripeW, h);
    }

    // Subtle grass texture overlay
    for (let i = 0; i < 3000; i++) {
      const gx = p + Math.random() * w;
      const gy = p + Math.random() * h;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0}, ${Math.random() > 0.5 ? 255 : 0}, 0, 0.015)`;
      ctx.fillRect(gx, gy, 1, 2);
    }

    // --- White line markings ---
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 4;

    // Outer boundary
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
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    // Penalty areas
    const paW = PITCH.PENALTY_AREA_WIDTH;
    const paH = PITCH.PENALTY_AREA_HEIGHT;
    ctx.strokeRect(p, cy - paH / 2, paW, paH);
    ctx.strokeRect(p + w - paW, cy - paH / 2, paW, paH);

    // Goal areas
    const gaW = PITCH.GOAL_AREA_WIDTH;
    const gaH = PITCH.GOAL_AREA_HEIGHT;
    ctx.strokeRect(p, cy - gaH / 2, gaW, gaH);
    ctx.strokeRect(p + w - gaW, cy - gaH / 2, gaW, gaH);

    // Penalty spots
    ctx.beginPath();
    ctx.arc(p + paW - 25, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p + w - paW + 25, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Penalty arcs (the D)
    ctx.beginPath();
    ctx.arc(p + paW - 25, cy, PITCH.CENTER_CIRCLE_RADIUS * 0.7, -0.8, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p + w - paW + 25, cy, PITCH.CENTER_CIRCLE_RADIUS * 0.7, Math.PI - 0.8, Math.PI + 0.8);
    ctx.stroke();

    // Corner arcs
    const cornerR = 20;
    ctx.beginPath(); ctx.arc(p, p, cornerR, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(p + w, p, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(p, p + h, cornerR, -Math.PI / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(p + w, p + h, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke();

    ctx.shadowBlur = 0;

    // --- Goals with 3D net effect ---
    const goalH = PITCH.GOAL_HEIGHT;
    const goalW = PITCH.GOAL_WIDTH;

    this.drawGoalNet(ctx, p - goalW * 3, cy - goalH / 2, goalW * 3, goalH, 'left');
    this.drawGoalNet(ctx, p + w, cy - goalH / 2, goalW * 3, goalH, 'right');

    // Goal posts (3D effect)
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;

    // Left goal posts
    ctx.beginPath();
    ctx.moveTo(p, cy - goalH / 2);
    ctx.lineTo(p - goalW * 3, cy - goalH / 2);
    ctx.lineTo(p - goalW * 3, cy + goalH / 2);
    ctx.lineTo(p, cy + goalH / 2);
    ctx.stroke();

    // Right goal posts
    ctx.beginPath();
    ctx.moveTo(p + w, cy - goalH / 2);
    ctx.lineTo(p + w + goalW * 3, cy - goalH / 2);
    ctx.lineTo(p + w + goalW * 3, cy + goalH / 2);
    ctx.lineTo(p + w, cy + goalH / 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = PITCH.LINE_WIDTH;
  }

  drawAdBoard(ctx, x, y, w, h) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#2c3e50');
    grad.addColorStop(0.5, '#34495e');
    grad.addColorStop(1, '#2c3e50');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    // Highlight line
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y, w, 1);
  }

  drawGoalNet(ctx, x, y, w, h, side) {
    // Net background
    ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
    ctx.fillRect(x, y, w, h);

    // Net lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    const spacing = 10;

    // Vertical net lines
    for (let nx = 0; nx < w; nx += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + nx, y);
      ctx.lineTo(x + nx, y + h);
      ctx.stroke();
    }
    // Horizontal net lines
    for (let ny = 0; ny < h; ny += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, y + ny);
      ctx.lineTo(x + w, y + ny);
      ctx.stroke();
    }
  }

  drawPlayerShadow(ctx, player) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(player.x + 3, player.y + PLAYER_RADIUS + 4, PLAYER_RADIUS * 0.85, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, player, isMe) {
    const colors = TEAM_COLORS[player.team];
    const px = player.x;
    const py = player.y;
    const r = PLAYER_RADIUS;
    const isGK = player.isGK;

    // Pick jersey colors (GK gets different color)
    const jFill = isGK ? colors.gkJersey : colors.jersey;
    const jLight = isGK ? colors.gkJerseyLight : colors.jerseyLight;
    const jDark = isGK ? colors.gkJerseyDark : colors.jerseyDark;

    // Selection indicator for own player
    if (isMe) {
      const pulse = Math.sin(frameCount * 0.08) * 0.3 + 0.7;
      // Pulsing ring
      ctx.beginPath();
      ctx.arc(px, py + 2, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Arrow pointer above
      const arrowY = py - r - 22;
      ctx.beginPath();
      ctx.moveTo(px, arrowY + 8);
      ctx.lineTo(px - 7, arrowY);
      ctx.lineTo(px + 7, arrowY);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.fill();
    }

    // === JERSEY SHAPE (top-down T-shirt) ===
    ctx.save();
    ctx.translate(px, py);

    // Shorts / legs (two small circles at bottom)
    ctx.fillStyle = colors.shorts;
    ctx.beginPath();
    ctx.ellipse(-5, r * 0.6, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, r * 0.6, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Socks/boots (tiny circles at end of legs)
    ctx.fillStyle = isGK ? jDark : colors.socks;
    ctx.beginPath();
    ctx.arc(-5, r * 0.6 + 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, r * 0.6 + 7, 3, 0, Math.PI * 2);
    ctx.fill();

    // Jersey body (T-shirt shape)
    const jerseyGrad = ctx.createLinearGradient(0, -r, 0, r * 0.5);
    jerseyGrad.addColorStop(0, jLight);
    jerseyGrad.addColorStop(0.5, jFill);
    jerseyGrad.addColorStop(1, jDark);

    ctx.beginPath();
    // Start from left shoulder
    ctx.moveTo(-r * 0.55, -r * 0.4);
    // Left sleeve out
    ctx.lineTo(-r * 1.05, -r * 0.25);
    // Sleeve bottom
    ctx.lineTo(-r * 0.95, r * 0.05);
    // Armpit
    ctx.lineTo(-r * 0.55, r * 0.0);
    // Left side down
    ctx.lineTo(-r * 0.5, r * 0.55);
    // Bottom
    ctx.lineTo(r * 0.5, r * 0.55);
    // Right side up
    ctx.lineTo(r * 0.55, r * 0.0);
    // Right armpit
    ctx.lineTo(r * 0.95, r * 0.05);
    // Right sleeve
    ctx.lineTo(r * 1.05, -r * 0.25);
    // Right shoulder
    ctx.lineTo(r * 0.55, -r * 0.4);
    // Collar curve
    ctx.quadraticCurveTo(0, -r * 0.25, -r * 0.55, -r * 0.4);
    ctx.closePath();

    ctx.fillStyle = jerseyGrad;
    ctx.fill();
    ctx.strokeStyle = jDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Collar (V-neck)
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.38);
    ctx.lineTo(0, -r * 0.15);
    ctx.lineTo(r * 0.3, -r * 0.38);
    ctx.strokeStyle = isGK ? '#fff' : jLight;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stripe accent down center of jersey
    ctx.beginPath();
    ctx.moveTo(-r * 0.08, -r * 0.15);
    ctx.lineTo(-r * 0.08, r * 0.5);
    ctx.lineTo(r * 0.08, r * 0.5);
    ctx.lineTo(r * 0.08, -r * 0.15);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,0.12)`;
    ctx.fill();

    // Jersey number
    ctx.font = `bold ${r * 0.55}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeText(this.getJerseyNumber(player), 0, r * 0.15);
    ctx.fillText(this.getJerseyNumber(player), 0, r * 0.15);

    // GK glove hands (small circles at sleeve ends for GK)
    if (isGK) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(-r * 1.0, -r * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 1.0, -r * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Head
    const headGrad = ctx.createRadialGradient(-1, -r * 0.55, 1, 0, -r * 0.5, r * 0.35);
    headGrad.addColorStop(0, '#ffe0bd');
    headGrad.addColorStop(1, colors.skinDark);
    ctx.beginPath();
    ctx.arc(0, -r * 0.52, r * 0.33, 0, Math.PI * 2);
    ctx.fillStyle = headGrad;
    ctx.fill();

    // Hair
    ctx.beginPath();
    ctx.arc(0, -r * 0.58, r * 0.28, Math.PI + 0.4, -0.4);
    ctx.fillStyle = '#222';
    ctx.fill();

    ctx.restore();

    // Name label with background
    const name = player.name;
    const label = isGK ? `[GK] ${name}` : name;
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    const nameW = ctx.measureText(label).width;

    ctx.fillStyle = isGK ? 'rgba(243, 156, 18, 0.7)' : 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(px - nameW / 2 - 5, py - r - 35, nameW + 10, 16, 3);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(label, px, py - r - 27);

    // Stamina bar (own player only)
    if (isMe) {
      const barW = 36;
      const barH = 4;
      const barX = px - barW / 2;
      const barY = py + r + 14;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 3);
      ctx.fill();

      const staminaPct = player.stamina / 100;
      let staminaColor;
      if (staminaPct > 0.6) staminaColor = '#2ecc71';
      else if (staminaPct > 0.3) staminaColor = '#f39c12';
      else staminaColor = '#e74c3c';

      const staminaGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      staminaGrad.addColorStop(0, staminaColor);
      staminaGrad.addColorStop(1, staminaColor + '99');
      ctx.fillStyle = staminaGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * staminaPct, barH, 2);
      ctx.fill();
    }
  }

  getJerseyNumber(player) {
    // Generate a consistent number from name
    let hash = 0;
    for (let i = 0; i < player.name.length; i++) {
      hash = ((hash << 3) - hash) + player.name.charCodeAt(i);
    }
    return (Math.abs(hash) % 99) + 1;
  }

  drawBallShadow(ctx, ball) {
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const shadowOffset = 3 + speed * 0.3;

    ctx.beginPath();
    ctx.ellipse(ball.x + shadowOffset, ball.y + BALL_RADIUS + 5, BALL_RADIUS * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
  }

  drawBall(ctx, ball) {
    const bx = ball.x;
    const by = ball.y;
    const r = BALL_RADIUS;
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

    // Speed trail when moving fast
    if (speed > 5) {
      const trailAlpha = Math.min(speed / 20, 0.4);
      const trailLen = Math.min(speed * 2, 30);
      const angle = Math.atan2(-ball.vy, -ball.vx);

      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(angle - 0.3) * r, by + Math.sin(angle - 0.3) * r);
      ctx.lineTo(bx + Math.cos(angle) * trailLen, by + Math.sin(angle) * trailLen);
      ctx.lineTo(bx + Math.cos(angle + 0.3) * r, by + Math.sin(angle + 0.3) * r);
      ctx.fillStyle = `rgba(255, 255, 255, ${trailAlpha})`;
      ctx.fill();
    }

    // Ball glow when fast
    if (speed > 8) {
      ctx.beginPath();
      ctx.arc(bx, by, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 200, ${Math.min(speed / 40, 0.3)})`;
      ctx.fill();
    }

    // Main ball
    const ballGrad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, r);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.6, '#f0f0f0');
    ballGrad.addColorStop(1, '#c0c0c0');

    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Football pentagon pattern (rotating with speed)
    const rotation = (frameCount * speed * 0.02);
    ctx.fillStyle = '#333';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + rotation;
      const px = bx + Math.cos(angle) * r * 0.48;
      const py = by + Math.sin(angle) * r * 0.48;

      ctx.beginPath();
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 + angle;
        const sx = px + Math.cos(a) * 2.5;
        const sy = py + Math.sin(a) * 2.5;
        if (j === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Ball outline
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shine highlight
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
  }

  drawHUD(ctx, state) {
    const cx = PITCH.WIDTH / 2;

    // === FIFA-style scoreboard ===
    const hudW = 440;
    const hudH = 50;
    const hudX = cx - hudW / 2;
    const hudY = 8;

    // Scoreboard bg
    ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 6);
    ctx.fill();

    // Top accent line
    const accentGrad = ctx.createLinearGradient(hudX, hudY, hudX + hudW, hudY);
    accentGrad.addColorStop(0, TEAM_COLORS.A.jersey);
    accentGrad.addColorStop(0.5, '#ffd700');
    accentGrad.addColorStop(1, TEAM_COLORS.B.jersey);
    ctx.fillStyle = accentGrad;
    ctx.fillRect(hudX, hudY, hudW, 3);

    // Team A side
    ctx.fillStyle = TEAM_COLORS.A.jersey;
    ctx.beginPath();
    ctx.roundRect(hudX + 8, hudY + 10, 90, 30, 4);
    ctx.fill();
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(TEAM_COLORS.A.shortName, hudX + 53, hudY + 26);

    // Team A score
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(state.score.A, hudX + 140, hudY + 28);

    // Separator
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(':', cx, hudY + 27);

    // Team B score
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(state.score.B, hudX + hudW - 140, hudY + 28);

    // Team B side
    ctx.fillStyle = TEAM_COLORS.B.jersey;
    ctx.beginPath();
    ctx.roundRect(hudX + hudW - 98, hudY + 10, 90, 30, 4);
    ctx.fill();
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(TEAM_COLORS.B.shortName, hudX + hudW - 53, hudY + 26);

    // Timer pill
    const minutes = Math.floor(state.matchTimer / 60);
    const seconds = Math.floor(state.matchTimer % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const timerW = 70;
    const timerH = 26;
    const timerX = cx - timerW / 2;
    const timerY = hudY + hudH + 4;

    ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
    ctx.beginPath();
    ctx.roundRect(timerX, timerY, timerW, timerH, 13);
    ctx.fill();

    // Timer glow when low
    if (state.matchTimer < 30) {
      const urgency = Math.sin(frameCount * 0.15) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(231, 76, 60, ${urgency})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(timerX, timerY, timerW, timerH, 13);
      ctx.stroke();
    }

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.matchTimer < 30 ? '#e74c3c' : '#fff';
    ctx.fillText(timeStr, cx, timerY + timerH / 2);

    // Mini controls hint (bottom of screen)
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('WASD/Arrows: Move  |  SPACE: Kick  |  P: Pass  |  SHIFT: Sprint', cx, PITCH.HEIGHT - 8);
  }

  drawCountdown(ctx, timer) {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    const num = Math.ceil(timer);
    const text = num > 0 ? num.toString() : 'KICK OFF!';
    const scale = 1 + (timer % 1) * 0.15; // pulse effect

    ctx.save();
    ctx.translate(PITCH.WIDTH / 2, PITCH.HEIGHT / 2);
    ctx.scale(scale, scale);

    // Text glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 30;

    ctx.font = `bold ${num > 0 ? 140 : 70}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text stroke
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 6;
    ctx.strokeText(text, 0, 0);

    // Text fill
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 0, 0);

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  drawGoalCelebration(ctx, team) {
    const colors = TEAM_COLORS[team];

    // Flash overlay
    const flashAlpha = Math.sin(frameCount * 0.12) * 0.1 + 0.15;
    ctx.fillStyle = `rgba(${team === 'A' ? '192,57,43' : '36,113,163'}, ${flashAlpha})`;
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    // Darker center
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, PITCH.HEIGHT / 2 - 80, PITCH.WIDTH, 160);

    // Spawn celebration particles
    if (frameCount % 3 === 0) {
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x: PITCH.WIDTH / 2 + (Math.random() - 0.5) * 400,
          y: PITCH.HEIGHT / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 6 - 2,
          life: 1,
          color: Math.random() > 0.5 ? colors.jersey : '#ffd700',
          size: Math.random() * 4 + 2,
        });
      }
    }

    // "GOAL!" text
    ctx.save();
    const pulse = 1 + Math.sin(frameCount * 0.1) * 0.05;
    ctx.translate(PITCH.WIDTH / 2, PITCH.HEIGHT / 2 - 15);
    ctx.scale(pulse, pulse);

    ctx.shadowColor = colors.jersey;
    ctx.shadowBlur = 40;

    ctx.font = 'bold 100px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeText('GOAL!', 0, 0);

    const goalGrad = ctx.createLinearGradient(-120, -40, 120, 40);
    goalGrad.addColorStop(0, colors.jerseyLight);
    goalGrad.addColorStop(0.5, '#ffd700');
    goalGrad.addColorStop(1, colors.jerseyLight);
    ctx.fillStyle = goalGrad;
    ctx.fillText('GOAL!', 0, 0);

    ctx.restore();
    ctx.shadowBlur = 0;

    // Team name
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${colors.name} Scores!`, PITCH.WIDTH / 2, PITCH.HEIGHT / 2 + 50);
  }

  drawHalfTime(ctx, timer) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, PITCH.WIDTH, PITCH.HEIGHT);

    // Decorative lines
    const cx = PITCH.WIDTH / 2;
    const cy = PITCH.HEIGHT / 2;

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 250, cy - 60);
    ctx.lineTo(cx + 250, cy - 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 250, cy + 60);
    ctx.lineTo(cx + 250, cy + 60);
    ctx.stroke();

    // "HALF TIME" text
    ctx.save();
    ctx.translate(cx, cy - 15);

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 30;

    ctx.font = 'bold 80px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 6;
    ctx.strokeText('HALF TIME', 0, 0);

    const htGrad = ctx.createLinearGradient(-200, -30, 200, 30);
    htGrad.addColorStop(0, '#ffd700');
    htGrad.addColorStop(0.5, '#fff');
    htGrad.addColorStop(1, '#ffd700');
    ctx.fillStyle = htGrad;
    ctx.fillText('HALF TIME', 0, 0);

    ctx.restore();
    ctx.shadowBlur = 0;

    // Timer countdown
    const secs = Math.ceil(timer);
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`Resuming in ${secs}...`, cx, cy + 35);
  }

  updateParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.life -= 0.015;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawGlovesOverlay(ctx, myPlayer) {
    const W = PITCH.WIDTH;
    const H = PITCH.HEIGHT;
    const colors = TEAM_COLORS[myPlayer.team];

    // Subtle idle sway animation
    const sway = Math.sin(frameCount * 0.04) * 3;
    const breathe = Math.sin(frameCount * 0.06) * 2;

    ctx.save();

    // === LEFT GLOVE ===
    ctx.save();
    ctx.translate(55 + sway, H - 80 + breathe);

    // Forearm
    ctx.fillStyle = colors.gkJersey;
    ctx.beginPath();
    ctx.moveTo(-50, 80);
    ctx.quadraticCurveTo(-40, 30, -15, -10);
    ctx.lineTo(15, -10);
    ctx.quadraticCurveTo(30, 30, 40, 80);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.gkJerseyDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glove base
    const gloveGrad = ctx.createRadialGradient(0, -20, 5, 0, -10, 60);
    gloveGrad.addColorStop(0, '#f7dc6f');
    gloveGrad.addColorStop(1, '#d4ac0d');
    ctx.fillStyle = gloveGrad;

    // Palm
    ctx.beginPath();
    ctx.ellipse(0, -25, 32, 28, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b7950b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fingers
    const fingerPositions = [
      { x: -20, y: -50, angle: -0.3, len: 22, w: 8 },
      { x: -8, y: -56, angle: -0.1, len: 25, w: 8 },
      { x: 6, y: -56, angle: 0.05, len: 25, w: 8 },
      { x: 18, y: -50, angle: 0.25, len: 22, w: 8 },
    ];

    fingerPositions.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.beginPath();
      ctx.roundRect(-f.w / 2, -f.len, f.w, f.len, 4);
      ctx.fillStyle = '#f7dc6f';
      ctx.fill();
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });

    // Thumb
    ctx.save();
    ctx.translate(28, -30);
    ctx.rotate(0.6);
    ctx.beginPath();
    ctx.roundRect(-5, -16, 10, 18, 4);
    ctx.fillStyle = '#f7dc6f';
    ctx.fill();
    ctx.strokeStyle = '#d4ac0d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Grip texture on palm
    ctx.strokeStyle = 'rgba(180, 150, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = -15; i < 15; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i - 10, -15);
      ctx.lineTo(i + 10, -35);
      ctx.stroke();
    }

    ctx.restore();

    // === RIGHT GLOVE (mirrored) ===
    ctx.save();
    ctx.translate(W - 55 - sway, H - 80 + breathe);
    ctx.scale(-1, 1); // mirror

    // Forearm
    ctx.fillStyle = colors.gkJersey;
    ctx.beginPath();
    ctx.moveTo(-50, 80);
    ctx.quadraticCurveTo(-40, 30, -15, -10);
    ctx.lineTo(15, -10);
    ctx.quadraticCurveTo(30, 30, 40, 80);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.gkJerseyDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glove base
    const gloveGrad2 = ctx.createRadialGradient(0, -20, 5, 0, -10, 60);
    gloveGrad2.addColorStop(0, '#f7dc6f');
    gloveGrad2.addColorStop(1, '#d4ac0d');
    ctx.fillStyle = gloveGrad2;

    ctx.beginPath();
    ctx.ellipse(0, -25, 32, 28, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b7950b';
    ctx.lineWidth = 2;
    ctx.stroke();

    fingerPositions.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.beginPath();
      ctx.roundRect(-f.w / 2, -f.len, f.w, f.len, 4);
      ctx.fillStyle = '#f7dc6f';
      ctx.fill();
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    });

    // Thumb
    ctx.save();
    ctx.translate(28, -30);
    ctx.rotate(0.6);
    ctx.beginPath();
    ctx.roundRect(-5, -16, 10, 18, 4);
    ctx.fillStyle = '#f7dc6f';
    ctx.fill();
    ctx.strokeStyle = '#d4ac0d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Grip texture
    ctx.strokeStyle = 'rgba(180, 150, 0, 0.3)';
    ctx.lineWidth = 1;
    for (let i = -15; i < 15; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i - 10, -15);
      ctx.lineTo(i + 10, -35);
      ctx.stroke();
    }

    ctx.restore();

    // GK role indicator at top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 60, H - 30, 120, 24, 12);
    ctx.fill();
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('GOALKEEPER', W / 2, H - 18);

    ctx.restore();
  }
}
