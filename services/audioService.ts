import { CHAKRA_DATA } from "../constants";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Tides (Ambient Layer)
  private tideNode: AudioBufferSourceNode | null = null;
  private tideGain: GainNode | null = null;
  private tideFilter: BiquadFilterNode | null = null; 
  
  // Drone (Sub-bass Layer)
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  // Chakras (Harmonic Layer)
  private chakraOscs: OscillatorNode[] = [];
  private chakraGains: GainNode[] = [];
  private isMuted: boolean = false;

  // Generate White Noise (Standard amplitude) -> We will filter this heavily
  // This ensures consistent volume across devices compared to custom Brown noise algorithms
  private createNoiseBuffer(bufferSize: number): AudioBuffer {
    if (!this.ctx) throw new Error("No Context");
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      // Standard white noise [-1, 1]
      data[i] = (Math.random() * 2 - 1) * 0.5; 
    }
    return buffer;
  }

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.8; // Stronger master volume

    this.setupDrone();
    this.setupTides();
    this.setupChakras();
  }

  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private setupDrone() {
    if (!this.ctx || !this.masterGain) return;
    
    // Deep Sine/Triangle mix for "Space" hum
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'triangle'; // Triangle cuts through better than sine on small speakers
    this.droneOsc.frequency.value = 55; // A1
    
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 150; // Soften the triangle wave

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.1; // Base presence
    
    this.droneOsc.connect(lowpass);
    lowpass.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOsc.start();
  }

  private setupTides() {
    if (!this.ctx || !this.masterGain) return;
    
    const bufferSize = 5 * this.ctx.sampleRate;
    const noiseBuffer = this.createNoiseBuffer(bufferSize);
    
    this.tideNode = this.ctx.createBufferSource();
    this.tideNode.buffer = noiseBuffer;
    this.tideNode.loop = true;
    
    // Filter Strategy:
    // We use a Lowpass filter to turn White Noise into "Ocean/Space" noise.
    // Idle: 300Hz (Audible texture, not just sub-bass)
    // Active: 1200Hz (Rushing air/water)
    this.tideFilter = this.ctx.createBiquadFilter();
    this.tideFilter.type = 'lowpass';
    this.tideFilter.frequency.value = 300; 
    this.tideFilter.Q.value = 0.7;

    this.tideGain = this.ctx.createGain();
    // Start audible! 0.15 is background, 0.5 is full
    this.tideGain.gain.value = 0.15; 

    this.tideNode.connect(this.tideFilter);
    this.tideFilter.connect(this.tideGain);
    this.tideGain.connect(this.masterGain);
    
    this.tideNode.start();
    
    // Breathing LFO
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // Slow breathing
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.05; // Subtle amplitude modulation
    
    lfo.connect(lfoGain);
    lfoGain.connect(this.tideGain.gain);
    lfo.start();
  }

  private setupChakras() {
    if (!this.ctx || !this.masterGain) return;
    
    CHAKRA_DATA.forEach((chakra, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const panner = this.ctx!.createStereoPanner();
      
      osc.type = 'sine';
      osc.frequency.value = chakra.frequency;
      osc.detune.value = (Math.random() - 0.5) * 8; 

      const panPos = ((index / (CHAKRA_DATA.length - 1)) * 2) - 1;
      panner.pan.value = panPos * 0.5;

      gain.gain.value = 0; // Start silent
      
      osc.connect(panner);
      panner.connect(gain);
      gain.connect(this.masterGain!);
      osc.start();
      
      this.chakraOscs.push(osc);
      this.chakraGains.push(gain);
    });
  }

  public setResonance(level: number) {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const currentTime = this.ctx.currentTime;
    const clampedLevel = Math.max(0, Math.min(1, level));

    // 1. TIDE DYNAMICS (Background to Foreground)
    if (this.tideGain && this.tideFilter) {
      // Gain: 0.15 (Idle) -> 0.6 (Full)
      const targetGain = 0.15 + (clampedLevel * 0.45);
      this.tideGain.gain.setTargetAtTime(targetGain, currentTime, 0.2);

      // Filter: 300Hz (Deep) -> 1500Hz (Bright/Rushing)
      // This removes the "Cicada" (high freq) but keeps the "Whoosh"
      const targetFreq = 300 + (clampedLevel * 1200);
      this.tideFilter.frequency.setTargetAtTime(targetFreq, currentTime, 0.2);
    }

    // 2. CHAKRA HARMONICS
    const activeIndex = clampedLevel * 7;
    
    this.chakraGains.forEach((g, i) => {
      if (i <= activeIndex && clampedLevel > 0.05) {
        // Smooth swell
        const baseVol = 0.12 * (1 - i * 0.1); // Lower chakras louder
        g.gain.setTargetAtTime(baseVol, currentTime, 0.5); 
      } else {
        g.gain.setTargetAtTime(0, currentTime, 0.3);
      }
    });
  }

  public triggerTone(index: number) {
    if (!this.ctx || !this.chakraGains[index]) return;
    const g = this.chakraGains[index];
    g.gain.cancelScheduledValues(this.ctx.currentTime);
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.8, this.ctx!.currentTime, 0.2);
    }
  }
}

export const audioService = new AudioEngine();