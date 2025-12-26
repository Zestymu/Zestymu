
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EldritchAudioEngine } from './services/audioEngine';
import { SynthParams, Preset, LFOShape, CorruptionType, EnvelopeCurve, FilterType, LFOTarget } from './types';
import { PRESETS, EldritchIcons } from './constants';

const SanityMeter: React.FC<{ madness: number, corruption: number }> = ({ madness, corruption }) => {
  const sanity = Math.max(0, 100 - (madness * 70 + corruption * 30));
  const isCritical = sanity < 20;
  
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-950/60 rounded-2xl border border-emerald-900/10 relative overflow-hidden group">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">理智值 (SANITY)</span>
        <span className={`text-xs font-mono font-bold ${sanity < 30 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
          {sanity.toFixed(1)}%
        </span>
      </div>
      
      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
        <div 
          className={`h-full transition-all duration-500 ease-out relative ${
            sanity < 20 ? 'bg-red-600 shadow-[0_0_10px_#dc2626]' : 
            sanity < 50 ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
          style={{ width: `${sanity}%` }}
        >
          {sanity < 50 && (
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSI+PC9yZWN0Pjwvc3ZnPg==')] opacity-30 animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex gap-1 mt-1">
         {Array.from({ length: 10 }).map((_, i) => (
           <div 
             key={i} 
             className={`h-1.5 flex-grow rounded-sm transition-colors duration-300 ${
               (i * 10) < sanity 
                 ? (sanity < 20 ? 'bg-red-900/50' : 'bg-emerald-900/40') 
                 : 'bg-slate-900'
             }`} 
           />
         ))}
      </div>

      {isCritical && (
        <div className="absolute inset-0 pointer-events-none border-2 border-red-500/20 animate-pulse mix-blend-overlay" />
      )}
      
      <div className={`text-[9px] mt-2 font-mono uppercase tracking-[0.2em] transition-colors leading-tight ${sanity < 20 ? 'text-red-600' : 'text-slate-700'}`}>
        {sanity < 10 ? "不可名状之视界已然开启" : 
         sanity < 30 ? "理智之弦即将崩断" : 
         sanity < 60 ? "阴影在低语" : "现实尚且稳固"}
      </div>

      {/* Background cracks effect */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
        {madness > 0.4 && (
          <path 
            d={`M${20 + Math.random()*20} 0 L${40 + Math.random()*20} 30 L${30 + Math.random()*30} 60`} 
            stroke={sanity < 30 ? "#ef4444" : "#10b981"} 
            strokeWidth="0.5" 
            fill="none" 
            className="animate-pulse"
          />
        )}
        {corruption > 0.6 && (
          <path 
            d={`M${80 - Math.random()*20} 0 L${60 - Math.random()*20} 40 L${70 - Math.random()*30} 80`} 
            stroke={sanity < 30 ? "#ef4444" : "#10b981"} 
            strokeWidth="0.5" 
            fill="none"
          />
        )}
      </svg>
    </div>
  );
};

interface VirtualKeyboardProps {
    onPlay: (freq: number, glideTime: number) => void;
    onStop: () => void;
    onBend: (multiplier: number) => void;
    bendRange: number; // In semitones
    setBendRange: (range: number) => void;
}

const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onPlay, onStop, onBend, bendRange, setBendRange }) => {
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [octave, setOctave] = useState(0);
  const [glide, setGlide] = useState(0);
  const [dragOffset, setDragOffset] = useState(0); // For visual feedback
  
  // Ref for handling drag calculations without re-renders
  const dragStartRef = useRef<{ y: number, note: number } | null>(null);

  const startNote = 48 + (octave * 12); // C3 base
  const endNote = 72 + (octave * 12); // C5 base

  const whiteKeys = [];
  const blackKeys = [];
  let whiteIndex = 0;

  for (let i = startNote; i <= endNote; i++) {
    const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
    if (!isBlack) {
      whiteKeys.push({ note: i, index: whiteIndex++ });
    }
  }

  for (let i = startNote; i <= endNote; i++) {
    const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
    if (isBlack) {
      const prevWhite = whiteKeys.find(w => w.note === i - 1);
      if (prevWhite) {
        blackKeys.push({ note: i, position: prevWhite.index });
      }
    }
  }

  const handlePointerDown = (e: React.PointerEvent, note: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    
    setActiveNote(note);
    const freq = 440 * Math.pow(2, (note - 69) / 12);
    onPlay(freq, glide);
    
    dragStartRef.current = { y: e.clientY, note };
    setDragOffset(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    e.preventDefault();

    const deltaY = dragStartRef.current.y - e.clientY; // Positive = Up
    const pixelRange = 150; // Pixels to reach full bend range
    
    // Clamp visual offset
    setDragOffset(Math.max(-20, Math.min(20, deltaY * 0.2)));

    // Calculate Bend
    // Map deltaY to semitones
    const semitones = (deltaY / pixelRange) * bendRange;
    const multiplier = Math.pow(2, semitones / 12);
    
    onBend(multiplier);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setActiveNote(null);
    onStop();
    onBend(1.0); // Reset bend
    dragStartRef.current = null;
    setDragOffset(0);
  };

  // Runes for a cryptic look
  const runes = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", "ᛚ", "ᛜ", "ᛞ", "ᛟ"];

  return (
    <div className="w-full flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
            <div className="flex items-center gap-3">
                 <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Octave (音域)</label>
                    <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-emerald-900/30">
                        <button 
                            onClick={() => setOctave(prev => Math.max(-2, prev - 1))}
                            className="w-8 h-6 flex items-center justify-center rounded bg-slate-800 text-emerald-500 hover:bg-emerald-900/30 transition-colors text-xs font-bold"
                        >-</button>
                        <span className="w-8 text-center text-xs font-mono text-emerald-400 font-bold">{octave > 0 ? `+${octave}` : octave}</span>
                        <button 
                            onClick={() => setOctave(prev => Math.min(2, prev + 1))}
                            className="w-8 h-6 flex items-center justify-center rounded bg-slate-800 text-emerald-500 hover:bg-emerald-900/30 transition-colors text-xs font-bold"
                        >+</button>
                    </div>
                 </div>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="flex flex-col gap-1 items-end">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Touch Bend Range (触控弯音范围)</label>
                    <div className="flex items-center gap-2">
                         <input 
                            type="range" min="2" max="24" step="1" 
                            value={bendRange} 
                            onChange={(e) => setBendRange(parseInt(e.target.value))}
                            className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                         />
                         <span className="text-[10px] font-mono text-emerald-500 w-12 text-right whitespace-nowrap">+/- {bendRange}</span>
                    </div>
                 </div>

                 <div className="flex flex-col gap-1 items-end">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Glide (滑音)</label>
                    <div className="flex items-center gap-2">
                         <input 
                           type="range" min="0" max="0.5" step="0.01" value={glide}
                           onChange={(e) => setGlide(parseFloat(e.target.value))}
                           className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                         />
                         <span className="text-[10px] font-mono text-slate-500 w-8 text-right">{glide.toFixed(2)}s</span>
                    </div>
                 </div>
            </div>
        </div>

        <div className="w-full h-28 bg-[#0B1221] rounded-xl border border-emerald-900/30 relative flex overflow-hidden select-none shadow-2xl group ring-1 ring-emerald-900/20 touch-none">
          {/* Stone Texture Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")` }}></div>
          
          {/* Key Bed */}
          <div className="absolute inset-0 flex px-1 pb-1 pt-1 gap-[2px]">
            {whiteKeys.map((k) => {
              const isActive = activeNote === k.note;
              const translateY = isActive ? 1 - dragOffset : 0;
              
              return (
              <div
                key={k.note}
                onPointerDown={(e) => handlePointerDown(e, k.note)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`flex-1 rounded-b-sm transition-colors duration-100 cursor-pointer relative z-0 flex flex-col justify-end items-center pb-3 overflow-hidden touch-none
                  ${isActive
                    ? 'bg-emerald-900/40 border-b-2 border-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]' 
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-b-2 border-slate-950 shadow-[inset_0_-5px_10px_rgba(0,0,0,0.5)]'}
                `}
                style={{
                    transform: `translateY(${translateY}px)`
                }}
              >
                 {/* Rune Etching */}
                 <div className={`text-[12px] eldritch-font transition-all duration-300 ${isActive ? 'text-emerald-400 scale-125 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]' : 'text-slate-700'}`}>
                    {runes[k.index % runes.length]}
                 </div>
                 
                 {/* Small Note Label (C only) */}
                 <div className="absolute bottom-1 text-[8px] text-slate-600 font-mono opacity-40">
                    {k.note % 12 === 0 ? `C${Math.floor(k.note/12)-1}` : ''}
                 </div>
                 
                 {/* Inner Highlight for 3D effect */}
                 <div className="absolute top-0 w-full h-[1px] bg-white/5 pointer-events-none"></div>

                 {/* Drag direction indicator */}
                 {isActive && Math.abs(dragOffset) > 2 && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold opacity-50 ${dragOffset > 0 ? 'text-emerald-300' : 'text-purple-400'}`}>
                        {dragOffset > 0 ? '▲' : '▼'}
                    </div>
                 )}
              </div>
            )})}
          </div>

          {/* Black Keys (Void Stones) */}
          {blackKeys.map((k) => {
            const isActive = activeNote === k.note;
            const translateY = isActive ? 1 - dragOffset : 0;
            return (
            <div
              key={k.note}
              onPointerDown={(e) => handlePointerDown(e, k.note)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`absolute h-[58%] w-[3.5%] z-10 rounded-b-lg transition-colors duration-75 cursor-pointer border-x border-b border-black shadow-xl flex items-end justify-center pb-2 touch-none
                ${isActive
                    ? 'bg-purple-900 shadow-[0_0_15px_rgba(147,51,234,0.4)] border-purple-500/50' 
                    : 'bg-slate-950 bg-[radial-gradient(circle_at_top,_#334155_0%,_#020617_120%)]'}
              `}
              style={{
                left: `calc(${(k.position + 1) * (100 / whiteKeys.length)}% - 1.75%)`,
                transform: `translateY(${translateY}px)`
              }}
            >
                 {/* Alien marking */}
                 <div className={`text-[6px] ${isActive ? 'text-purple-300 animate-pulse' : 'text-slate-800'}`}>✦</div>
            </div>
          )})}
          
          {/* Ancient Overlay Shadow */}
          <div className="absolute inset-0 pointer-events-none rounded-xl shadow-[inset_0_0_40px_rgba(2,6,23,0.8)] border-t border-emerald-500/5"></div>
          
          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-emerald-500/30 rounded-tl-xl pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-500/30 rounded-tr-xl pointer-events-none"></div>
        </div>
    </div>
  );
};

const ControlColumn: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  onToggle?: () => void;
}> = ({ title, icon, children, active = true, onToggle }) => (
  <div className={`flex flex-col h-full bg-slate-900/50 rounded-xl p-3 border border-emerald-900/10 transition-all duration-300 ${!active && onToggle ? 'opacity-40 grayscale' : 'opacity-100 hover:border-emerald-500/30'}`}>
    <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
      <div className="flex items-center gap-2 text-slate-400 group">
        {icon && <div className={`transition-colors ${active ? 'text-emerald-500' : 'text-slate-600'}`}>{icon}</div>}
        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${active ? 'text-slate-300' : 'text-slate-600'}`}>{title}</span>
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className={`w-8 h-4 rounded-full transition-colors relative focus:outline-none ${active ? 'bg-emerald-900/50 ring-1 ring-emerald-500/50' : 'bg-slate-800 ring-1 ring-slate-700'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${active ? 'left-4.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'left-0.5 bg-slate-600'}`} />
        </button>
      )}
    </div>
    <div className={`flex-grow flex flex-col gap-2 ${!active && onToggle ? 'pointer-events-none' : ''}`}>
      {children}
    </div>
  </div>
);

const Knob: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
  desc?: string;
}> = ({ label, value, min, max, step = 0.01, onChange, unit, desc }) => {
  // Calculate percentage for visual bar
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="flex flex-col gap-1.5 mb-1 group relative">
      <div className="flex justify-between items-end px-0.5">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-emerald-400/80 transition-colors cursor-help" title={desc}>{label}</label>
        <span className="text-[9px] font-mono text-emerald-600 group-hover:text-emerald-400 transition-colors">
          {value.toFixed(step && step >= 1 ? 0 : 2)}{unit}
        </span>
      </div>
      <div className="relative h-2 w-full bg-slate-950 rounded-sm overflow-hidden border border-slate-800 group-hover:border-emerald-900/50 transition-colors">
        <div 
          className="absolute top-0 left-0 h-full bg-emerald-800 group-hover:bg-emerald-600 transition-all duration-75 ease-out"
          style={{ width: `${pct}%` }}
        />
        {/* Step markers if distinct enough */}
        {step && (max-min)/step < 10 && (
           <div className="absolute inset-0 flex justify-between px-[1px]">
             {Array.from({length: Math.floor((max-min)/step) + 1}).map((_,i) => <div key={i} className="w-[1px] h-full bg-black/20"/>)}
           </div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
        />
      </div>
    </div>
  );
};

const VoidCore: React.FC<{ value: number }> = ({ value }) => (
  <div className="w-full aspect-square relative flex items-center justify-center bg-slate-950 rounded-full border border-purple-900/20 mb-3 overflow-hidden shadow-[inset_0_0_30px_#000]">
    {/* Background nebula */}
    <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[conic-gradient(from_0deg_at_50%_50%,#000000_0%,#4c1d95_25%,#000000_50%,#4c1d95_75%,#000000_100%)] animate-[spin_20s_linear_infinite]" />
    
    {/* Core */}
    <div 
      className="relative rounded-full bg-black transition-all duration-100 ease-out z-10 flex items-center justify-center"
      style={{ 
        width: `${30 + value * 60}%`, 
        height: `${30 + value * 60}%`,
        boxShadow: `0 0 ${10 + value * 30}px ${5 + value * 10}px rgba(139, 92, 246, ${0.2 + value * 0.4})` 
      }}
    >
       <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-sm" />
       {value > 0.5 && <div className="w-[2px] h-[2px] bg-white rounded-full shadow-[0_0_10px_white] animate-pulse" />}
    </div>
    
    {/* Orbital rings */}
    <div className="absolute inset-2 border border-purple-500/10 rounded-full animate-[spin_8s_linear_infinite]" />
    <div className="absolute inset-6 border border-purple-500/10 rounded-full animate-[spin_12s_linear_infinite_reverse]" />
    
    <div className="absolute bottom-2 text-[8px] text-purple-500/40 font-mono tracking-[0.3em] pointer-events-none">SINGULARITY</div>
  </div>
);

const WhisperLog: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const messages = [
      "The sleeper stirs...",
      "Frequency modulation detected...",
      "R'lyeh coordinates locked.",
      "Neuro-link unstable.",
      "Void leakage imminent.",
      "Ancient seals weakening.",
      "Cosmic background radiation increasing.",
      "Can you hear them?",
      "It is watching.",
      "Non-euclidean geometry observed.",
      "Sanity levels critical.",
      "The stars are right.",
      "Unknown signal from deep space.",
      "Protocol 404: Reality not found.",
      "Summoning sequence initiated...",
      "Abyssal resonance: 98%"
    ];

    const addLog = () => {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLogs(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 8)); // Keep last 8
    };

    addLog();
    const interval = setInterval(() => {
        if (Math.random() > 0.6) addLog();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-grow flex flex-col bg-black/40 rounded-xl border border-emerald-900/20 p-3 mt-auto overflow-hidden relative min-h-[100px]">
      <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
        SYSTEM LOG (VOID_LINK)
      </div>
      <div className="flex-col flex gap-1 font-mono text-[9px] text-emerald-500/60 overflow-hidden">
         {logs.map((log, i) => (
           <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 truncate" style={{ opacity: 1 - i * 0.15 }}>
             {i === 0 ? <span className="text-emerald-400 font-bold">> {log}</span> : log}
           </div>
         ))}
      </div>
      {/* Decorative scanline */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] opacity-20"></div>
    </div>
  );
};

const App: React.FC = () => {
  const [params, setParams] = useState<SynthParams>(PRESETS.RLYEH.params);
  const [activePreset, setActivePreset] = useState<string>('RLYEH');
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pitchBend, setPitchBend] = useState(1.0);
  const [midiStatus, setMidiStatus] = useState<'disabled' | 'active' | 'error'>('disabled');
  const [keyboardBendRange, setKeyboardBendRange] = useState(12); // Semitones
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lfoCanvasRef = useRef<HTMLCanvasElement>(null);
  const envelopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement>(null);
  const fleshCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EldritchAudioEngine | null>(null);
  const requestRef = useRef<number | null>(null);
  const paramsRef = useRef<SynthParams>(params);
  
  const lastNoteFreq = useRef<number | null>(null);
  const lastNoteTime = useRef<number>(0);
  
  // Visualizer Refs
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }[]>([]);
  const scanlineRef = useRef(0);
  const rotationRef = useRef(0);

  // Sync ref for access inside MIDI callbacks without stale closures
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const initAudio = () => {
    if (!engineRef.current) {
      engineRef.current = new EldritchAudioEngine();
      setIsAudioInitialized(true);
      
      // Initialize particles with velocity for more dynamic movement
      particles.current = Array.from({ length: 80 }, () => ({
        x: Math.random() * 1000,
        y: Math.random() * 300,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1
      }));
    }
  };

  const triggerSound = useCallback((overridePitch?: number, glideTime?: number) => {
    initAudio();
    if (engineRef.current) {
      const now = engineRef.current.getContext().currentTime;
      let triggerParams = { ...paramsRef.current };
      
      if (overridePitch) {
          triggerParams.pitch = overridePitch;
          
          // Logic for Glide/Portamento
          if (glideTime && glideTime > 0 && lastNoteFreq.current && (now - lastNoteTime.current < 2.0)) {
               triggerParams.slideFrom = lastNoteFreq.current;
               triggerParams.slideTime = glideTime;
          }
          
          lastNoteFreq.current = overridePitch;
          lastNoteTime.current = now;
      }
      
      engineRef.current.trigger(triggerParams);
      setGlitch(true);
      setTimeout(() => setGlitch(false), 200);
    }
  }, []);

  const stopSound = () => {
    if (engineRef.current) {
      engineRef.current.stopAll();
      setGlitch(true);
      setTimeout(() => setGlitch(false), 300);
    }
  };

  const updateParam = (key: keyof SynthParams, val: any) => {
    setParams(prev => ({ ...prev, [key]: val }));
    
    if (engineRef.current) {
      if (key === 'pan') engineRef.current.updateMasterSpatial(val);
      if (key === 'masterVolume') engineRef.current.updateMasterVolume(val);
      if (key === 'stereo') engineRef.current.updateStereoWidth(val);
    }
  };

  const handlePitchBendChange = (val: number) => {
    setPitchBend(val);
    if (engineRef.current) {
      engineRef.current.setPitchBend(val);
    }
  };

  const resetPitchBend = () => {
    setPitchBend(1.0);
    if (engineRef.current) {
      engineRef.current.setPitchBend(1.0);
    }
  };

  // MIDI Support
  useEffect(() => {
    const midiToFreq = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

    const onMIDIMessage = (message: any) => {
      const [status, data1, data2] = message.data;
      const command = status & 0xf0;
      
      // Note On
      if (command === 0x90 && data2 > 0) {
        const freq = midiToFreq(data1);
        triggerSound(freq);
      }
      
      // Note Off logic removed to allow One-Shot playback with tails
      // if (command === 0x80 || (command === 0x90 && data2 === 0)) { ... }

      // Control Change (CC)
      if (command === 0xb0) {
        const val = data2 / 127;
        switch (data1) {
          case 1: // Mod Wheel
            updateParam('madness', val);
            break;
          case 7: // Master Volume
            updateParam('masterVolume', val);
            break;
          case 71: // Resonance
            updateParam('filterResonance', val * 30);
            break;
          case 74: // Cutoff
            updateParam('filterCutoff', val * 12000);
            break;
          case 10: // Pan
            updateParam('pan', (val * 2) - 1);
            break;
        }
      }
    };

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(
        (access) => {
          setMidiStatus('active');
          const inputs = access.inputs.values();
          for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
            input.value.onmidimessage = onMIDIMessage;
          }
          access.onstatechange = (e: any) => {
            if (e.port && e.port.type === 'input') {
              e.port.onmidimessage = onMIDIMessage;
            }
          };
        },
        () => setMidiStatus('error')
      );
    }
  }, [triggerSound]);

  const handleRandomize = () => {
    const curves: EnvelopeCurve[] = ['linear', 'exponential', 'logarithmic', 's-curve'];
    const corruptionTypes: CorruptionType[] = ['overdrive', 'fuzz', 'bitcrush', 'void_grit'];
    const lfoShapes: LFOShape[] = ['sine', 'triangle', 'square', 'sawtooth'];
    const filterTypes: FilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
    const lfoTargets: LFOTarget[] = ['pitch', 'cutoff', 'resonance', 'pan', 'viscosity', 'madness', 'corruption'];

    setParams(prev => ({
      ...prev,
      pitch: 20 + Math.random() * 1500,
      attack: 0.01 + Math.random() * 0.8,
      decay: 0.1 + Math.random() * 1.5,
      sustain: Math.random(),
      release: 0.2 + Math.random() * 3.0,
      decayCurve: curves[Math.floor(Math.random() * curves.length)],
      
      fleshActive: Math.random() > 0.1,
      viscosity: Math.random(),
      corruption: Math.random(),
      corruptionMix: 0.2 + Math.random() * 0.8,
      corruptionType: corruptionTypes[Math.floor(Math.random() * corruptionTypes.length)],
      
      erosionActive: Math.random() > 0.1,
      madness: Math.random(),
      dissonance: Math.random(),

      voidActive: Math.random() > 0.1,
      theVoid: Math.random(),
      voidDecay: Math.random(),

      lfoActive: Math.random() > 0.1,
      lfoRate: 0.1 + Math.random() * 12,
      lfoDepth: Math.random(),
      lfoShape: lfoShapes[Math.floor(Math.random() * lfoShapes.length)],
      lfoTarget: lfoTargets[Math.floor(Math.random() * lfoTargets.length)],
      
      filterActive: Math.random() > 0.1,
      filterType: filterTypes[Math.floor(Math.random() * filterTypes.length)],
      filterCutoff: 50 + Math.random() * 8000,
      filterResonance: Math.random() * 20,
    }));
    
    setGlitch(true);
    setTimeout(() => setGlitch(false), 150);
  };

  const handleExport = async () => {
    initAudio();
    if (engineRef.current) {
      setIsExporting(true);
      setGlitch(true);
      try {
        const blob = await engineRef.current.exportWav(params);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `eldritch_essence_${params.engine}_${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("The void refused the sacrifice:", err);
      } finally {
        setTimeout(() => {
          setIsExporting(false);
          setGlitch(false);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (engineRef.current && isAudioInitialized) {
      engineRef.current.updateMasterSpatial(params.pan);
      engineRef.current.updateMasterVolume(params.masterVolume);
      engineRef.current.updateStereoWidth(params.stereo);
    }
  }, [params.pan, params.masterVolume, params.stereo, isAudioInitialized]);

  const loadPreset = (presetId: string, preserveGlobal: boolean = true) => {
    const preset = PRESETS[presetId];
    if (preset) {
      if (preserveGlobal) {
        setParams(prev => ({ 
          ...preset.params, 
          masterVolume: prev.masterVolume,
          pan: prev.pan,
          stereo: prev.stereo
        }));
      } else {
        setParams(preset.params);
      }
      setActivePreset(presetId);
    }
  };

  const getLFOValue = (time: number, rate: number, shape: LFOShape) => {
    const period = 1 / Math.max(0.01, rate);
    const t = (time % period) / period;
    switch (shape) {
      case 'sine': return Math.sin(t * Math.PI * 2);
      case 'triangle': return t < 0.5 ? t * 4 - 1 : (1 - t) * 4 - 1;
      case 'square': return t < 0.5 ? 1 : -1;
      case 'sawtooth': return t * 2 - 1;
      default: return 0;
    }
  };

  const draw = () => {
    const now = performance.now() / 1000;
    const lfoVal = getLFOValue(now, params.lfoRate, params.lfoShape) * params.lfoDepth;

    if (canvasRef.current && engineRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const analyser = engineRef.current.getAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const timeData = new Uint8Array(bufferLength);
        const freqData = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        let bass = 0, mid = 0, treble = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = freqData[i] / 255.0;
          if (i < bufferLength * 0.1) bass += val;
          else if (i < bufferLength * 0.5) mid += val;
          else treble += val;
        }
        bass /= (bufferLength * 0.1);
        mid /= (bufferLength * 0.4);
        treble /= (bufferLength * 0.5);

        const intensity = (bass * 0.5 + mid * 0.3 + treble * 0.2);
        const shakeX = (Math.random() - 0.5) * bass * 15 * params.corruption;
        const shakeY = (Math.random() - 0.5) * bass * 15 * params.corruption;

        // Background with corruption tint
        const bgPulse = (lfoVal * 0.05) + (bass * 0.1);
        ctx.fillStyle = `rgba(${2 + bgPulse * 150}, ${6 + bgPulse * 50}, ${23 + bgPulse * 20}, ${0.15 + intensity * 0.15})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // --- Visual Corruption / Glitch Effects ---
        if (params.fleshActive && params.corruption > 0.4) {
          ctx.save();
          const corr = params.corruption;
          ctx.filter = `hue-rotate(${corr * 120 * Math.sin(now)}deg) contrast(${1 + corr * intensity}) brightness(${1 + corr * 0.2})`;
          
          if (Math.random() < corr * 0.05) {
             ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 255, 0.1)';
             ctx.fillRect(0, Math.random() * canvas.height, canvas.width, corr * 10);
          }
          if (corr > 0.7) {
             ctx.globalAlpha = corr * 0.3;
             ctx.globalCompositeOperation = 'screen';
             const shift = corr * 5;
             ctx.fillStyle = 'rgba(255,0,0,0.2)';
             ctx.fillRect(shift, 0, canvas.width, canvas.height);
             ctx.fillStyle = 'rgba(0,255,255,0.2)';
             ctx.fillRect(-shift, 0, canvas.width, canvas.height);
          }
          ctx.restore();
        }

        // --- Radial Frequency Gate (The Portal) ---
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.save();
        ctx.translate(cx + shakeX, cy + shakeY);
        // Rotate the spectrum ring slowly, faster with "madness"
        rotationRef.current += 0.002 + (params.madness * 0.02);
        ctx.rotate(rotationRef.current);
        
        ctx.beginPath();
        const baseRadius = 60 + intensity * 40;
        // Draw jagged circle based on frequency data
        // Use a subset of freq data for coarser look
        const segments = 60;
        for(let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const freqIndex = Math.floor((i / segments) * (bufferLength / 8)); // Focus on lower-mid bands
            const val = freqData[freqIndex] / 255.0;
            // Radius pulses with value and corruption
            const r = baseRadius + (val * 80 * (1 + params.corruption));
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i===0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.3 + intensity * 0.5})`;
        ctx.lineWidth = 1 + intensity * 2;
        ctx.stroke();
        
        // Inner Ring (Counter-rotating)
        ctx.rotate(rotationRef.current * -2.5);
        ctx.beginPath();
        for(let i = 0; i <= 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const r = (baseRadius * 0.6) + (Math.random() * 5 * intensity);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
             if (i===0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.3 + intensity * 0.5})`; // Purple tint
        ctx.stroke();
        ctx.restore();

        // --- Reactive Particles with Connections (Web) ---
        ctx.save();
        ctx.translate(shakeX, shakeY);
        particles.current.forEach((p, i) => {
             // Physics Update
             p.x += p.vx;
             p.y += p.vy;
             
             // Strong Bass Repulsion from Center (Shockwave)
             if (bass > 0.4) {
                 const dx = p.x - cx;
                 const dy = p.y - cy;
                 const dist = Math.sqrt(dx*dx + dy*dy);
                 if (dist < 250) { // Impact radius
                     const force = (250 - dist) / 250;
                     // Push away
                     p.vx += (dx / dist) * force * bass * 2.0;
                     p.vy += (dy / dist) * force * bass * 2.0;
                 }
             }

             // Friction (Damping)
             p.vx *= 0.95;
             p.vy *= 0.95;

             // Boundary Wrap
             if (p.x < 0) p.x = canvas.width;
             if (p.x > canvas.width) p.x = 0;
             if (p.y < 0) p.y = canvas.height;
             if (p.y > canvas.height) p.y = 0;
             
             // Draw Particle
             ctx.fillStyle = `rgba(16, 185, 129, ${p.alpha * (0.5 + intensity)})`;
             const particleSize = p.size * (1 + treble * 3);
             ctx.fillRect(p.x, p.y, particleSize, particleSize);

             // Draw Connections (Neural/Web Effect)
             // Optimization: only check nearby neighbors in array (approximate)
             // or check random subset. Checking all vs all is O(N^2), 80*80 is fine.
             for (let j = i + 1; j < particles.current.length; j++) {
                 const p2 = particles.current[j];
                 const dx = p.x - p2.x;
                 const dy = p.y - p2.y;
                 const distSq = dx*dx + dy*dy;
                 
                 // Connect if close enough
                 if (distSq < 4000) { // ~63px
                     ctx.beginPath();
                     ctx.strokeStyle = `rgba(16, 185, 129, ${0.1 * intensity * (1 - distSq/4000)})`;
                     ctx.lineWidth = 0.5;
                     ctx.moveTo(p.x, p.y);
                     ctx.lineTo(p2.x, p2.y);
                     ctx.stroke();
                 }
             }
        });
        ctx.restore();


        // --- Tentacles (Oscilloscope) ---
        // Enhanced tentacle style
        const drawTentacle = (color: string, offsetX: number, weight: number) => {
          ctx.save();
          ctx.translate(shakeX, shakeY);
          ctx.lineWidth = weight * (1.5 + mid * 15 + intensity * 10);
          ctx.strokeStyle = color;
          ctx.shadowBlur = 5 + intensity * 30 + treble * 20;
          ctx.shadowColor = color;
          
          if (params.corruption > 0.6) {
              ctx.shadowColor = `rgba(239, 68, 68, ${params.corruption})`;
          }

          ctx.beginPath();
          const sliceWidth = canvas.width / (bufferLength * 0.4); // Zoom in a bit
          let x = 0;
          const isSmooth = params.lfoShape === 'sine' || params.lfoShape === 'triangle';
          
          // Only draw first 40% of buffer for cleaner wave
          const drawLength = Math.floor(bufferLength * 0.4);
          
          for (let i = 0; i < drawLength; i++) {
            const v = timeData[i] / 128.0;
            const freqVal = freqData[i] / 255.0;
            const corruptionNoise = (Math.random() - 0.5) * params.corruption * 80 * (intensity + treble);
            const chaosAmp = (params.madness * 60) + (intensity * 120 * freqVal) + (lfoVal * 70);
            const wiggle = Math.sin(i * 0.1 + now * 8) * chaosAmp;
            const y = (v * canvas.height) / 2 + wiggle + corruptionNoise;
            const finalX = x + offsetX;
            
            if (i === 0) ctx.moveTo(finalX, y);
            else if (isSmooth && params.corruption < 0.6) {
                // Smooth bezier for non-glitchy look
                const prevX = finalX - sliceWidth;
                ctx.quadraticCurveTo(prevX + sliceWidth/2, y + (Math.random()-0.5)*intensity*5, finalX, y);
            }
            else ctx.lineTo(finalX, y);
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.restore();
        };

        const corruptionShift = params.corruption * 15 * intensity;
        if (params.corruption > 0.1) {
          drawTentacle(`rgba(239, 68, 68, ${0.3 + intensity * 0.5})`, corruptionShift + shakeX, 0.8);
          drawTentacle(`rgba(59, 130, 246, ${0.3 + intensity * 0.5})`, -corruptionShift - shakeX, 0.8);
        }
        drawTentacle(`rgba(52, 211, 153, ${0.6 + intensity * 0.4})`, 0, 1.2);

        // --- The Eye (Center) ---
        ctx.save();
        ctx.translate(cx + shakeX, cy + shakeY);
        const eyeBaseSize = 40 + intensity * 80 + lfoVal * 20;
        
        // Outer glow rings
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(52, 211, 153, ${(intensity * 0.6) / i})`;
          ctx.lineWidth = (intensity + treble) * 8;
          const vibe = (Math.random() - 0.5) * params.corruption * 25 * bass;
          // Deformed circles based on madness
          if (params.madness > 0.5) {
              ctx.ellipse(0, 0, eyeBaseSize * (i*0.5) + vibe, eyeBaseSize * (i*0.4) + vibe, now * i, 0, Math.PI*2);
          } else {
              ctx.arc(0, 0, eyeBaseSize * (i * 0.5) + vibe, 0, Math.PI * 2);
          }
          ctx.stroke();
        }
        
        // Pupil
        const pupilSize = 10 + treble * 50;
        ctx.fillStyle = `rgba(52, 211, 153, ${0.9 + treble})`;
        ctx.shadowBlur = 20 + intensity * 50;
        ctx.shadowColor = '#10b981';
        
        if (params.corruption > 0.7) {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.9 + treble})`;
            ctx.shadowColor = '#ef4444';
        }

        ctx.beginPath();
        // Pupil slit shape
        ctx.ellipse(0, 0, pupilSize * 0.4, pupilSize * (1 + bass), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- Scanlines (Overlay) ---
        scanlineRef.current = (scanlineRef.current + 2 + (intensity * 10)) % canvas.height;
        ctx.fillStyle = `rgba(16, 185, 129, ${0.05 + params.corruption * 0.2})`;
        // Draw the moving scanline bar
        ctx.fillRect(0, scanlineRef.current, canvas.width, 2 + params.corruption * 20);
        
        // Static faint scanlines every few pixels if corruption is high
        if (params.corruption > 0.3) {
            ctx.fillStyle = `rgba(0, 0, 0, 0.2)`;
            for(let y=0; y<canvas.height; y+=4) {
                ctx.fillRect(0, y, canvas.width, 1);
            }
        }
      }
    }

    if (fleshCanvasRef.current) {
      const fCanvas = fleshCanvasRef.current;
      const fCtx = fCanvas.getContext('2d');
      if (fCtx) {
        fCtx.clearRect(0, 0, fCanvas.width, fCanvas.height);
        
        // Background
        fCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        fCtx.fillRect(0, 0, fCanvas.width, fCanvas.height);
        
        // Grid line
        fCtx.strokeStyle = 'rgba(239, 68, 68, 0.1)'; 
        fCtx.lineWidth = 1;
        fCtx.beginPath();
        fCtx.moveTo(0, fCanvas.height/2);
        fCtx.lineTo(fCanvas.width, fCanvas.height/2);
        fCtx.moveTo(fCanvas.width/2, 0);
        fCtx.lineTo(fCanvas.width/2, fCanvas.height);
        fCtx.stroke();

        if (params.fleshActive) {
            fCtx.strokeStyle = '#ef4444'; 
            fCtx.lineWidth = 2;
            fCtx.shadowBlur = 5 + params.corruption * 10;
            fCtx.shadowColor = '#ef4444';
            
            fCtx.beginPath();
            const w = fCanvas.width;
            const h = fCanvas.height;
            
            for (let i = 0; i < w; i++) {
                const x = (i / w) * 2 - 1; // -1 to 1
                let y = x;
                
                const amount = params.corruption;
                switch (params.corruptionType) {
                    case 'overdrive':
                        const kDrive = amount * 100;
                        y = (3 + kDrive) * x * 20 * (Math.PI / 180) / (Math.PI + kDrive * Math.abs(x));
                        break;
                    case 'fuzz':
                        const fuzzK = amount * 25;
                        y = Math.tanh(x * fuzzK);
                        break;
                    case 'bitcrush':
                        const bits = 8 - (amount * 7);
                        const steps = Math.pow(2, bits);
                        y = Math.round(x * steps) / steps;
                        break;
                    case 'void_grit':
                        const foldK = 1 + amount * 8;
                        const val = x * foldK;
                        y = val > 1 ? 2 - val : (val < -1 ? -2 - val : val);
                        y = Math.max(-1, Math.min(1, y));
                        break;
                }
                
                const screenY = h/2 - (y * h/2 * 0.8);
                if (i===0) fCtx.moveTo(i, screenY);
                else fCtx.lineTo(i, screenY);
            }
            fCtx.stroke();
            fCtx.shadowBlur = 0;
        }
      }
    }

    if (lfoCanvasRef.current) {
      const lfoCanvas = lfoCanvasRef.current;
      const lfoCtx = lfoCanvas.getContext('2d');
      if (lfoCtx) {
        lfoCtx.clearRect(0, 0, lfoCanvas.width, lfoCanvas.height);
        lfoCtx.strokeStyle = params.lfoActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        lfoCtx.lineWidth = 1;
        lfoCtx.beginPath();
        lfoCtx.moveTo(0, lfoCanvas.height / 2);
        lfoCtx.lineTo(lfoCanvas.width, lfoCanvas.height / 2);
        lfoCtx.stroke();
        
        if (params.lfoActive) {
            lfoCtx.strokeStyle = '#10b981';
            lfoCtx.lineWidth = 2;
            lfoCtx.beginPath();
            for (let x = 0; x < lfoCanvas.width; x++) {
              const yVal = getLFOValue(now - (lfoCanvas.width - x) * 0.01, params.lfoRate, params.lfoShape);
              const y = (lfoCanvas.height / 2) - (yVal * (lfoCanvas.height / 2.8) * params.lfoDepth);
              if (x === 0) lfoCtx.moveTo(x, y);
              else lfoCtx.lineTo(x, y);
            }
            lfoCtx.stroke();
            const currentY = (lfoCanvas.height / 2) - (lfoVal * (lfoCanvas.height / 2.8));
            lfoCtx.fillStyle = '#34d399';
            lfoCtx.shadowBlur = 8;
            lfoCtx.shadowColor = '#10b981';
            lfoCtx.beginPath();
            lfoCtx.arc(lfoCanvas.width - 5, currentY, 4, 0, Math.PI * 2);
            lfoCtx.fill();
            lfoCtx.shadowBlur = 0;
        }
      }
    }

    if (filterCanvasRef.current) {
      const fCanvas = filterCanvasRef.current;
      const fCtx = fCanvas.getContext('2d');
      if (fCtx) {
        fCtx.clearRect(0, 0, fCanvas.width, fCanvas.height);
        fCtx.strokeStyle = params.filterActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)';
        fCtx.lineWidth = 1;
        fCtx.strokeRect(0, 0, fCanvas.width, fCanvas.height);

        if (params.filterActive) {
          fCtx.strokeStyle = '#10b981';
          fCtx.lineWidth = 2;
          fCtx.shadowBlur = 10;
          fCtx.shadowColor = '#10b981';
          fCtx.beginPath();

          const w = fCanvas.width;
          const h = fCanvas.height;
          const cutoffX = (Math.log10(params.filterCutoff) / Math.log10(20000)) * w;
          const Q = params.filterResonance;

          for (let x = 0; x < w; x++) {
            const freq = Math.pow(10, (x / w) * Math.log10(20000 / 20)) * 20;
            let magnitude = 1;
            const f0 = params.filterCutoff;

            const ratio = freq / f0;
            switch (params.filterType) {
              case 'lowpass':
                magnitude = 1 / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / Q, 2));
                break;
              case 'highpass':
                magnitude = (ratio * ratio) / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / Q, 2));
                break;
              case 'bandpass':
                magnitude = (ratio / Q) / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / Q, 2));
                break;
              case 'notch':
                magnitude = Math.abs(1 - ratio * ratio) / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / Q, 2));
                break;
            }

            const y = h - (Math.min(1.5, magnitude) / 1.5) * h * 0.8 - h * 0.1;
            if (x === 0) fCtx.moveTo(x, y);
            else fCtx.lineTo(x, y);
          }
          fCtx.stroke();
          fCtx.shadowBlur = 0;
          
          fCtx.fillStyle = 'rgba(16, 185, 129, 0.5)';
          fCtx.fillRect(cutoffX - 1, 0, 2, h);
        } else {
          fCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          fCtx.font = '10px monospace';
          fCtx.textAlign = 'center';
          fCtx.fillText('BYPASSED', fCanvas.width / 2, fCanvas.height / 2 + 4);
        }
      }
    }

    if (envelopeCanvasRef.current) {
      const eCanvas = envelopeCanvasRef.current;
      const eCtx = eCanvas.getContext('2d');
      if (eCtx) {
        eCtx.clearRect(0, 0, eCanvas.width, eCanvas.height);
        eCtx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
        eCtx.setLineDash([2, 2]);
        eCtx.strokeRect(0, 0, eCanvas.width, eCanvas.height);
        eCtx.setLineDash([]);
        
        eCtx.strokeStyle = '#10b981';
        eCtx.lineWidth = 2;
        eCtx.shadowBlur = 10;
        eCtx.shadowColor = '#10b981';

        const padding = 5;
        const w = eCanvas.width - padding * 2;
        const h = eCanvas.height - padding * 2;
        
        const total = params.attack + params.decay + params.release + 0.1; 
        const aW = (params.attack / total) * w;
        const dW = (params.decay / total) * w;
        const sW = (0.1 / total) * w; 
        const rW = (params.release / total) * w;

        const getCurveVal = (t: number, type: EnvelopeCurve) => {
          switch (type) {
            case 'exponential': return Math.pow(0.001, 1 - t);
            case 'logarithmic': return 1 - Math.pow(0.001, t);
            case 's-curve': return t * t * (3 - 2 * t);
            case 'linear':
            default: return t;
          }
        };

        eCtx.beginPath();
        eCtx.moveTo(padding, padding + h);
        
        for(let i=0; i<=aW; i++) {
          const t = i/Math.max(1, aW);
          const y = padding + h - (getCurveVal(t, params.decayCurve) * h);
          eCtx.lineTo(padding + i, y);
        }

        const startY_D = padding;
        const endY_D = padding + h - (params.sustain * h);
        for(let i=0; i<=dW; i++) {
          const t = i/Math.max(1, dW);
          const y = startY_D + (endY_D - startY_D) * (1 - getCurveVal(1 - t, params.decayCurve));
          eCtx.lineTo(padding + aW + i, y);
        }

        eCtx.lineTo(padding + aW + dW + sW, padding + h - (params.sustain * h));

        const startY_R = padding + h - (params.sustain * h);
        const endY_R = padding + h;
        for(let i=0; i<=rW; i++) {
          const t = i/Math.max(1, rW);
          const y = startY_R + (endY_R - startY_R) * (1 - getCurveVal(1 - t, params.decayCurve));
          eCtx.lineTo(padding + aW + dW + sW + i, y);
        }

        eCtx.stroke();
        eCtx.shadowBlur = 0;
      }
    }

    requestRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [params]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 transition-all duration-75 ${glitch ? 'blur-[1px] brightness-125' : ''}`}>
      <div className="w-full max-w-[95%] grid grid-cols-1 lg:grid-cols-5 gap-6 bg-slate-900 border border-purple-900/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden void-glow">
        
        <div className="lg:col-span-1 flex flex-col h-full border-r border-purple-900/20 pr-6">
          <div className="flex items-start justify-between mb-6 flex-shrink-0">
            <div className="flex items-start gap-3">
              <EldritchIcons.Tentacle className="w-10 h-10 text-emerald-400 animate-pulse mt-1" />
              <div className="flex flex-col">
                <h1 className="eldritch-font text-3xl tracking-tighter text-white leading-tight">ELDRI-TH</h1>
                <span className="text-[11px] text-emerald-500/40 font-mono tracking-[0.3em] uppercase -mt-0.5">by Zestymu</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className={`text-[9px] font-bold px-2 py-1 rounded border ${midiStatus === 'active' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400' : midiStatus === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                MIDI {midiStatus.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex flex-col flex-shrink-0 mb-4">
            <div className="z-10 mb-4 bg-slate-900 border-b border-purple-900/20 pb-2">
                <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">召唤目标 (ENTITY PRESETS)</h2>
            </div>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => loadPreset(key)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-300 group shrink-0 ${
                    activePreset === key 
                      ? 'bg-emerald-900/20 border-emerald-500/50' 
                      : 'border-transparent hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-slate-950 ${p.color}`}>
                      {key === 'BELL' ? <EldritchIcons.Bell className="w-5 h-5" /> : <EldritchIcons.Sigil className="w-5 h-5" />}
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-sm font-bold text-white tracking-wide truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{p.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 flex-shrink-0 mb-4">
            <button 
              onClick={handleRandomize}
              className="w-full py-3 bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 text-sm font-bold rounded-xl border border-purple-800 transition-all flex items-center justify-center gap-2"
            >
              <EldritchIcons.Void className="w-5 h-5" /> 随机神启 (REVELATION)
            </button>

            <button 
              onClick={() => stopSound()}
              className="w-full py-3 bg-red-950/30 hover:bg-red-950/50 text-red-400 text-sm font-bold rounded-xl border border-red-900/50 transition-all flex items-center justify-center gap-2"
            >
              <EldritchIcons.Skull className="w-5 h-5" /> 静默之印 (BANISH NOW)
            </button>
            
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className={`w-full py-4 relative group overflow-hidden bg-emerald-900/10 hover:bg-emerald-900/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-900/50 transition-all flex items-center justify-center gap-2 mt-2 ${isExporting ? 'animate-pulse cursor-wait border-emerald-500' : ''}`}
            >
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              {isExporting ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span className="tracking-widest">正在刻录深渊律动...</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-mono">ETCHING ABYSSAL RHYTHMS</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <EldritchIcons.Wave className="w-5 h-5" /> 
                    <span className="tracking-widest">提取不可名状之精华</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-mono">EXTRACT UNSPEAKABLE ESSENCE</span>
                </div>
              )}
            </button>
          </div>
          
          <WhisperLog />
        </div>

        <div className="lg:col-span-4 flex flex-col space-y-6">
          <div className="flex gap-4 h-72">
            <div 
              className="flex-grow bg-slate-950 rounded-2xl border border-emerald-900/20 relative cursor-crosshair group overflow-hidden"
              onClick={() => triggerSound()}
            >
              <canvas ref={canvasRef} width={1000} height={300} className="w-full h-full opacity-80" />
              <div className="absolute top-4 right-4 flex flex-col items-end pointer-events-none opacity-40">
                  <div className="text-[11px] text-emerald-500 font-mono uppercase tracking-widest">{params.lfoShape} LFO ACTIVE</div>
                  <div className="text-[11px] text-emerald-500 font-mono">LAT: 47° 9' S</div>
                  <div className="text-[11px] text-emerald-500 font-mono">LON: 126° 43' W</div>
                  <div className="text-xs text-emerald-400 font-bold mt-1 tracking-widest uppercase">
                    {params.corruption > 0.5 ? 'System Integrity Failing' : 'Blood Moon Active'}
                  </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:scale-110 transition-transform duration-700">
                 <div className="w-28 h-28 rounded-full bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center backdrop-blur-[2px]">
                    <EldritchIcons.Eye className={`w-14 h-14 text-emerald-400 transition-opacity duration-300 ${glitch ? 'opacity-100 scale-125' : 'opacity-40'}`} />
                 </div>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                  <div className="text-xs text-emerald-500/40 font-mono uppercase tracking-[0.5em] group-hover:opacity-100 transition-opacity">触摸虚空 (TOUCH THE VOID)</div>
              </div>

              {!isAudioInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl z-20">
                  <div className="text-center space-y-4">
                      <p className="text-xs text-emerald-500/60 tracking-widest uppercase">Warning: Sanity Check Required</p>
                      <button onClick={initAudio} className="px-12 py-6 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-full shadow-[0_0_30px_rgba(5,150,105,0.4)] transition-all active:scale-95 eldritch-font text-xl tracking-widest">
                        开启旧日之门
                      </button>
                  </div>
                </div>
              )}
            </div>

            <div className="w-14 flex flex-col items-center bg-slate-950 rounded-2xl border border-purple-900/20 p-2 relative">
               <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mb-2 vertical-text">WARP</div>
               <input 
                 type="range" min="0.5" max="2.0" step="0.01" value={pitchBend}
                 onInput={(e: any) => handlePitchBendChange(parseFloat(e.target.value))}
                 onMouseUp={resetPitchBend} onTouchEnd={resetPitchBend}
                 className="pitch-slider"
                 {...({ orient: "vertical" } as any)}
                 style={{ appearance: 'slider-vertical', width: '10px', height: '100%', background: '#1e1b4b', borderRadius: '4px', cursor: 'ns-resize' } as any}
               />
               <div className="absolute top-1/2 left-0 w-full h-[1px] bg-emerald-500/30 pointer-events-none"></div>
            </div>
          </div>
          

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 px-4 pb-2">
            {/* CONTRACT */}
            <ControlColumn title="存在契约 (CONTRACT)" icon={<EldritchIcons.Sigil className="w-4 h-4"/>}>
              <div className="bg-slate-950 rounded border border-emerald-900/20 mb-2 overflow-hidden">
                <canvas ref={envelopeCanvasRef} width={120} height={40} className="w-full h-12 block" />
              </div>
              <Knob label="维度基准 (PITCH)" value={params.pitch} min={20} max={3000} onChange={v => updateParam('pitch', v)} unit="Hz" />
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 border-t border-emerald-900/10 pt-2">
                <Knob label="显现 (MANIFEST)" value={params.attack} min={0.01} max={1} step={0.01} onChange={v => updateParam('attack', v)} desc="Atk" />
                <Knob label="坍缩 (COLLAPSE)" value={params.decay} min={0.01} max={2} step={0.01} onChange={v => updateParam('decay', v)} desc="Dec" />
                <Knob label="续存 (PERSIST)" value={params.sustain} min={0} max={1} step={0.01} onChange={v => updateParam('sustain', v)} desc="Sus" />
                <Knob label="放逐 (BANISH)" value={params.release} min={0.1} max={5} step={0.01} onChange={v => updateParam('release', v)} desc="Rel" />
              </div>
            </ControlColumn>

            {/* FILTER */}
            <ControlColumn 
                title="主滤波器 (FILTER)" 
                icon={<EldritchIcons.Filter className="w-4 h-4"/>}
                active={params.filterActive}
                onToggle={() => updateParam('filterActive', !params.filterActive)}
            >
               <div className="bg-slate-950 rounded border border-emerald-900/20 mb-2 overflow-hidden relative">
                 <canvas ref={filterCanvasRef} width={120} height={40} className="w-full h-12 block" />
                 {!params.filterActive && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center">
                       <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">BYPASS</span>
                    </div>
                 )}
               </div>
               <div className="flex flex-col gap-2">
                  <Knob label="切除频率 (CUTOFF)" value={params.filterCutoff} min={20} max={12000} step={1} onChange={v => updateParam('filterCutoff', v)} unit="Hz" />
                  <Knob label="共振 (RESONANCE)" value={params.filterResonance} min={0.1} max={30} step={0.1} onChange={v => updateParam('filterResonance', v)} unit="Q" />
                  <div className="flex flex-col gap-1 mt-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">规律 (TYPE)</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['lowpass', 'highpass', 'bandpass', 'notch'] as FilterType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => updateParam('filterType', type)}
                          className={`py-1.5 px-1 rounded border text-[10px] uppercase transition-all truncate ${params.filterType === type ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>
            </ControlColumn>

            {/* FLESH */}
            <ControlColumn 
                title="血肉与意志 (FLESH)" 
                icon={<EldritchIcons.Tentacle className="w-4 h-4"/>}
                active={params.fleshActive}
                onToggle={() => updateParam('fleshActive', !params.fleshActive)}
            >
              <div className="bg-slate-950 rounded border border-emerald-900/20 mb-2 overflow-hidden relative">
                 <canvas ref={fleshCanvasRef} width={120} height={40} className="w-full h-12 block" />
                 {!params.fleshActive && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center">
                       <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">DORMANT</span>
                    </div>
                 )}
               </div>
              <div className={!params.fleshActive ? 'opacity-30 pointer-events-none' : ''}>
                  <Knob label="粘滞度 (VISCOSITY)" value={params.viscosity} min={0} max={1} step={0.01} onChange={v => updateParam('viscosity', v)} unit="%" />
                  <div className="space-y-4 pt-2 border-t border-emerald-900/10">
                    <Knob label="腐蚀强度 (CORRUPTION)" value={params.corruption} min={0} max={1} step={0.01} onChange={v => updateParam('corruption', v)} unit="%" />
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">法则 (LAW)</label>
                      <div className="grid grid-cols-2 gap-1">
                        {(['overdrive', 'fuzz', 'bitcrush', 'void_grit'] as CorruptionType[]).map(type => (
                          <button
                            key={type}
                            onClick={() => updateParam('corruptionType', type)}
                            className={`py-1.5 px-1 rounded border text-[10px] uppercase transition-all truncate ${params.corruptionType === type ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-transparent text-slate-500 hover:text-slate-300'}`}
                          >
                            {type.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
              </div>
            </ControlColumn>

            {/* LFO */}
            <ControlColumn 
                title="无定型颤动 (LFO)" 
                icon={<EldritchIcons.Wave className="w-4 h-4"/>}
                active={params.lfoActive}
                onToggle={() => updateParam('lfoActive', !params.lfoActive)}
            >
              <div className="bg-slate-950 rounded border border-emerald-900/20 mb-2 overflow-hidden">
                <canvas ref={lfoCanvasRef} width={120} height={40} className="w-full h-12 block" />
              </div>
              <div className={`flex flex-col gap-3 ${!params.lfoActive ? 'opacity-30 pointer-events-none' : ''}`}>
                <Knob label="频率 (RATE)" value={params.lfoRate} min={0.1} max={20} step={0.1} onChange={v => updateParam('lfoRate', v)} unit="Hz" />
                <Knob label="深度 (DEPTH)" value={params.lfoDepth} min={0} max={1} step={0.01} onChange={v => updateParam('lfoDepth', v)} unit="%" />
                
                <div className="flex flex-col gap-1 mt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">波形 (WAVE)</label>
                  <div className="flex gap-1">
                    {(['sine', 'triangle', 'square', 'sawtooth'] as LFOShape[]).map(shape => (
                      <button
                        key={shape}
                        onClick={() => updateParam('lfoShape', shape)}
                        className={`flex-grow py-1.5 px-1 rounded border text-[10px] uppercase transition-all ${params.lfoShape === shape ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-transparent text-slate-500 hover:text-slate-300'}`}
                      >
                        {shape}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">调制目标 (ROUTING)</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(['none', 'pitch', 'cutoff', 'resonance', 'pan', 'viscosity', 'madness', 'corruption'] as LFOTarget[]).map(target => (
                      <button
                        key={target}
                        onClick={() => updateParam('lfoTarget', target)}
                        className={`py-1 px-1 rounded border text-[9px] uppercase transition-all truncate ${params.lfoTarget === target ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-transparent text-slate-500 hover:text-slate-300'}`}
                      >
                        {target}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </ControlColumn>

            {/* EROSION */}
            <ControlColumn 
                title="理智侵蚀 (EROSION)" 
                icon={<EldritchIcons.Skull className="w-4 h-4"/>}
                active={params.erosionActive}
                onToggle={() => updateParam('erosionActive', !params.erosionActive)}
            >
              <SanityMeter madness={params.madness} corruption={params.corruption} />
              <div className={!params.erosionActive ? 'opacity-30 pointer-events-none' : ''}>
                  <Knob label="疯狂 (MADNESS)" value={params.madness} min={0} max={1} step={0.01} onChange={v => updateParam('madness', v)} unit="%" />
                  <Knob label="不和谐 (DISSONANCE)" value={params.dissonance} min={0} max={1} step={0.01} onChange={v => updateParam('dissonance', v)} unit="%" />
              </div>
            </ControlColumn>

            {/* VOID */}
            <ControlColumn 
                title="虚空领域 (VOID)" 
                icon={<EldritchIcons.Void className="w-4 h-4"/>}
                active={params.voidActive}
                onToggle={() => updateParam('voidActive', !params.voidActive)}
            >
              <div className={!params.voidActive ? 'opacity-30 pointer-events-none' : ''}>
                  <VoidCore value={params.theVoid} />
                  <Knob label="混响量 (VOICE)" value={params.theVoid} min={0} max={1} step={0.01} onChange={v => updateParam('theVoid', v)} unit="%" />
                  <Knob label="衰减 (DECAY)" value={params.voidDecay} min={0} max={1} step={0.01} onChange={v => updateParam('voidDecay', v)} unit="%" />
              </div>
            </ControlColumn>
          </div>

          <div className="flex flex-col gap-4 border-t border-emerald-900/20 pt-4 px-4 bg-slate-950/40 rounded-2xl">
            <div className="flex items-center gap-6">
              <div className="flex-grow flex gap-10 items-center">
                <div className="w-1/3">
                  <Knob label="共鸣主音量 (MASTER)" value={params.masterVolume} min={0} max={1} step={0.01} onChange={v => updateParam('masterVolume', v)} unit="%" />
                </div>
                <div className="flex gap-6 flex-grow">
                  <div className="flex-grow">
                    <Knob label="声像平衡 (PAN)" value={params.pan} min={-1} max={1} step={0.01} onChange={v => updateParam('pan', v)} unit="" />
                  </div>
                  <div className="flex-grow">
                    <Knob label="声场跨度 (WIDTH)" value={params.stereo} min={0} max={1} step={0.01} onChange={v => updateParam('stereo', v)} unit="%" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pb-2">
              <div className="text-[11px] text-slate-600 font-mono tracking-widest uppercase flex items-center gap-6">
                <span>Entity Status: <span className="text-emerald-500 animate-pulse">ALIVE</span></span>
                <span className="opacity-30">|</span>
                <span>Reality Sync: 48.0kHz / 96k Export</span>
              </div>
            </div>
          </div>
          
          {/* Virtual Keyboard */}
          <VirtualKeyboard 
             onPlay={(freq, glideTime) => triggerSound(freq, glideTime)} 
             onStop={() => {}}
             onBend={handlePitchBendChange}
             bendRange={keyboardBendRange}
             setBendRange={setKeyboardBendRange}
          />

        </div>
      </div>
      
      <div className="mt-8 flex flex-col items-center gap-2">
        <p className="text-slate-700 text-[11px] font-mono uppercase tracking-[0.4em]">Ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn</p>
      </div>
      
      <style>{`
        .vertical-text { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); }
        .pitch-slider::-webkit-slider-thumb { appearance: none; width: 26px; height: 14px; background: #10b981; border-radius: 2px; box-shadow: 0 0 10px #059669; cursor: pointer; }
        @keyframes pulse-void-sphere { 0%, 100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.1); opacity: 0.9; } }
      `}</style>
    </div>
  );
};

export default App;
