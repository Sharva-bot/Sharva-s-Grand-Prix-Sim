import { GAME_CONFIG, GameState } from './constants';
import { RenderUtils } from './RenderUtils';
import { SoundEngine } from './SoundEngine';

type Segment = {
  index: number;
  p1: { world: { x: number; y: number; z: number }; camera: { x: number; y: number; z: number }; screen: { x: number; y: number; w: number; scale: number } };
  p2: { world: { x: number; y: number; z: number }; camera: { x: number; y: number; z: number }; screen: { x: number; y: number; w: number; scale: number } };
  curve: number;
  color: { road: string; grass: string; rumble: string; lane: string };
};

export class GameEngine {
  segments: Segment[] = [];
  state: GameState;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  soundEngine: SoundEngine;
  
  // Input state
  keys: { [key: string]: boolean } = {};

  constructor(canvas: HTMLCanvasElement, initialState?: Partial<GameState>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    try {
        this.soundEngine = new SoundEngine();
    } catch (e) {
        console.error("Audio initialization failed", e);
        // Fallback or dummy sound engine could go here, but for now we just won't have sound
        this.soundEngine = { init: async () => {}, update: () => {}, isInitialized: false } as any;
    }
    this.state = {
      speed: 0,
      position: 0,
      playerX: 0,
      gear: 0, // 0 = Neutral
      rpm: 0,
      lap: 1,
      lapTime: 0,
      lastLapTime: 0,
      bestLapTime: 0,
      tires: 100,
      fuel: 100,
      isPitting: false,
      pitPhase: 'none',
      pitTimer: 0,
      pitMenuOpen: false,
      tyreCompound: 'medium',
      paused: false,
      totalTime: 0,
      startSequence: 0,
      raceStarted: false,
      crashed: false,
      crashTimer: 0,
      muted: false,
      ...initialState
    };

    this.generateTrack();
    this.bindInputs();
    this.startRaceSequence();
  }

  toggleMute() {
      this.state.muted = !this.state.muted;
      if (this.state.muted) {
          // Logic to mute sound engine would go here if it had a mute method
          // For now we can just stop updating it or pass volume 0
      }
  }

  setTyreCompound(compound: 'soft' | 'medium' | 'hard') {
      this.state.tyreCompound = compound;
  }

  startRaceSequence() {
    let lightStage = 0;
    const interval = setInterval(() => {
        lightStage++;
        this.state.startSequence = lightStage;
        
        if (lightStage >= 6) {
            clearInterval(interval);
            this.state.raceStarted = true;
            this.state.gear = 1; // Auto shift to 1st
        }
    }, 1000);
  }

  generateTrack() {
    this.segments = [];
    let currentLength = 0;
    const targetLength = GAME_CONFIG.TRACK_LENGTH;
    
    const addRoad = (enter: number, hold: number, leave: number, curve: number, y: number) => {
        const startY = this.segments.length > 0 ? this.segments[this.segments.length - 1].p2.world.y : 0;
        const endY = startY + (y * GAME_CONFIG.SEGMENT_LENGTH);
        const total = enter + hold + leave;
        
        for (let n = 0; n < enter; n++) this.addSegment(curve * (n / enter), (endY - startY) / total);
        for (let n = 0; n < hold; n++) this.addSegment(curve, (endY - startY) / total);
        for (let n = 0; n < leave; n++) this.addSegment(curve * (1 - n / leave), (endY - startY) / total);
        
        currentLength += total;
    };

    // Always start with a long straight
    addRoad(100, 100, 100, 0, 0);

    // Generate random track features until we are close to the target length
    while (currentLength < targetLength - 300) {
        const feature = Math.floor(Math.random() * 4);
        const dir = Math.random() > 0.5 ? 1 : -1;

        switch(feature) {
            case 0: // Straight
                addRoad(50, 100, 50, 0, 0);
                break;
            case 1: // Sweeping Curve
                addRoad(50, 100, 50, 3 * dir, 0);
                break;
            case 2: // Sharp Curve / Hairpin
                addRoad(50, 50, 50, 6 * dir, 0);
                break;
            case 3: // Chicane
                addRoad(20, 20, 20, 5 * dir, 0);
                addRoad(20, 20, 20, -5 * dir, 0);
                break;
        }
    }

    // Finish with a straight to connect smoothly to the start
    const finalRemaining = targetLength - currentLength;
    if (finalRemaining > 0) {
        const p = Math.floor(finalRemaining / 3);
        addRoad(p, p, finalRemaining - (2 * p), 0, 0);
    }
    
    // Ensure exactly TRACK_LENGTH segments
    while (this.segments.length > targetLength) {
        this.segments.pop();
    }
    while (this.segments.length < targetLength) {
        this.addSegment(0, 0);
    }
    
    // Force the last segment to align perfectly with the first (Y=0)
    if (this.segments.length > 0) {
        this.segments[this.segments.length - 1].p2.world.y = 0;
    }
  }

