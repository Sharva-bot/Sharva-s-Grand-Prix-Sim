export class SoundEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  engineOsc: OscillatorNode | null = null;
  engineGain: GainNode | null = null;
  modulatorOsc: OscillatorNode | null = null;
  modulatorGain: GainNode | null = null;
  noiseNode: AudioBufferSourceNode | null = null;
  noiseGain: GainNode | null = null;
  isInitialized: boolean = false;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4; // Master volume
    this.masterGain.connect(this.ctx.destination);
  }

  async init() {
    if (this.isInitialized) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    
    // --- Engine Tone Synthesis ---
    // We'll use FM synthesis for a grittier engine sound
    // Carrier: Sawtooth (The main tone)
    // Modulator: Sine (Vibrato/Growl)

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 100;
    
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    // Modulator for growl
    this.modulatorOsc = this.ctx.createOscillator();
    this.modulatorOsc.type = 'sine';
    this.modulatorOsc.frequency.value = 50; // Half of base freq often sounds good (sub-octave)
    
    this.modulatorGain = this.ctx.createGain();
    this.modulatorGain.gain.value = 50; // Modulation depth

    // Connect Modulator -> Carrier Frequency
    this.modulatorOsc.connect(this.modulatorGain);
    this.modulatorGain.connect(this.engineOsc.frequency);

    // Filter for engine (muffle high freq)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 1;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
    this.modulatorOsc.start();

    // --- Road/Wind Noise ---
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;
    
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1;

    this.noiseNode.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);
    this.noiseNode.start();

    this.isInitialized = true;
  }

  update(rpm: number, speed: number, maxSpeed: number) {
    if (!this.isInitialized) return;

    // RPM range: 1000 - 13000
    // Freq range: 60Hz - 600Hz
    const normalizedRpm = Math.max(0, rpm / 13000);
    const baseFreq = 60 + (normalizedRpm * 500);

    if (this.engineOsc && this.modulatorOsc) {
        // Smooth transition
        const time = this.ctx.currentTime + 0.05;
        this.engineOsc.frequency.exponentialRampToValueAtTime(baseFreq, time);
        
        // Modulator follows carrier but at a ratio (e.g. 0.5 for sub-octave growl)
        this.modulatorOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, time);
        
        // Modulation depth increases with RPM for more "scream"
        if (this.modulatorGain) {
            this.modulatorGain.gain.setTargetAtTime(normalizedRpm * 100, this.ctx.currentTime, 0.1);
        }
    }
    
    // Engine Volume
    if (this.engineGain) {
        // Idle volume lower, high RPM louder
        const vol = 0.1 + (normalizedRpm * 0.3);
        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    }

    // Road Noise
    if (this.noiseGain) {
        const speedRatio = speed / maxSpeed;
        const noiseVol = Math.min(0.4, speedRatio * 0.4);
        this.noiseGain.gain.setTargetAtTime(noiseVol, this.ctx.currentTime, 0.1);
    }
  }
}
