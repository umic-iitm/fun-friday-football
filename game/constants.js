const GAME = {
  TICK_RATE: 60,
  MATCH_DURATION: 180, // 3 minutes in seconds
  COUNTDOWN_DURATION: 3,
  MAX_PLAYERS_PER_TEAM: 8,
  ROOM_CODE_LENGTH: 4,
};

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

const PLAYER = {
  RADIUS: 16,
  MAX_SPEED: 4.5,
  SPRINT_SPEED: 6.5,
  ACCELERATION: 0.6,
  DECELERATION: 0.85,
  KICK_POWER: 12,
  KICK_RANGE: 30,
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 0.6,
  STAMINA_REGEN: 0.25,
  STAMINA_MIN_TO_SPRINT: 10,
  MASS: 1.0,
  BOUNCE: 0.3,
};

const BALL = {
  RADIUS: 8,
  FRICTION: 0.985,
  MAX_SPEED: 18,
  DRIBBLE_SPEED: 2.5,
  DRIBBLE_RANGE: 25,
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