  addSegment(curve: number, dy: number) {
      const n = this.segments.length;
      const p1y = n > 0 ? this.segments[n-1].p2.world.y : 0;
      const p2y = p1y + dy;

      const p1 = { world: { x: 0, y: p1y, z: n * GAME_CONFIG.SEGMENT_LENGTH }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } };
      const p2 = { world: { x: 0, y: p2y, z: (n + 1) * GAME_CONFIG.SEGMENT_LENGTH }, camera: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0, scale: 0 } };

      // Colors
      const light = Math.floor(n / GAME_CONFIG.RUMBLE_LENGTH) % 2;
      const color = {
        road: light ? '#4b5563' : '#374151',
        grass: light ? '#15803d' : '#166534',
        rumble: light ? '#dc2626' : '#f3f4f6',
        lane: light ? '#ffffff' : ''
      };

      this.segments.push({ index: n, p1, p2, curve, color });
  }

  bindInputs() {
    const initAudio = () => {
        if (!this.soundEngine.isInitialized) {
            this.soundEngine.init();
        }
    };

    window.addEventListener('keydown', (e) => {
      initAudio();
      this.keys[e.code] = true;
      if (e.code === 'KeyA') this.shiftGear(-1);
      if (e.code === 'KeyD') this.shiftGear(1);
      if (e.code === 'KeyP') this.requestPit();

      // Direct Gear Selection
      if (e.code === 'Digit0') this.setGear(0);
      if (e.code === 'Digit1') this.setGear(1);
      if (e.code === 'Digit2') this.setGear(2);
      if (e.code === 'Digit3') this.setGear(3);
      if (e.code === 'Digit4') this.setGear(4);
      if (e.code === 'Digit5') this.setGear(5);
      if (e.code === 'Digit6') this.setGear(6);
    });
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    window.addEventListener('mousedown', initAudio);
    window.addEventListener('touchstart', initAudio);
  }

  setGear(gear: number) {
    if (this.state.pitPhase !== 'none') return;
    if (gear >= 0 && gear < GAME_CONFIG.GEARS.length) {
        this.state.gear = gear;
    }
  }

  shiftGear(dir: number) {
    if (this.state.pitPhase !== 'none') return; // Can't shift in pit
    const newGear = this.state.gear + dir;
    if (newGear >= 0 && newGear < GAME_CONFIG.GEARS.length) {
      this.state.gear = newGear;
    }
  }

  requestPit() {
    if (!this.state.isPitting) {
        this.state.pitMenuOpen = !this.state.pitMenuOpen;
    }
  }

  update(dt: number) {
    if (this.state.paused) return;

    // Crash Logic
    if (this.state.crashed) {
        this.state.crashTimer -= dt * 1000;
        this.state.speed *= 0.95; // Rapid deceleration
        
        if (this.state.crashTimer <= 0) {
            // Respawn
            this.state.crashed = false;
            this.state.playerX = 0;
            this.state.speed = 0;
            this.state.gear = 1;
            this.state.rpm = 1000;
        }
        return; // Lose control
    }

    // Pit Logic
    if (this.state.pitPhase === 'stopped') {
        this.state.pitTimer -= dt * 1000; // Convert dt (seconds) to ms
        if (this.state.pitTimer <= 0) {
            this.state.pitPhase = 'none'; // Exit pit immediately
            this.state.tires = 100;
            this.state.fuel = 100;
            this.state.isPitting = false;
            this.state.gear = 1; // Auto shift to 1st so player can move
            this.state.speed = 0;
        }
        return; // No movement in pit
    }

    const maxSpeed = GAME_CONFIG.GEARS[this.state.gear].maxSpeed;
    const accel = GAME_CONFIG.ACCEL;
    const breaking = GAME_CONFIG.BREAKING;
    const decel = GAME_CONFIG.DECEL;

    // Throttle / Brake
    if (!this.state.raceStarted) {
        // Can rev engine but not move
        if (this.keys['ArrowUp']) {
            this.state.rpm += (12000 - this.state.rpm) * 0.1;
        } else {
            this.state.rpm += (1000 - this.state.rpm) * 0.1;
        }
        return;
    }

    if (this.keys['ArrowUp']) {
      this.state.speed += accel;
    } else if (this.keys['ArrowDown']) {
      this.state.speed += breaking;
    } else {
      this.state.speed += decel;
    }

    // Gear limiting
    if (this.state.speed > maxSpeed) {
      this.state.speed -= accel * 2; // Engine braking/limiter
    }

    // Off-road
    if ((this.state.playerX < -1 || this.state.playerX > 1) && this.state.speed > GAME_CONFIG.OFF_ROAD_LIMIT) {
      this.state.speed += GAME_CONFIG.OFF_ROAD_DECEL;
      if (!this.state.crashed) {
          this.state.crashed = true;
          this.state.crashTimer = 2000; // 2 seconds crash sequence
      }
    }

    // Clamp speed
    this.state.speed = Math.max(0, Math.min(this.state.speed, GAME_CONFIG.MAX_SPEED)); // Cap at absolute max

    // Steering
    const dx = dt * 2 * (this.state.speed / GAME_CONFIG.MAX_SPEED);
    if (this.keys['ArrowLeft']) this.state.playerX -= dx;
    if (this.keys['ArrowRight']) this.state.playerX += dx;
    
    // Centrifugal force on curves
    const playerSegment = this.findSegment(this.state.position + GAME_CONFIG.PLAYER_Z);
    // Increased centrifugal force multiplier from 2 to 6
    this.state.playerX -= (dx * this.state.speed / GAME_CONFIG.MAX_SPEED * playerSegment.curve * 6); 

    this.state.playerX = Math.max(-2, Math.min(2, this.state.playerX));

    // Position & Lap
    this.state.position += this.state.speed;
    const trackSize = GAME_CONFIG.TRACK_LENGTH * GAME_CONFIG.SEGMENT_LENGTH;
    
    while (this.state.position >= trackSize) {
      this.state.position -= trackSize;
      this.state.lastLapTime = this.state.lapTime;
      if (this.state.bestLapTime === 0 || this.state.lapTime < this.state.bestLapTime) {
        this.state.bestLapTime = this.state.lapTime;
      }
      this.state.lapTime = 0;
      this.state.lap++;
      
      // Generate a new track layout for the next lap
      this.generateTrack();
      
      // Check for pit entry
      if (this.state.pitMenuOpen) {
          this.state.pitPhase = 'stopped';
          this.state.pitTimer = 3000; // 3 seconds for animation
          this.state.speed = 0;
          this.state.gear = 0; // Neutral
          this.state.pitMenuOpen = false;
          // Reset tires and fuel
          this.state.tires = 100;
          this.state.fuel = 100;
      }
    }
    while (this.state.position < 0) {
        this.state.position += trackSize;
    }

    // RPM Calculation
    // RPM is proportional to speed / maxSpeedForGear
    // But also has a base idle
    const gearRatio = GAME_CONFIG.GEARS[this.state.gear].ratio;
    // Simple approximation: RPM = (Speed / MaxSpeedOfGear) * MaxRPM
    // If neutral, RPM depends on throttle
    if (this.state.gear === 0) {
        this.state.rpm = this.keys['ArrowUp'] ? 12000 : 1000;
    } else {
        const gearMax = GAME_CONFIG.GEARS[this.state.gear].maxSpeed;
        const gearMin = GAME_CONFIG.GEARS[this.state.gear - 1]?.maxSpeed || 0;
        // Linear mapping for now
        this.state.rpm = (this.state.speed / gearMax) * 13000; // 13k redline
        if (this.state.rpm < 1000) this.state.rpm = 1000; // Idle
    }

    // Stats
    if (this.state.speed > 0) {
        this.state.lapTime += dt * 1000; // ms
        this.state.tires -= GAME_CONFIG.TIRE_WEAR_RATE * (this.state.speed / GAME_CONFIG.MAX_SPEED);
        this.state.fuel -= GAME_CONFIG.FUEL_CONSUMPTION * (this.state.speed / GAME_CONFIG.MAX_SPEED);
    }

    // Update Sound
    if (!this.state.muted) {
        this.soundEngine.update(this.state.rpm, this.state.speed, GAME_CONFIG.MAX_SPEED);
    } else {
        // Optional: Stop sound if muted
        // this.soundEngine.stop();
    }
  }

  findSegment(z: number): Segment {
    return this.segments[Math.floor(z / GAME_CONFIG.SEGMENT_LENGTH) % this.segments.length];
  }

  render() {
    const { width, height } = this.canvas;
    if (width === 0 || height === 0) return;

    this.ctx.clearRect(0, 0, width, height);
    
    // Sky
    this.ctx.fillStyle = '#3b82f6'; // Blue 500
    this.ctx.fillRect(0, 0, width, height / 2);
    
    // Ground
    this.ctx.fillStyle = '#10b981'; // Green 500
    this.ctx.fillRect(0, height / 2, width, height / 2);

    const baseSegment = this.findSegment(this.state.position);
    const basePercent = (this.state.position % GAME_CONFIG.SEGMENT_LENGTH) / GAME_CONFIG.SEGMENT_LENGTH;
    
    // Calculate Player Y (Camera Height)
    const playerY = baseSegment.p1.world.y + (baseSegment.p2.world.y - baseSegment.p1.world.y) * basePercent;
    const cameraHeight = GAME_CONFIG.CAMERA_HEIGHT + playerY;

    let dx = -(baseSegment.curve * basePercent);
    let x = 0;
    let maxY = height;

    for (let n = 0; n < GAME_CONFIG.DRAW_DISTANCE; n++) {
      const segment = this.segments[(baseSegment.index + n) % this.segments.length];
      const looped = segment.index < baseSegment.index;
      
      // Camera Z position relative to segment
      // If looped, add track length
      let segmentCameraZ = (segment.index * GAME_CONFIG.SEGMENT_LENGTH) - this.state.position;
      if (looped) {
          segmentCameraZ += GAME_CONFIG.TRACK_LENGTH * GAME_CONFIG.SEGMENT_LENGTH;
      }

      segment.p1.camera.z = segmentCameraZ;
      segment.p2.camera.z = segmentCameraZ + GAME_CONFIG.SEGMENT_LENGTH;

      // Project
      RenderUtils.project(segment.p1, (this.state.playerX * GAME_CONFIG.ROAD_WIDTH) - x, cameraHeight, 0, GAME_CONFIG.CAMERA_DEPTH, width, height, GAME_CONFIG.ROAD_WIDTH);
      RenderUtils.project(segment.p2, (this.state.playerX * GAME_CONFIG.ROAD_WIDTH) - x - dx, cameraHeight, 0, GAME_CONFIG.CAMERA_DEPTH, width, height, GAME_CONFIG.ROAD_WIDTH);

      x += dx;
      dx += segment.curve;

      if (segment.p1.camera.z <= GAME_CONFIG.CAMERA_DEPTH || 
          segment.p2.screen.y >= maxY || 
          segment.p2.screen.y >= segment.p1.screen.y) {
        continue;
      }

      RenderUtils.drawSegment(
        this.ctx, width, GAME_CONFIG.LANES,
        segment.p1.screen.x, segment.p1.screen.y, segment.p1.screen.w,
        segment.p2.screen.x, segment.p2.screen.y, segment.p2.screen.w,
        n / GAME_CONFIG.DRAW_DISTANCE, // fog
        segment.color
      );

      maxY = segment.p2.screen.y;
    }

    // Pit Animation
    if (this.state.pitPhase === 'stopped') {
        RenderUtils.drawPitCrew(this.ctx, width, height, this.state.pitTimer);
    }
  }
}
