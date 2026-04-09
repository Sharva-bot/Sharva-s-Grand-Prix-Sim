export const GAME_CONFIG = {
  FPS: 60,
  SEGMENT_LENGTH: 200,
  RUMBLE_LENGTH: 3,
  ROAD_WIDTH: 2000,
  LANES: 3,
  FIELD_OF_VIEW: 100,
  CAMERA_HEIGHT: 1000, // Higher camera for better view
  CAMERA_DEPTH: 0.84, // 1 / tan((FOV/2) * pi/180)
  DRAW_DISTANCE: 300,
  FOG_DENSITY: 5,
  MAX_SPEED: 600, // Reduced from 1200 for stability
  ACCEL: 2, // Reduced accel
  BREAKING: -10,
  DECEL: -1,
  OFF_ROAD_DECEL: -20, // Stronger off-road penalty
  OFF_ROAD_LIMIT: 100,
  TRACK_LENGTH: 2000, // Longer track
  PLAYER_Z: 100, // Distance of player from camera (wheels position)
  
  // Gear ratios (max speed per gear)
  GEARS: [
    { maxSpeed: 0, ratio: 0 }, // Neutral
    { maxSpeed: 100, ratio: 2.5 },
    { maxSpeed: 200, ratio: 2.0 },
    { maxSpeed: 300, ratio: 1.6 },
    { maxSpeed: 400, ratio: 1.3 },
    { maxSpeed: 500, ratio: 1.1 },
    { maxSpeed: 600, ratio: 1.0 }, // 6th
  ],
  
  TIRE_WEAR_RATE: 0.005, // per frame at speed
  FUEL_CONSUMPTION: 0.002, // per frame at speed
};

export type GameState = {
  speed: number;
  position: number;
  playerX: number;
  gear: number;
  rpm: number;
  lap: number;
  lapTime: number;
  lastLapTime: number;
  bestLapTime: number;
  tires: number; // 0-100%
  fuel: number; // 0-100%
  isPitting: boolean;
  pitPhase: 'none' | 'entry' | 'stopped' | 'exit';
  pitTimer: number;
  pitMenuOpen: boolean;
  tyreCompound: 'soft' | 'medium' | 'hard';
  paused: boolean;
  totalTime: number;
  startSequence: number; // 0: Off, 1-5: Red Lights, 6: Green (Go!)
  raceStarted: boolean;
  crashed: boolean;
  crashTimer: number;
  muted: boolean;
};
