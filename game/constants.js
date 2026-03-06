const GAME = {
  TICK_RATE: 60,
  MATCH_DURATION: 180, // 3 minutes in seconds (default, host can change)
  COUNTDOWN_DURATION: 3,
  MAX_PLAYERS_PER_TEAM: 9,
  ROOM_CODE_LENGTH: 4,
  HALFTIME_DURATION: 5, // 5 second halftime break
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
  MAX_SPEED: 4.2,
  SPRINT_SPEED: 6.3,
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
  A: { fill: '#e53e3e', stroke: '#c53030', name: 'Chennai&Pune' },
  B: { fill: '#3182ce', stroke: '#2b6cb0', name: 'Trivandrum&Kochi' },
};

// Employee ID to name + pre-seeded team mapping
const EMPLOYEE_MAP = {
  '2787892': { name: 'Daniyal', team: 'A' },
  '1608368': { name: 'Likhith', team: 'A' },
  '2782027': { name: 'Barath', team: 'A' },
  '2781746': { name: 'Gokkul', team: 'A' },
  '1793388': { name: 'Kauik', team: 'A' },
  '2854640': { name: 'Rahul', team: 'A' },
  '249292':  { name: 'Siva', team: 'A' },
  '2794571': { name: 'Aditya', team: 'A' },
  '2790321': { name: 'Prateek', team: 'A' },
  '2635798': { name: 'Vignesh', team: 'B' },
  '1950965': { name: 'Abinshah', team: 'B' },
  '2781889': { name: 'Arjun', team: 'B' },
  '1943438': { name: 'Grigary', team: 'B' },
  '1778341': { name: 'Jithin', team: 'B' },
  '1946865': { name: 'Nikhit', team: 'B' },
  '1771788': { name: 'Sneha', team: 'B' },
  '2159976': { name: 'Gilsmon', team: 'B' },
  '2618781': { name: 'Swathy', team: 'B' },
};

// Formation positions (normalized 0-1 relative to team half)
const FORMATIONS_9 = [
  { x: 0.08, y: 0.5 },   // Goalkeeper
  { x: 0.25, y: 0.2 },   // Left Back
  { x: 0.25, y: 0.5 },   // Center Back
  { x: 0.25, y: 0.8 },   // Right Back
  { x: 0.5, y: 0.15 },   // Left Mid
  { x: 0.5, y: 0.5 },    // Center Mid
  { x: 0.5, y: 0.85 },   // Right Mid
  { x: 0.75, y: 0.35 },  // Striker Left
  { x: 0.75, y: 0.65 },  // Striker Right
];

module.exports = {
  GAME,
  PITCH,
  PLAYER,
  BALL,
  TEAMS,
  TEAM_COLORS,
  EMPLOYEE_MAP,
  FORMATIONS_9,
};
