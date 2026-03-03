const GAME = {
  TICK_RATE: 60,
  MATCH_DURATION: 180, // 3 minutes in seconds
  COUNTDOWN_DURATION: 3,
  MAX_PLAYERS_PER_TEAM: 8,
  ROOM_CODE_LENGTH: 4,
};

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

const PLAYER = {
  RADIUS: 18,
  MAX_SPEED: 5.0,
  SPRINT_SPEED: 7.5,
  ACCELERATION: 0.65,
  DECELERATION: 0.85,
  KICK_POWER: 14,
  KICK_RANGE: 34,
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 0.6,
  STAMINA_REGEN: 0.25,
  STAMINA_MIN_TO_SPRINT: 10,
  MASS: 1.0,
  BOUNCE: 0.3,
};

const BALL = {
  RADIUS: 9,
  FRICTION: 0.987,
  MAX_SPEED: 20,
  DRIBBLE_SPEED: 2.8,
  DRIBBLE_RANGE: 28,
  MASS: 0.3,
  BOUNCE_WALL: 0.7,
  BOUNCE_PLAYER: 0.5,
};

const TEAMS = {
  A: 'A',
  B: 'B',
};

const TEAM_COLORS = {
  A: { fill: '#e53e3e', stroke: '#c53030', name: 'Red' },
  B: { fill: '#3182ce', stroke: '#2b6cb0', name: 'Blue' },
};

// Formation positions (normalized 0-1 relative to team half)
const FORMATIONS_8 = [
  { x: 0.08, y: 0.5 },   // Goalkeeper
  { x: 0.25, y: 0.2 },   // Left Back
  { x: 0.25, y: 0.5 },   // Center Back
  { x: 0.25, y: 0.8 },   // Right Back
  { x: 0.5, y: 0.15 },   // Left Mid
  { x: 0.5, y: 0.5 },    // Center Mid
  { x: 0.5, y: 0.85 },   // Right Mid
  { x: 0.75, y: 0.5 },   // Striker
];

module.exports = {
  GAME,
  PITCH,
  PLAYER,
  BALL,
  TEAMS,
  TEAM_COLORS,
  FORMATIONS_8,
};
