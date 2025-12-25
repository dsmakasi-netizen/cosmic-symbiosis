import React, { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Visuals } from './components/Visuals';
import { GestureHandler } from './components/GestureHandler';
import { ChakraRadar } from './components/ChakraRadar';
import { audioService } from './services/audioService';
import { AppState, GestureType, MoonPhase, Season, Landmark } from './types';
import { FONTS } from './constants';

const App: React.FC = () => {
  // --- Global State ---
  const [appState, setAppState] = useState<AppState>(AppState.DISCONNECTED);
  const [currentGesture, setCurrentGesture] = useState<GestureType>(GestureType.NONE);
  const [handPos, setHandPos] = useState<{ x: number, y: number }>({ x: 0.5, y: 0.5 });
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [resonance, setResonance] = useState(0);
  const [awakenProgress, setAwakenProgress] = useState(0);
  const [heartRate] = useState<string>("72");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // --- Environment State (Mocked for now) ---
  const [moonPhase] = useState<MoonPhase>(MoonPhase.WAXING);
  const [season] = useState<Season>(Season.SUMMER);
  const [tideLevel, setTideLevel] = useState(0.5);

  // --- Audio Engine Init ---
  useEffect(() => {
    const handleFirstInteraction = () => {
      // Browsers block audio until interaction. 
      // We ensure the context is resumed on any click.
      audioService.resume(); 
      
      if (appState !== AppState.DISCONNECTED) {
        // Double check init if it somehow missed
        audioService.init();
      }
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [appState]);

  // --- Logic Loop ---
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      const now = Date.now();
      
      // 1. Simulate Tide Breathing
      const tide = (Math.sin(now / 4000) + 1) / 2;
      setTideLevel(tide);

      // 2. Awakening Logic
      if (appState === AppState.AWAKENING) {
        setAwakenProgress(prev => {
          const next = prev + 0.005;
          if (next >= 1) {
            setAppState(AppState.RESONANT);
            return 1;
          }
          return next;
        });
      }

      // 3. Resonance Logic (Controlled by Hand Stability/Gesture)
      if (appState === AppState.RESONANT) {
        let targetResonance = 0.2; // Base level
        if (currentGesture === GestureType.OPEN_PALM) targetResonance = 0.8;
        if (currentGesture === GestureType.PINCH) targetResonance = 0.5;
        if (currentGesture === GestureType.CLOSED_FIST) targetResonance = 0.1;
        if (currentGesture === GestureType.POINTING) targetResonance = 0.3;

        setResonance(prev => prev + (targetResonance - prev) * 0.05);
      }

      // Sync Audio
      audioService.setResonance(appState === AppState.RESONANT ? resonance : awakenProgress);

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [appState, currentGesture, resonance, awakenProgress]);

  // --- Handlers ---
  const startExperience = () => {
    setCameraEnabled(true);
    setAppState(AppState.AWAKENING);
    setShowIntro(false);
    audioService.init(); // Main Init
    audioService.resume(); // Ensure active
  };

  const handleGestureChange = useCallback((gesture: GestureType, pos: { x: number, y: number, z: number }, landmarksData: Landmark[]) => {
    setCurrentGesture(gesture);
    // Smooth hand position
    setHandPos(prev => ({
      x: prev.x + (pos.x - prev.x) * 0.2,
      y: prev.y + (pos.y - prev.y) * 0.2
    }));
    setLandmarks(landmarksData);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 text-slate-100 select-none">
      
      {/* 1. 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 35], fov: 45 }} gl={{ antialias: false }}>
          <Visuals 
            appState={appState} 
            gesture={currentGesture} 
            resonance={resonance}
            moonPhase={moonPhase}
            season={season}
            tideLevel={tideLevel}
            handPos={handPos}
            landmarks={landmarks}
          />
        </Canvas>
      </div>

      {/* 2. Sensor Layer */}
      <GestureHandler onGestureChange={handleGestureChange} videoEnabled={cameraEnabled} />

      {/* 3. UI Layer (HUD) */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-light tracking-widest uppercase opacity-80" style={{ fontFamily: FONTS.title }}>
              Cosmic Symbiosis
            </h1>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-cyan-300 opacity-60">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span>SYSTEM: {appState}</span>
            </div>
          </div>
          <div className="text-right font-mono text-xs opacity-50">
             <div>HR: {heartRate} BPM</div>
             <div>MOON: {MoonPhase[moonPhase]}</div>
             <div>TIDE: {(tideLevel * 100).toFixed(0)}%</div>
          </div>
        </header>

        {/* Center / Intro */}
        {showIntro && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm transition-opacity duration-1000">
            <div className="text-center max-w-md p-8 border border-white/10 rounded-2xl bg-black/40 backdrop-blur-xl">
              <p className="mb-6 text-lg font-light leading-relaxed opacity-90" style={{ fontFamily: FONTS.body }}>
                "As above, so below."<br/><br/>
                Your biological rhythms are entangled with the cosmic web. 
                Use your hand to bridge the gap.
              </p>
              <button 
                onClick={startExperience}
                className="px-8 py-3 text-sm font-bold tracking-widest uppercase transition-all duration-300 border border-cyan-500/50 hover:bg-cyan-500/20 hover:border-cyan-400 text-cyan-100 rounded"
              >
                Initiate Link
              </button>
            </div>
          </div>
        )}

        {/* Footer / HUD */}
        {!showIntro && (
          <footer className="flex items-end justify-between w-full">
            {/* Left: Gesture Status */}
            <div className="font-mono text-xs space-y-1 opacity-70 w-48">
              <div className="flex items-center gap-2">
                <span className={`w-1 h-1 ${currentGesture !== GestureType.NONE ? 'bg-green-400' : 'bg-red-400'}`} />
                <span>HAND TRACKING: {currentGesture !== GestureType.NONE ? 'LOCKED' : 'SEARCHING'}</span>
              </div>
              <div>TYPE: {currentGesture}</div>
              <div>X: {handPos.x.toFixed(2)} Y: {handPos.y.toFixed(2)}</div>
            </div>

            {/* Right: Resonance Radar Dashboard */}
            <div className="w-96 h-64 relative bg-black/40 rounded-xl border border-white/10 backdrop-blur-md pointer-events-auto shadow-2xl overflow-hidden">
                <ChakraRadar resonance={resonance} />
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default App;