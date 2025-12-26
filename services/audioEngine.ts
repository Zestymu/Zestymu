
import { SynthParams, LFOShape, CorruptionType, EnvelopeCurve, FilterType, LFOTarget } from '../types';

export class EldritchAudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private masterPanner: StereoPannerNode;
  private analyser: AnalyserNode;
  private limiter: DynamicsCompressorNode;
  private reverb: ConvolverNode;
  private reverbWet: GainNode;
  private mixBus: GainNode;
  private dryGain: GainNode;
  
  // M/S Width Processing Nodes
  private widthSideGain: GainNode;
  
  // Track active sources for stopping and frequency params for bending
  private activeSources: Set<AudioScheduledSourceNode> = new Set();
  private activePitchParams: Set<{ param: AudioParam; baseVal: number }> = new Set();
  
  private currentBend: number = 1.0;
  private lastVoidDecay: number = -1;
  private isReverbGenerating: boolean = false;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Graph Architecture:
    // Voices -> MixBus
    // MixBus -> DryGain -> MS_Matrix
    // MixBus -> Reverb -> WetGain -> MS_Matrix
    // MS_Matrix (Width Control) -> MasterGain -> MasterPanner -> Limiter -> Destination

    this.mixBus = this.ctx.createGain();
    this.dryGain = this.ctx.createGain();
    
    // Reverb Setup
    this.reverb = this.ctx.createConvolver();
    this.reverbWet = this.ctx.createGain();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.masterPanner = this.ctx.createStereoPanner();
    this.limiter = this.ctx.createDynamicsCompressor();
    this.analyser = this.ctx.createAnalyser();

    // Default values
    this.masterGain.gain.value = 0.7;
    this.reverbWet.gain.value = 0;
    this.dryGain.gain.value = 1;

    // --- M/S Width Processing Matrix ---
    // This allows true control over the stereo field width for both dry and wet signals
    const splitter = this.ctx.createChannelSplitter(2);
    const merger = this.ctx.createChannelMerger(2);
    
    // Mid (L+R) Calculation
    const midSum = this.ctx.createGain(); // Sum L+R
    const midGain = this.ctx.createGain(); // Mid Level
    
    // Side (L-R) Calculation
    const sideSum = this.ctx.createGain(); 
    const sideInvert = this.ctx.createGain(); // Invert R for subtraction
    this.widthSideGain = this.ctx.createGain(); // This controls WIDTH
    const sideInvert2 = this.ctx.createGain(); // Invert Side for R decoding
    
    // Configure Gains for Matrix
    sideInvert.gain.value = -1;
    sideInvert2.gain.value = -1;
    midSum.gain.value = 0.5; // Scale to avoid clipping
    sideSum.gain.value = 0.5;
    
    // Routing: MixBus -> Dry/Wet -> Splitter
    const preMaster = this.ctx.createGain();
    this.mixBus.connect(this.dryGain);
    this.mixBus.connect(this.reverb);
    this.reverb.connect(this.reverbWet);
    
    this.dryGain.connect(preMaster);
    this.reverbWet.connect(preMaster);
    
    preMaster.connect(splitter);

    // Encoding M/S
    // Mid = (L + R) * 0.5
    splitter.connect(midSum, 0); // L
    splitter.connect(midSum, 1); // R
    
    // Side = (L - R) * 0.5
    splitter.connect(sideSum, 0); // L
    splitter.connect(sideInvert, 1); // R -> Invert
    sideInvert.connect(sideSum);

    // Processing
    midSum.connect(midGain);
    sideSum.connect(this.widthSideGain);

    // Decoding back to L/R
    // L = Mid + Side
    midGain.connect(merger, 0, 0);
    this.widthSideGain.connect(merger, 0, 0);

    // R = Mid - Side
    midGain.connect(merger, 0, 1);
    this.widthSideGain.connect(sideInvert2);
    sideInvert2.connect(merger, 0, 1);

    // Final Output Chain
    merger.connect(this.masterGain);
    this.masterGain.connect(this.masterPanner);
    this.masterPanner.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Initialize with a default short reverb
    this.updateReverbBuffer(3.0);
  }

  private async updateReverbBuffer(duration: number) {
    if (this.isReverbGenerating) return;
    this.isReverbGenerating = true;
    try {
        const buffer = await this.initReverb(this.ctx, duration);
        this.reverb.buffer = buffer;
    } finally {
        this.isReverbGenerating = false;
    }
  }

  private async initReverb(ctx: BaseAudioContext, duration: number): Promise<AudioBuffer> {
    const length = ctx.sampleRate * Math.max(0.1, duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        // Create an organic decay curve with some cosmic "jitter"
        // Reduced power from 4 to 2 for louder, fuller tail
        const decay = Math.pow(1 - i / length, 2.5);
        const noise = (Math.random() * 2 - 1);
        // Add low frequency "rumble" to the impulse for deep voids
        const modulation = Math.sin(i * 0.0005) * 0.5 + 0.5;
        // Boost gain slightly
        data[i] = noise * decay * modulation * 0.8;
      }
    }
    return impulse;
  }

  public getAnalyser() { return this.analyser; }
  public getContext() { return this.ctx; }

  public updateMasterSpatial(pan: number) {
    if (this.masterPanner) {
      this.masterPanner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.1);
    }
  }

  public updateStereoWidth(width: number) {
     if (this.widthSideGain) {
         // Map 0-1 to a reasonable gain range (0 = mono, 1 = normal stereo, >1 = extra wide)
         // Let's allow hyper-width up to 2.0x for 1.0 input
         const targetGain = width * 1.5; 
         this.widthSideGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
     }
  }

  public updateMasterVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }
  }

  public setPitchBend(multiplier: number) {
    this.currentBend = multiplier;
    const t = this.ctx.currentTime;
    
    this.activePitchParams.forEach(({ param, baseVal }) => {
      try {
        // Cancel scheduled values to override potential glides/envelopes for immediate control
        param.cancelScheduledValues(t);
        param.setTargetAtTime(baseVal * this.currentBend, t, 0.1);
      } catch (e) {}
    });
  }

  // Helper to handle pitch glide/portamento
  private setPitch(param: AudioParam, targetFreq: number, t: number, p: SynthParams) {
    if (p.slideFrom && p.slideTime && p.slideTime > 0 && p.pitch > 0) {
      // Calculate the ratio of the target frequency relative to the root pitch
      // This ensures that harmonics glide correctly in parallel
      const harmonicRatio = targetFreq / p.pitch;
      const startFreq = p.slideFrom * harmonicRatio;
      
      param.cancelScheduledValues(t);
      param.setValueAtTime(startFreq, t);
      param.exponentialRampToValueAtTime(targetFreq, t + p.slideTime);
    } else {
      param.setValueAtTime(targetFreq, t);
    }
  }

  private registerVoice(duration: number, sources: AudioScheduledSourceNode[], freqParams: { param: AudioParam, baseVal: number }[]) {
    sources.forEach(s => this.activeSources.add(s));
    freqParams.forEach(i => this.activePitchParams.add(i));

    setTimeout(() => {
      sources.forEach(s => this.activeSources.delete(s));
      freqParams.forEach(i => this.activePitchParams.delete(i));
    }, duration * 1000 + 1000);
  }

  public stopAll() {
    const t = this.ctx.currentTime;
    
    this.masterGain.gain.cancelScheduledValues(t);
    // Increased time constant for natural fade out
    this.masterGain.gain.setTargetAtTime(0, t, 0.2);
    
    this.reverbWet.gain.cancelScheduledValues(t);
    this.reverbWet.gain.setTargetAtTime(0, t, 0.2);

    this.activeSources.forEach(s => {
      try {
        s.stop(t + 0.6);
      } catch (e) {}
    });
    this.activeSources.clear();
    this.activePitchParams.clear();
  }

  private getCurve(type: EnvelopeCurve, start: number, end: number, steps: number = 50): Float32Array {
    const curve = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      let val = 0;
      switch (type) {
        case 'exponential':
          val = Math.pow(0.001, 1 - t);
          break;
        case 'logarithmic':
          val = 1 - Math.pow(0.001, t);
          break;
        case 's-curve':
          val = t * t * (3 - 2 * t);
          break;
        case 'linear':
        default:
          val = t;
          break;
      }
      curve[i] = start + (end - start) * val;
    }
    return curve;
  }

  private applyADSR(ctx: BaseAudioContext, param: AudioParam, peakValue: number, p: SynthParams) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(0.0001, param.value), t);
    
    const attackEnd = t + p.attack;
    const decayEnd = attackEnd + p.decay;
    const sustainLevel = peakValue * p.sustain;
    const releaseEnd = decayEnd + p.release;

    if (p.decayCurve === 'linear') {
      param.linearRampToValueAtTime(peakValue, attackEnd);
      param.linearRampToValueAtTime(Math.max(0.0001, sustainLevel), decayEnd);
      param.linearRampToValueAtTime(0, releaseEnd);
    } else if (p.decayCurve === 'exponential' && sustainLevel > 0) {
      param.exponentialRampToValueAtTime(peakValue, attackEnd);
      param.exponentialRampToValueAtTime(Math.max(0.0001, sustainLevel), decayEnd);
      param.exponentialRampToValueAtTime(0.0001, releaseEnd);
    } else {
      param.setValueCurveAtTime(this.getCurve(p.decayCurve, 0, peakValue), t, p.attack);
      param.setValueCurveAtTime(this.getCurve(p.decayCurve, peakValue, sustainLevel), attackEnd, p.decay);
      param.setValueCurveAtTime(this.getCurve(p.decayCurve, sustainLevel, 0), decayEnd, p.release);
    }
  }

  private createGlobalLFO(ctx: BaseAudioContext, p: SynthParams, baseValue: number) {
    if (p.lfoDepth <= 0 || p.lfoTarget === 'none' || !p.lfoActive) return null;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = p.lfoShape;
    lfo.frequency.value = p.lfoRate;
    lfoGain.gain.value = baseValue * p.lfoDepth;
    lfo.connect(lfoGain);
    lfo.start();
    return { node: lfo, gain: lfoGain };
  }

  private makeDistortionCurve(type: CorruptionType, amount: number) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      switch (type) {
        case 'overdrive':
          const kDrive = amount * 100;
          curve[i] = (3 + kDrive) * x * 20 * (Math.PI / 180) / (Math.PI + kDrive * Math.abs(x));
          break;
        case 'fuzz':
          const fuzzK = amount * 25;
          curve[i] = Math.tanh(x * fuzzK);
          break;
        case 'bitcrush':
          const bits = 8 - (amount * 7);
          const steps = Math.pow(2, bits);
          curve[i] = Math.round(x * steps) / steps;
          break;
        case 'void_grit':
          const foldK = 1 + amount * 8;
          const val = x * foldK;
          curve[i] = val > 1 ? 2 - val : (val < -1 ? -2 - val : val);
          curve[i] = Math.max(-1, Math.min(1, curve[i]));
          break;
        default:
          curve[i] = x;
      }
    }
    return curve;
  }

  public trigger(params: SynthParams) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    
    // Master Params Update
    this.updateMasterVolume(params.masterVolume);
    this.updateMasterSpatial(params.pan);
    this.updateStereoWidth(params.stereo);
    
    // Check Void activation
    const voidAmt = params.voidActive ? params.theVoid : 0;
    this.reverbWet.gain.setTargetAtTime(voidAmt, t, 0.1);
    
    if (params.voidActive) {
        // Optimized Reverb: Only regenerate if decay changed significantly (> 5%)
        if (Math.abs(params.voidDecay - this.lastVoidDecay) > 0.05) {
            // Cap at 10s max for performance, min 0.5s
            const reverbTime = 0.5 + params.voidDecay * 9.5;
            this.updateReverbBuffer(reverbTime);
            this.lastVoidDecay = params.voidDecay;
        }
    }
    
    // All sounds now go through MixBus for global processing
    this.runEngine(params, this.ctx, this.mixBus, true);
  }

  private runEngine(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean) {
    const t = ctx.currentTime;
    const inputBus = ctx.createGain();
    
    // Main filter setup
    const mainFilter = ctx.createBiquadFilter();
    mainFilter.type = p.filterType;
    mainFilter.frequency.setValueAtTime(p.filterCutoff, t);
    mainFilter.Q.setValueAtTime(p.filterResonance, t);

    // Flesh/Corruption Module
    const preFilter = ctx.createBiquadFilter();
    const distortionNode = ctx.createWaveShaper();
    const postFilter = ctx.createBiquadFilter();
    const distGain = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();

    if (p.fleshActive) {
        preFilter.type = p.corruptionType === 'fuzz' ? 'lowpass' : 'highpass';
        preFilter.frequency.setValueAtTime(p.corruptionType === 'fuzz' ? 1000 : 300, t);
        preFilter.Q.value = 1.0 + p.corruption * 5;
        distortionNode.curve = this.makeDistortionCurve(p.corruptionType, p.corruption);
        postFilter.type = 'lowpass';
        const cutoff = p.corruptionType === 'bitcrush' ? 4000 : 8000;
        postFilter.frequency.setValueAtTime(cutoff - (p.corruption * 3000), t);
        distGain.gain.setValueAtTime(1.0 + (p.corruption * 0.5), t);

        const mix = p.corruptionMix ?? 0.5;
        dryGain.gain.setValueAtTime(Math.cos(mix * Math.PI * 0.5), t);
        wetGain.gain.setValueAtTime(Math.sin(mix * Math.PI * 0.5), t);

        inputBus.connect(dryGain);
        inputBus.connect(preFilter);
        preFilter.connect(distortionNode);
        distortionNode.connect(postFilter);
        postFilter.connect(distGain);
        distGain.connect(wetGain);
    } else {
        dryGain.gain.setValueAtTime(1, t);
        inputBus.connect(dryGain);
    }

    // Connect to Main Filter if active, else bypass to destination
    if (p.filterActive) {
      dryGain.connect(mainFilter);
      if (p.fleshActive) wetGain.connect(mainFilter);
      mainFilter.connect(dest);
    } else {
      dryGain.connect(dest);
      if (p.fleshActive) wetGain.connect(dest);
    }

    // Erosion handling: Override params if inactive
    const effectiveParams = { ...p };
    if (!p.erosionActive) {
        effectiveParams.madness = 0;
        effectiveParams.dissonance = 0;
    }

    // Global LFO Routing Logic (Check activity)
    let globalLfo: { node: OscillatorNode; gain: GainNode } | null = null;
    if (p.lfoActive && p.lfoTarget !== 'none') {
        switch (p.lfoTarget) {
            case 'cutoff':
                globalLfo = this.createGlobalLFO(ctx, p, p.filterCutoff);
                if (globalLfo) globalLfo.gain.connect(mainFilter.frequency);
                break;
            case 'resonance':
                globalLfo = this.createGlobalLFO(ctx, p, p.filterResonance);
                if (globalLfo) globalLfo.gain.connect(mainFilter.Q);
                break;
            case 'pan':
                globalLfo = this.createGlobalLFO(ctx, p, 1.0);
                if (globalLfo) globalLfo.gain.connect(this.masterPanner.pan);
                break;
            case 'pitch':
                globalLfo = this.createGlobalLFO(ctx, p, p.pitch * 0.2);
                break;
            case 'viscosity':
                globalLfo = this.createGlobalLFO(ctx, p, 10);
                if (globalLfo) globalLfo.gain.connect(mainFilter.Q);
                break;
            case 'madness':
                globalLfo = this.createGlobalLFO(ctx, p, 5);
                if (globalLfo) globalLfo.gain.connect(preFilter.Q);
                break;
            case 'corruption':
                globalLfo = this.createGlobalLFO(ctx, p, 0.5);
                if (globalLfo) globalLfo.gain.connect(wetGain.gain);
                break;
        }
    }

    // Run Engine with potentially sanitized/bypassed params
    switch (p.engine) {
      case 'RLYEH': 
      case 'DAGON':
      case 'STAR_SPAWN':
      case 'HALI':
        this.engineRlyeh(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'SHOGGOTH': 
      case 'BYAKHEE':
      case 'UBBO_SATHLA':
      case 'RHAN_TEGOTH':
        this.engineShoggoth(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'AZATHOTH': 
      case 'OUTER_VOID':
        this.engineAzathoth(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'NYARLATHOTEP': this.engineNyarlathotep(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'VOID': 
      case 'LLOIGOR':
      case 'CARCOSA':
      case 'TIME_BEYOND':
      case 'BEYOND_GATE':
      case 'COSMIC_ECHO':
        this.engineVoid(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'ELDRITCH_BELL':
      case 'KADATH':
        this.engineBell(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'WHISPERING_TIDE': 
      case 'ITHAQUA':
      case 'POLYP':
      case 'LENG':
        this.engineWhisper(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'CREATURE_ROAR': 
      case 'GHOL':
      case 'GHATANOTHOA':
        this.engineRoar(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'ABYSS_BENTHIC': 
      case 'TSATHOGGUA':
      case 'NKAI':
      case 'NAMELESS_CITY':
      case 'ABYSSAL_PLAINS':
        this.engineBenthic(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'YOG_SOTHOTH': 
      case 'YITH':
      case 'PNAKOTIC':
        this.engineYogSothoth(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'HASTUR': 
      case 'TINDALOS':
      case 'SHANTAK':
      case 'YUGGOTH':
        this.engineHastur(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'SHUB_NIGGURATH': this.engineShubNiggurath(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      case 'ERICH_ZANN':
        this.engineZann(effectiveParams, ctx, inputBus, isRealtime, globalLfo); break;
      default: this.engineRlyeh(effectiveParams, ctx, inputBus, isRealtime, globalLfo);
    }
  }

  private engineZann(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    // Chaotic string-like sound using FM and filtered noise
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    this.setPitch(osc.frequency, p.pitch, t, p);
    
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 12 + (p.madness * 20);
    vibratoGain.gain.value = p.pitch * 0.2 * p.dissonance;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(t);

    const env = ctx.createGain();
    this.applyADSR(ctx, env.gain, 0.7, p);
    osc.connect(env);
    env.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) this.registerVoice(duration, [osc, vibrato], [{ param: osc.frequency, baseVal: p.pitch }]);
    osc.start(t);
    osc.stop(t + duration);
    vibrato.stop(t + duration);
  }

  private engineBenthic(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lpf = ctx.createBiquadFilter();
    const env = ctx.createGain();
    osc.type = 'sine';
    this.setPitch(osc.frequency, p.pitch, t, p);
    
    // Erosion: Dissonance affects pitch drift
    if (p.erosionActive && p.dissonance > 0.1) {
       osc.detune.setValueAtTime((Math.random() - 0.5) * p.dissonance * 300, t);
    }
    
    // Erosion: Madness affects filter wobbling
    if (p.erosionActive && p.madness > 0.1) {
        const wobble = ctx.createOscillator();
        wobble.frequency.value = 0.5 + p.madness * 8;
        const wobbleGain = ctx.createGain();
        wobbleGain.gain.value = p.pitch * p.madness * 2;
        wobble.connect(wobbleGain);
        wobbleGain.connect(lpf.frequency);
        wobble.start(t);
        wobble.stop(t + p.attack + p.decay + p.release);
    }

    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(p.pitch * 2, t);
    const baseQ = 20 * p.viscosity;
    lpf.Q.value = baseQ;
    
    this.applyADSR(ctx, env.gain, 0.9, p);
    osc.connect(lpf);
    lpf.connect(env);
    env.connect(dest);
    const duration = p.attack + p.decay + p.release;
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) {
        this.registerVoice(duration, [osc], [
            { param: osc.frequency, baseVal: p.pitch },
            { param: lpf.frequency, baseVal: p.pitch * 2 } // Allow filter to warp too
        ]);
    }
    osc.start(t);
    osc.stop(t + duration);
  }

  private engineYogSothoth(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const bufferSize = ctx.sampleRate * Math.max(0.1, duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const paramsToBend = [];

    for (let i = 0; i < 3; i++) {
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      const f = p.pitch * (1 + i * 0.5);
      
      bpf.frequency.setValueAtTime(f, t);
      
      const baseQ = 50 * p.viscosity;
      bpf.Q.value = baseQ;
      
      const env = ctx.createGain();
      this.applyADSR(ctx, env.gain, 0.3, p);
      noise.connect(bpf);
      bpf.connect(env);
      env.connect(dest);
      
      paramsToBend.push({ param: bpf.frequency, baseVal: f });
      if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(bpf.frequency);
    }
    
    if (isRealtime) this.registerVoice(duration, [noise], paramsToBend);
    noise.start(t);
  }

  private engineHastur(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const osc = ctx.createOscillator();
    const fm = ctx.createOscillator();
    const fmGain = ctx.createGain();
    osc.type = 'triangle';
    this.setPitch(osc.frequency, p.pitch, t, p);
    
    fm.type = 'sine';
    const fmFreq = p.pitch * 1.5;
    this.setPitch(fm.frequency, fmFreq, t, p);
    
    fmGain.gain.setValueAtTime(p.pitch * p.dissonance * 5, t);
    fm.connect(fmGain);
    fmGain.connect(osc.frequency);
    const env = ctx.createGain();
    this.applyADSR(ctx, env.gain, 0.6, p);
    osc.connect(env);
    env.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) this.registerVoice(duration, [osc, fm], [
        { param: osc.frequency, baseVal: p.pitch },
        { param: fm.frequency, baseVal: fmFreq }
    ]);
    osc.start(t);
    fm.start(t);
    osc.stop(t + duration);
    fm.stop(t + duration);
  }

  private engineShubNiggurath(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    this.setPitch(osc.frequency, p.pitch, t, p);
    const env = ctx.createGain();
    this.applyADSR(ctx, env.gain, 0.8, p);
    osc.connect(env);
    env.connect(dest);
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) this.registerVoice(duration, [osc], [{ param: osc.frequency, baseVal: p.pitch }]);
    osc.start(t);
    osc.stop(t + duration);
  }

  private engineBell(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const ratios = [1, 1.414, 1.91, 2.34, 3.12, 4.05];
    const oscs: AudioScheduledSourceNode[] = [];
    const paramsToBend: { param: AudioParam, baseVal: number }[] = [];

    ratios.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = 'sine';
      const baseFreq = p.pitch * ratio * (1 + (Math.random() - 0.5) * p.dissonance * 0.1);
      
      this.setPitch(osc.frequency, baseFreq, t, p);
      
      panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
      this.applyADSR(ctx, env.gain, 0.15 / (i + 1), p);
      osc.connect(env);
      env.connect(panner);
      panner.connect(dest);
      
      oscs.push(osc);
      paramsToBend.push({ param: osc.frequency, baseVal: baseFreq });
      if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);

      osc.start(t);
      osc.stop(t + duration + 1);
    });
    
    if (isRealtime) this.registerVoice(duration, oscs, paramsToBend);
  }

  private engineWhisper(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const bufferSize = ctx.sampleRate * Math.max(0.1, duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bpf = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(p.pitch, t);
    const baseQ = 30 * (1 - p.viscosity);
    bpf.Q.value = baseQ;
    panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
    const env = ctx.createGain();
    this.applyADSR(ctx, env.gain, 0.4, p);
    noise.connect(bpf);
    bpf.connect(env);
    env.connect(panner);
    panner.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(bpf.frequency);
    if (isRealtime) this.registerVoice(duration, [noise], [{ param: bpf.frequency, baseVal: p.pitch }]);
    noise.start(t);
  }

  private engineRoar(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const osc = ctx.createOscillator();
    const lpf = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    const baseFreq = p.pitch;
    
    // Roar has specific pitch envelope, but we apply glide start logic
    if (p.slideFrom && p.slideTime) {
         osc.frequency.setValueAtTime(p.slideFrom, t);
         osc.frequency.exponentialRampToValueAtTime(baseFreq, t + p.slideTime);
    } else {
         osc.frequency.setValueAtTime(baseFreq, t);
    }
    
    // Roar drop
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, baseFreq * 0.3), t + duration * 0.8);
    
    const lpfFreq = p.pitch * 10;
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(lpfFreq, t);
    lpf.frequency.exponentialRampToValueAtTime(50, t + duration * 0.5);
    const baseQ = 15 * p.viscosity;
    lpf.Q.value = baseQ;
    panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
    this.applyADSR(ctx, env.gain, 0.8, p);
    osc.connect(lpf);
    lpf.connect(env);
    env.connect(panner);
    panner.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) this.registerVoice(duration, [osc], [
        { param: osc.frequency, baseVal: baseFreq },
        { param: lpf.frequency, baseVal: lpfFreq }
    ]);
    osc.start(t);
    osc.stop(t + duration);
  }

  private engineRlyeh(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const lpf = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    osc.type = 'sawtooth';
    const baseFreq = p.pitch;

    // Glide Logic
    if (p.slideFrom && p.slideTime) {
         osc.frequency.setValueAtTime(p.slideFrom, t);
         osc.frequency.exponentialRampToValueAtTime(baseFreq, t + p.slideTime);
    } else {
         osc.frequency.setValueAtTime(baseFreq, t);
    }
    
    // Erosion: Dissonance affects slight drift/detune of the main osc
    if (p.erosionActive && p.dissonance > 0) {
        osc.detune.setValueAtTime((Math.random() - 0.5) * p.dissonance * 100, t);
    }

    // Erosion: Madness creates an FM wobble
    if (p.erosionActive && p.madness > 0.05) {
        const madnessLFO = ctx.createOscillator();
        const madnessGain = ctx.createGain();
        madnessLFO.frequency.value = 8 + (Math.random() * 10);
        madnessGain.gain.value = p.madness * 30;
        madnessLFO.connect(madnessGain);
        madnessGain.connect(osc.frequency);
        madnessLFO.start(t);
        madnessLFO.stop(t + duration);
    }

    // Rlyeh slight detune drift built-in
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, baseFreq * 0.8), t + duration);
    
    const lpfFreq = baseFreq * 4;
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(lpfFreq, t);
    lpf.frequency.exponentialRampToValueAtTime(100, t + duration);
    const baseQ = 10 * p.viscosity;
    lpf.Q.value = baseQ;
    panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
    this.applyADSR(ctx, env.gain, 0.5, p);
    osc.connect(lpf);
    lpf.connect(env);
    env.connect(panner);
    panner.connect(dest);
    
    // Create a secondary dissonant voice if erosion is high
    if (p.erosionActive && p.dissonance > 0.3) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sawtooth';
        // Create an interval (e.g., tritone or minor second) based on dissonance
        const interval = 1 + (p.dissonance * 0.5); 
        osc2.frequency.setValueAtTime(baseFreq * interval, t);
        const env2 = ctx.createGain();
        this.applyADSR(ctx, env2.gain, 0.2 * p.dissonance, p); // quieter
        osc2.connect(lpf); // route through same filter
        osc2.start(t);
        osc2.stop(t + duration);
    }
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) this.registerVoice(duration, [osc], [
        { param: osc.frequency, baseVal: baseFreq },
        { param: lpf.frequency, baseVal: lpfFreq }
    ]);
    osc.start(t);
    osc.stop(t + duration + 0.5);
  }

  private engineShoggoth(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const env = ctx.createGain();
    const panner = ctx.createStereoPanner();
    carrier.type = 'sine';
    const baseFreq = p.pitch;
    
    this.setPitch(carrier.frequency, baseFreq, t, p);
    
    modulator.type = 'triangle';
    const modFreq = baseFreq * 0.5;
    this.setPitch(modulator.frequency, modFreq, t, p);
    
    const lfoNode = ctx.createOscillator();
    const lfoGainNode = ctx.createGain();
    lfoNode.frequency.value = p.madness * 10;
    lfoGainNode.gain.value = baseFreq * p.corruption * 5;
    lfoNode.connect(lfoGainNode);
    lfoGainNode.connect(modGain.gain);
    lfoNode.start(t);
    modGain.gain.value = baseFreq * p.corruption;
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
    this.applyADSR(ctx, env.gain, 0.4, p);
    carrier.connect(env);
    env.connect(panner);
    panner.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(carrier.frequency);
    if (isRealtime) this.registerVoice(duration, [carrier, modulator, lfoNode], [
        { param: carrier.frequency, baseVal: baseFreq },
        { param: modulator.frequency, baseVal: modFreq }
    ]);
    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + duration);
    modulator.stop(t + duration);
    lfoNode.stop(t + duration);
  }

  private engineAzathoth(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const count = 5;
    const oscs: AudioScheduledSourceNode[] = [];
    const paramsToBend: { param: AudioParam, baseVal: number }[] = [];

    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = 'sine';
      const baseFreq = p.pitch * (1 + i * 0.3 * p.dissonance);
      
      this.setPitch(osc.frequency, baseFreq, t, p);
      
      const trem = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5 + (p.madness * 20);
      lfo.connect(trem.gain);
      lfo.start(t);
      panner.pan.setValueAtTime(((i / count) * 2 - 1) * p.stereo, t);
      this.applyADSR(ctx, env.gain, 0.1, p);
      osc.connect(trem);
      trem.connect(env);
      env.connect(panner);
      panner.connect(dest);
      
      oscs.push(osc);
      oscs.push(lfo);
      paramsToBend.push({ param: osc.frequency, baseVal: baseFreq });
      if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);

      osc.start(t);
      osc.stop(t + duration);
      lfo.stop(t + duration);
    }
    if (isRealtime) this.registerVoice(duration, oscs, paramsToBend);
  }

  private engineNyarlathotep(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const bufferSize = ctx.sampleRate * Math.max(0.1, duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bpf = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(p.pitch, t);
    const baseQ = 50 * (1 - p.viscosity);
    bpf.Q.value = baseQ;
    panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
    const env = ctx.createGain();
    this.applyADSR(ctx, env.gain, 0.5, p);
    noise.connect(bpf);
    bpf.connect(env);
    env.connect(panner);
    panner.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(bpf.frequency);
    if (isRealtime) this.registerVoice(duration, [noise], [{ param: bpf.frequency, baseVal: p.pitch }]);
    noise.start(t);
  }

  private engineVoid(p: SynthParams, ctx: BaseAudioContext, dest: AudioNode, isRealtime: boolean, lfoRouting?: any) {
    const t = ctx.currentTime;
    const duration = p.attack + p.decay + p.release;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const hpf = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    osc.type = 'sine';
    const baseFreq = p.pitch;
    
    // Erosion: Dissonance adds a detuned pulsing layer
    if (p.erosionActive && p.dissonance > 0.2) {
       osc.type = 'triangle'; // harsher wave
       osc.detune.setValueAtTime((Math.random() - 0.5) * p.dissonance * 400, t);
    }
    
    this.setPitch(osc.frequency, baseFreq, t, p);
    
    hpf.type = 'highpass';
    hpf.frequency.setValueAtTime(2000, t);
    panner.pan.setValueAtTime((Math.random() * 2 - 1) * p.stereo, t);
    
    // Erosion: Madness controls amplitude modulation (Tremolo)
    if (p.erosionActive && p.madness > 0.05) {
       const trem = ctx.createGain();
       const lfo = ctx.createOscillator();
       lfo.frequency.value = p.madness * 15;
       const lfoGain = ctx.createGain();
       lfoGain.gain.value = 0.8;
       lfo.connect(lfoGain);
       lfoGain.connect(trem.gain); // Tremolo
       lfo.start(t);
       lfo.stop(t+duration);
       
       this.applyADSR(ctx, env.gain, 0.1, p);
       osc.connect(hpf);
       hpf.connect(trem);
       trem.connect(env);
    } else {
       this.applyADSR(ctx, env.gain, 0.1, p);
       osc.connect(hpf);
       hpf.connect(env);
    }
    
    env.connect(panner);
    panner.connect(dest);
    
    if (lfoRouting && p.lfoTarget === 'pitch') lfoRouting.gain.connect(osc.frequency);
    if (isRealtime) this.registerVoice(duration, [osc], [{ param: osc.frequency, baseVal: baseFreq }]);
    osc.start(t);
    osc.stop(t + duration);
  }
  
  // ... rest of file (exportWav, bufferToWav) remains the same
  public async exportWav(params: SynthParams): Promise<Blob> {
    const sampleRate = 96000;
    const impulseTime = 0.5 + params.voidDecay * 18;
    const adsrDuration = params.attack + params.decay + params.release;
    const duration = Math.min(30, adsrDuration + (params.voidActive && params.theVoid > 0 ? impulseTime : 1));
    
    // Create Offline Context
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
    
    // Recreate the Graph in Offline Context for Export
    const mixBus = offlineCtx.createGain();
    const dryGain = offlineCtx.createGain();
    const reverb = offlineCtx.createConvolver();
    const reverbWet = offlineCtx.createGain();
    const masterGain = offlineCtx.createGain();
    const masterPanner = offlineCtx.createStereoPanner();
    const limiter = offlineCtx.createDynamicsCompressor();
    
    masterGain.gain.setValueAtTime(params.masterVolume, 0);
    masterPanner.pan.setValueAtTime(params.pan, 0);
    dryGain.gain.setValueAtTime(1, 0);
    const voidAmt = params.voidActive ? params.theVoid : 0;
    reverbWet.gain.setValueAtTime(voidAmt, 0);

    // M/S Matrix for Offline Export
    const splitter = offlineCtx.createChannelSplitter(2);
    const merger = offlineCtx.createChannelMerger(2);
    const midSum = offlineCtx.createGain();
    const midGain = offlineCtx.createGain();
    const sideSum = offlineCtx.createGain();
    const sideInvert = offlineCtx.createGain();
    const widthSideGain = offlineCtx.createGain();
    const sideInvert2 = offlineCtx.createGain();

    sideInvert.gain.value = -1;
    sideInvert2.gain.value = -1;
    midSum.gain.value = 0.5;
    sideSum.gain.value = 0.5;
    
    // Apply width param
    widthSideGain.gain.value = params.stereo * 1.5;

    // Connect Reverb
    if (params.voidActive) {
       reverb.buffer = await this.initReverb(offlineCtx, impulseTime);
    }
    
    mixBus.connect(dryGain);
    mixBus.connect(reverb);
    reverb.connect(reverbWet);

    const preMaster = offlineCtx.createGain();
    dryGain.connect(preMaster);
    reverbWet.connect(preMaster);
    preMaster.connect(splitter);

    // Encode
    splitter.connect(midSum, 0);
    splitter.connect(midSum, 1);
    splitter.connect(sideSum, 0);
    splitter.connect(sideInvert, 1);
    sideInvert.connect(sideSum);

    midSum.connect(midGain);
    sideSum.connect(widthSideGain);

    // Decode
    midGain.connect(merger, 0, 0);
    widthSideGain.connect(merger, 0, 0);
    midGain.connect(merger, 0, 1);
    widthSideGain.connect(sideInvert2);
    sideInvert2.connect(merger, 0, 1);

    merger.connect(masterGain);
    masterGain.connect(masterPanner);
    masterPanner.connect(limiter);
    limiter.connect(offlineCtx.destination);
    
    this.runEngine(params, offlineCtx, mixBus, false);
    
    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(abuffer: AudioBuffer): Blob {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample, offset = 0, pos = 0;
    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }
}
