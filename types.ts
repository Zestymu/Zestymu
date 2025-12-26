
export type EngineType = 
  | 'RLYEH' 
  | 'SHOGGOTH' 
  | 'AZATHOTH' 
  | 'NYARLATHOTEP' 
  | 'VOID' 
  | 'ABYSS_BENTHIC'
  | 'ELDRITCH_BELL'
  | 'WHISPERING_TIDE'
  | 'CREATURE_ROAR'
  | 'YOG_SOTHOTH'
  | 'HASTUR'
  | 'SHUB_NIGGURATH'
  | 'DAGON'
  | 'ITHAQUA'
  | 'TSATHOGGUA'
  | 'YITH'
  | 'BYAKHEE'
  | 'GHOL'
  | 'GHATANOTHOA'
  | 'RHAN_TEGOTH'
  | 'UBBO_SATHLA'
  | 'LLOIGOR'
  | 'SHANTAK'
  | 'TINDALOS'
  | 'STAR_SPAWN'
  | 'POLYP'
  | 'CARCOSA'
  | 'LENG'
  | 'NKAI'
  | 'KADATH'
  | 'PNAKOTIC'
  | 'HALI'
  | 'OUTER_VOID'
  | 'BEYOND_GATE'
  | 'ABYSSAL_PLAINS'
  | 'TIME_BEYOND'
  | 'YUGGOTH'
  | 'NAMELESS_CITY'
  | 'ERICH_ZANN'
  | 'COSMIC_ECHO';

export type LFOShape = 'sine' | 'triangle' | 'square' | 'sawtooth';

export type LFOTarget = 'none' | 'pitch' | 'cutoff' | 'resonance' | 'pan' | 'viscosity' | 'madness' | 'corruption';

export type CorruptionType = 'overdrive' | 'fuzz' | 'bitcrush' | 'void_grit';

export type EnvelopeCurve = 'linear' | 'exponential' | 'logarithmic' | 's-curve';

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface SynthParams {
  engine: EngineType;
  pitch: number;
  slideFrom?: number; // Previous note frequency for glide
  slideTime?: number; // Glide duration in seconds

  // ADSR Envelope
  attack: number;
  decay: number;
  sustain: number; // 0 to 1
  release: number;
  decayCurve: EnvelopeCurve;
  
  // Flesh / Corruption
  fleshActive: boolean;
  viscosity: number; // Lowpass/Damping
  corruption: number; // Intensity
  corruptionMix: number; // Wet/Dry Balance
  corruptionType: CorruptionType; // Algorithm

  // Erosion / Chaos
  erosionActive: boolean;
  madness: number;    // Chaos/LFO Speed
  dissonance: number; // Detune/Intervals

  // Void / Reverb
  voidActive: boolean;
  theVoid: number;    // Reverb Mix
  voidDecay: number;  // Reverb Time/Decay

  stereo: number;     // Width/Spread (0 to 1)
  pan: number;        // Master Balance (-1 to 1)
  masterVolume: number; // Overall gain (0 to 1)
  
  // Filter Section
  filterActive: boolean;
  filterType: FilterType;
  filterCutoff: number;
  filterResonance: number;

  // LFO Section
  lfoActive: boolean;
  lfoRate: number;
  lfoDepth: number;
  lfoShape: LFOShape;
  lfoTarget: LFOTarget;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  params: SynthParams;
  color: string;
}
