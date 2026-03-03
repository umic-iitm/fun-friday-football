function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(vx, vy) {
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: vx / len, y: vy / len };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function magnitude(vx, vy) {
  return Math.sqrt(vx * vx + vy * vy);
}

function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function resolveCircleCollision(a, b, aRadius, bRadius, aMass, bMass, bounce) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = aRadius + bRadius;

  if (dist >= minDist || dist === 0) return false;

  // Normal vector
  const nx = dx / dist;
  const ny = dy / dist;

  // Separate the circles
  const overlap = minDist - dist;
  const totalMass = aMass + bMass;
  a.x -= nx * overlap * (bMass / totalMass);
  a.y -= ny * overlap * (bMass / totalMass);
  b.x += nx * overlap * (aMass / totalMass);
  b.y += ny * overlap * (aMass / totalMass);

  // Relative velocity
  const dvx = a.vx - b.vx;
  const dvy = a.vy - b.vy;
  const dvDotN = dvx * nx + dvy * ny;

  // Don't resolve if moving apart
  if (dvDotN <= 0) return true;

  const impulse = (2 * dvDotN) / totalMass * (1 + bounce);

  a.vx -= impulse * bMass * nx;
  a.vy -= impulse * bMass * ny;
  b.vx += impulse * aMass * nx;
  b.vy += impulse * aMass * ny;

  return true;
}

module.exports = {
  distance,
  normalize,
  clamp,
  magnitude,
  generateRoomCode,
  resolveCircleCollision,
};
