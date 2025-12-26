
import React from 'react';
import { Preset } from './types';

export const ICON_SIZE = 20;

export const EldritchIcons = {
  Tentacle: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 2C12 2 10 7 14 11C18 15 12 22 12 22M8 12C8 12 6 9 9 7C12 5 15 8 15 8" />
      <circle cx="14" cy="11" r="1" />
      <circle cx="16" cy="13" r="1" />
    </svg>
  ),
  Eye: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  Void: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20M2 12h20" strokeOpacity="0.3" />
      <circle cx="12" cy="12" r="5" strokeDasharray="2 2" />
    </svg>
  ),
  Skull: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M9 10L9 12M15 10L15 12M12 15L12 15M6 10C6 6 9 3 12 3C15 3 18 6 18 10C18 14 16 16 15 17L15 21H9L9 17C8 16 6 14 6 10Z" />
    </svg>
  ),
  Sigil: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 2L2 12L12 22L22 12L12 2ZM12 2V22M2 12H22M7 7L17 17M17 7L7 17" />
    </svg>
  ),
  Bell: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Wave: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  ),
  Filter: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
};

export const PRESETS: Record<string, Preset> = {
  COSMIC_ECHO: {
    id: 'COSMIC_ECHO',
    name: "寰宇回响",
    description: "带有深邃、阴冷的金属共鸣，跨越维度的庞大混响",
    color: "text-indigo-300",
    params: { engine: 'COSMIC_ECHO', pitch: 45, attack: 0.1, decay: 0.5, sustain: 0.4, release: 25, decayCurve: 'exponential', fleshActive: true, viscosity: 0.4, corruption: 0.3, corruptionMix: 0.6, corruptionType: 'bitcrush', erosionActive: true, madness: 0.1, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 0.8, stereo: 1.0, pan: 0, masterVolume: 0.7, lfoActive: true, lfoRate: 0.1, lfoDepth: 0.4, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 650, filterResonance: 4, lfoTarget: 'cutoff' }
  },
  RLYEH: {
    id: 'RLYEH',
    name: "拉莱耶之梦",
    description: "来自深海的古老环境音",
    color: "text-emerald-400",
    params: { engine: 'RLYEH', pitch: 35, attack: 0.5, decay: 4, sustain: 0.5, release: 5, decayCurve: 'exponential', fleshActive: true, viscosity: 0.9, corruption: 0.2, corruptionMix: 0.5, corruptionType: 'overdrive', erosionActive: true, madness: 0.05, voidActive: true, theVoid: 0.9, voidDecay: 0.8, dissonance: 0.1, stereo: 0.8, pan: 0, masterVolume: 0.7, lfoActive: true, lfoRate: 0.5, lfoDepth: 0.3, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 500, filterResonance: 1, lfoTarget: 'cutoff' }
  },
  CARCOSA: {
    id: 'CARCOSA',
    name: "卡尔克萨之影",
    description: "黄衣之王的失落之城，极其漫长且不详的回响",
    color: "text-yellow-500",
    params: { engine: 'VOID', pitch: 60, attack: 1.5, decay: 5, sustain: 0.4, release: 15, decayCurve: 'exponential', fleshActive: true, viscosity: 0.2, corruption: 0.5, corruptionMix: 0.6, corruptionType: 'overdrive', erosionActive: true, madness: 0.3, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 0.6, stereo: 1.0, pan: 0, masterVolume: 0.6, lfoActive: true, lfoRate: 0.2, lfoDepth: 0.4, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 1200, filterResonance: 2, lfoTarget: 'viscosity' }
  },
  HALI: {
    id: 'HALI',
    name: "哈利之湖",
    description: "云层中的黑星倒影，潮湿且深邃的虚空",
    color: "text-amber-600",
    params: { engine: 'RLYEH', pitch: 25, attack: 2.5, decay: 8, sustain: 0.7, release: 12, decayCurve: 'logarithmic', fleshActive: true, viscosity: 0.95, corruption: 0.1, corruptionMix: 0.4, corruptionType: 'overdrive', erosionActive: true, madness: 0.05, voidActive: true, theVoid: 1.0, voidDecay: 0.9, dissonance: 0.2, stereo: 0.9, pan: 0, masterVolume: 0.7, lfoActive: true, lfoRate: 0.1, lfoDepth: 0.5, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 400, filterResonance: 4, lfoTarget: 'viscosity' }
  },
  LENG: {
    id: 'LENG',
    name: "冷之高原",
    description: "极北荒野的哀嚎，寒冷且空旷的远距离回响",
    color: "text-blue-200",
    params: { engine: 'WHISPERING_TIDE', pitch: 1200, attack: 1.0, decay: 4, sustain: 0.3, release: 10, decayCurve: 'exponential', fleshActive: true, viscosity: 0.1, corruption: 0.3, corruptionMix: 0.4, corruptionType: 'fuzz', erosionActive: true, madness: 0.2, voidActive: true, theVoid: 0.95, voidDecay: 1.0, dissonance: 0.5, stereo: 1.0, pan: 0.3, masterVolume: 0.5, lfoActive: true, lfoRate: 0.5, lfoDepth: 0.6, lfoShape: 'sine', filterActive: true, filterType: 'highpass', filterCutoff: 1500, filterResonance: 1, lfoTarget: 'pan' }
  },
  OUTER_VOID: {
    id: 'OUTER_VOID',
    name: "终极虚空",
    description: "阿撒托斯沉睡的宇宙中心，吞噬现实的庞大回声",
    color: "text-purple-300",
    params: { engine: 'AZATHOTH', pitch: 15, attack: 2.0, decay: 10, sustain: 0.8, release: 20, decayCurve: 'exponential', fleshActive: true, viscosity: 1.0, corruption: 0.9, corruptionMix: 0.7, corruptionType: 'void_grit', erosionActive: true, madness: 0.05, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 0.8, stereo: 1.0, pan: 0, masterVolume: 0.9, lfoActive: true, lfoRate: 0.02, lfoDepth: 0.8, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 60, filterResonance: 20, lfoTarget: 'viscosity' }
  },
  BEYOND_GATE: {
    id: 'BEYOND_GATE',
    name: "银匙之门外",
    description: "跨越终极之门后的视界，闪烁且不稳定的空间感",
    color: "text-indigo-200",
    params: { engine: 'TIME_BEYOND', pitch: 2400, attack: 0.1, decay: 0.2, sustain: 0.4, release: 15, decayCurve: 'logarithmic', fleshActive: true, viscosity: 0.1, corruption: 0.4, corruptionMix: 0.8, corruptionType: 'bitcrush', erosionActive: true, madness: 0.9, voidActive: true, theVoid: 1.0, voidDecay: 0.9, dissonance: 0.9, stereo: 1.0, pan: 0, masterVolume: 0.5, lfoActive: true, lfoRate: 15.0, lfoDepth: 0.6, lfoShape: 'sawtooth', filterActive: true, filterType: 'notch', filterCutoff: 3000, filterResonance: 12, lfoTarget: 'pitch' }
  },
  NAMELESS_CITY: {
    id: 'NAMELESS_CITY',
    name: "无名之城",
    description: "阿拉伯沙漠下的远古遗迹，干燥、古老且深邃",
    color: "text-orange-400",
    params: { engine: 'ABYSS_BENTHIC', pitch: 42, attack: 1.2, decay: 5, sustain: 0.6, release: 12, decayCurve: 'exponential', fleshActive: true, viscosity: 0.8, corruption: 0.2, corruptionMix: 0.4, corruptionType: 'overdrive', erosionActive: true, madness: 0.1, voidActive: true, theVoid: 0.85, voidDecay: 0.9, dissonance: 0.3, stereo: 0.7, pan: 0, masterVolume: 0.8, lfoActive: true, lfoRate: 0.1, lfoDepth: 0.3, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 350, filterResonance: 2, lfoTarget: 'viscosity' }
  },
  YUGGOTH: {
    id: 'YUGGOTH',
    name: "尤格斯星之寒",
    description: "冥王星上的黑色金属城市，带有机械感的回响",
    color: "text-slate-200",
    params: { engine: 'YUGGOTH', pitch: 120, attack: 0.05, decay: 1, sustain: 0.2, release: 8, decayCurve: 'linear', fleshActive: true, viscosity: 0.3, corruption: 0.6, corruptionMix: 0.5, corruptionType: 'bitcrush', erosionActive: true, madness: 0.4, voidActive: true, theVoid: 0.9, voidDecay: 0.95, dissonance: 0.7, stereo: 0.9, pan: 0.4, masterVolume: 0.6, lfoActive: true, lfoRate: 0.8, lfoDepth: 0.4, lfoShape: 'square', filterActive: true, filterType: 'bandpass', filterCutoff: 1800, filterResonance: 6, lfoTarget: 'cutoff' }
  },
  ERICH_ZANN: {
    id: 'ERICH_ZANN',
    name: "埃里克·赞之弦",
    description: "奥赛尔街阁楼上的狂乱提琴，尖锐、不安且破碎",
    color: "text-rose-500",
    params: { engine: 'ERICH_ZANN', pitch: 880, attack: 0.01, decay: 0.1, sustain: 0.8, release: 2, decayCurve: 'linear', fleshActive: true, viscosity: 0.2, corruption: 0.8, corruptionMix: 0.9, corruptionType: 'fuzz', erosionActive: true, madness: 1.0, voidActive: true, theVoid: 0.7, voidDecay: 0.6, dissonance: 1.0, stereo: 0.8, pan: -0.3, masterVolume: 0.6, lfoActive: true, lfoRate: 18.0, lfoDepth: 0.9, lfoShape: 'sawtooth', filterActive: true, filterType: 'highpass', filterCutoff: 1000, filterResonance: 15, lfoTarget: 'pitch' }
  },
  ABYSSAL_PLAINS: {
    id: 'ABYSSAL_PLAINS',
    name: "深渊平原",
    description: "绝对零度下的无光之境，压抑且庞大",
    color: "text-cyan-900",
    params: { engine: 'ABYSS_BENTHIC', pitch: 20, attack: 5.0, decay: 15, sustain: 0.9, release: 25, decayCurve: 'logarithmic', fleshActive: true, viscosity: 1.0, corruption: 0.1, corruptionMix: 0.5, corruptionType: 'overdrive', erosionActive: false, madness: 0, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 0, stereo: 1.0, pan: 0, masterVolume: 0.9, lfoActive: true, lfoRate: 0.01, lfoDepth: 0.2, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 40, filterResonance: 2, lfoTarget: 'viscosity' }
  },
  NKAI: {
    id: 'NKAI',
    name: "恩凯之渊",
    description: "永恒黑暗的无光地带，吞噬一切频率的黑洞感",
    color: "text-slate-900",
    params: { engine: 'ABYSS_BENTHIC', pitch: 18, attack: 0.5, decay: 10, sustain: 0.9, release: 8, decayCurve: 'exponential', fleshActive: true, viscosity: 1.0, corruption: 0.8, corruptionMix: 0.5, corruptionType: 'void_grit', erosionActive: true, madness: 0.1, voidActive: true, theVoid: 1.0, voidDecay: 0.8, dissonance: 0.4, stereo: 0.2, pan: 0, masterVolume: 0.9, lfoActive: true, lfoRate: 0.05, lfoDepth: 0.2, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 80, filterResonance: 10, lfoTarget: 'corruption' }
  },
  KADATH: {
    id: 'KADATH',
    name: "寻梦卡达斯",
    description: "未知荒原上的巨大宫殿，宏伟且非人的金属共鸣",
    color: "text-violet-200",
    params: { engine: 'ELDRITCH_BELL', pitch: 150, attack: 0.1, decay: 3, sustain: 0.2, release: 12, decayCurve: 'exponential', fleshActive: false, viscosity: 0.4, corruption: 0.2, corruptionMix: 0.3, corruptionType: 'overdrive', erosionActive: true, madness: 0.4, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 0.8, stereo: 1.0, pan: 0, masterVolume: 0.6, lfoActive: true, lfoRate: 0.1, lfoDepth: 0.3, lfoShape: 'triangle', filterActive: true, filterType: 'bandpass', filterCutoff: 2000, filterResonance: 5, lfoTarget: 'pitch' }
  },
  PNAKOTIC: {
    id: 'PNAKOTIC',
    name: "纳克特共鸣",
    description: "跨越亿万年的石塔低语，充满几何感的回响",
    color: "text-orange-200",
    params: { engine: 'YOG_SOTHOTH', pitch: 600, attack: 1.5, decay: 4, sustain: 0.6, release: 8, decayCurve: 's-curve', fleshActive: true, viscosity: 0.5, corruption: 0.3, corruptionMix: 0.4, corruptionType: 'bitcrush', erosionActive: true, madness: 0.5, voidActive: true, theVoid: 0.9, voidDecay: 0.9, dissonance: 0.3, stereo: 1.0, pan: -0.2, masterVolume: 0.5, lfoActive: true, lfoRate: 1.5, lfoDepth: 0.4, lfoShape: 'sawtooth', filterActive: true, filterType: 'notch', filterCutoff: 1200, filterResonance: 12, lfoTarget: 'cutoff' }
  },
  DAGON: {
    id: 'DAGON',
    name: "大衮的呼唤",
    description: "阴冷的海洋祭祀，湿润且沉重",
    color: "text-cyan-500",
    params: { engine: 'RLYEH', pitch: 28, attack: 0.1, decay: 1.5, sustain: 0.2, release: 8, decayCurve: 'linear', fleshActive: true, viscosity: 1.0, corruption: 0.4, corruptionMix: 0.6, corruptionType: 'overdrive', erosionActive: true, madness: 0.1, voidActive: true, theVoid: 0.8, voidDecay: 0.9, dissonance: 0.3, stereo: 0.9, pan: 0, masterVolume: 0.8, lfoActive: true, lfoRate: 0.2, lfoDepth: 0.4, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 300, filterResonance: 2, lfoTarget: 'pitch' }
  },
  AZATHOTH: {
    id: 'AZATHOTH',
    name: "阿撒托斯之歌",
    description: "宇宙中心的混沌律动",
    color: "text-purple-500",
    params: { engine: 'AZATHOTH', pitch: 440, attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.5, decayCurve: 'linear', fleshActive: true, viscosity: 0.2, corruption: 0.8, corruptionMix: 0.9, corruptionType: 'void_grit', erosionActive: true, madness: 0.9, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 1.0, stereo: 1.0, pan: 0, masterVolume: 0.6, lfoActive: true, lfoRate: 15.0, lfoDepth: 0.8, lfoShape: 'sawtooth', filterActive: true, filterType: 'bandpass', filterCutoff: 1000, filterResonance: 10, lfoTarget: 'madness' }
  },
  NYARLATHOTEP: {
    id: 'NYARLATHOTEP',
    name: "奈亚拉托提普",
    description: "千面之神的蠕动纹理",
    color: "text-pink-600",
    params: { engine: 'NYARLATHOTEP', pitch: 120, attack: 0.2, decay: 1, sustain: 0.4, release: 2, decayCurve: 's-curve', fleshActive: true, viscosity: 0.5, corruption: 0.6, corruptionMix: 0.7, corruptionType: 'bitcrush', erosionActive: true, madness: 0.7, voidActive: true, theVoid: 0.6, voidDecay: 0.5, dissonance: 0.4, stereo: 0.9, pan: 0, masterVolume: 0.7, lfoActive: true, lfoRate: 3.5, lfoDepth: 0.9, lfoShape: 'square', filterActive: true, filterType: 'notch', filterCutoff: 800, filterResonance: 5, lfoTarget: 'cutoff' }
  },
  YOG_SOTHOTH: {
    id: 'YOG_SOTHOTH',
    name: "犹格·索托斯",
    description: "时空一体的虚空回响，跨越维度的庞大混响",
    color: "text-indigo-400",
    params: { engine: 'YOG_SOTHOTH', pitch: 800, attack: 2, decay: 3, sustain: 0.8, release: 10, decayCurve: 'exponential', fleshActive: true, viscosity: 0.3, corruption: 0.3, corruptionMix: 0.4, corruptionType: 'overdrive', erosionActive: true, madness: 0.2, voidActive: true, theVoid: 1.0, voidDecay: 1.0, dissonance: 0.2, stereo: 1.0, pan: 0, masterVolume: 0.5, lfoActive: true, lfoRate: 0.2, lfoDepth: 0.5, lfoShape: 'sine', filterActive: true, filterType: 'lowpass', filterCutoff: 1200, filterResonance: 1, lfoTarget: 'cutoff' }
  },
  HASTUR: {
    id: 'HASTUR',
    name: "黄衣之王",
    description: "凄厉而寒冷的尖啸",
    color: "text-yellow-500",
    params: { engine: 'HASTUR', pitch: 2200, attack: 0.01, decay: 0.5, sustain: 0.2, release: 4, decayCurve: 'exponential', fleshActive: true, viscosity: 0.4, corruption: 0.7, corruptionMix: 0.8, corruptionType: 'fuzz', erosionActive: true, madness: 0.4, voidActive: true, theVoid: 0.8, voidDecay: 0.7, dissonance: 0.9, stereo: 0.6, pan: 0, masterVolume: 0.5, lfoActive: true, lfoRate: 8.0, lfoDepth: 0.3, lfoShape: 'triangle', filterActive: true, filterType: 'bandpass', filterCutoff: 1500, filterResonance: 20, lfoTarget: 'resonance' }
  }
};
