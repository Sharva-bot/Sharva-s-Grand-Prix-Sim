import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GAME_CONFIG, GameState } from '../game/constants';
import { Gauge, Activity, Battery, Zap, Timer, Flag, Settings, Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

export default function Cockpit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const requestRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Error attempting to enable fullscreen:", err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!hasStarted || !canvasRef.current) return;

    try {
        // Initialize Engine
        engineRef.current = new GameEngine(canvasRef.current);
    } catch (e: any) {
        console.error("Failed to initialize game engine:", e);
        setError(e.message || "Game Engine Initialization Failed");
        return;
    }
    
    // Resize handler
    const handleResize = () => {
        if (canvasRef.current && canvasRef.current.parentElement) {
            canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
            canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Loop
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (engineRef.current) {
        engineRef.current.update(dt);
        engineRef.current.render();
        // Sync state for UI (throttle this if performance issues arise)
        setGameState({ ...engineRef.current.state });
      }

      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [hasStarted]);

  if (error) {
    return (
        <div className="flex items-center justify-center w-full h-screen bg-zinc-900 text-red-500 font-mono p-4 text-center">
            <div>
                <h1 className="text-2xl font-bold mb-2">SYSTEM FAILURE</h1>
                <p>{error}</p>
                <button 
                    className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
                    onClick={() => window.location.reload()}
                >
                    REBOOT SYSTEM
                </button>
            </div>
        </div>
    );
  }

  // if (!gameState) {
  //   return (
  //       <div className="flex items-center justify-center w-full h-screen bg-zinc-900 text-emerald-500 font-mono">
  //           <div className="animate-pulse">INITIALIZING SYSTEMS...</div>
  //       </div>
  //   );
  // }

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const mills = Math.floor((ms % 1000) / 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${mills.toString().padStart(2, '0')}`;
  };

  const rpmPercent = gameState ? Math.min(100, (gameState.rpm / 13000) * 100) : 0;
  const speedKmh = gameState ? Math.floor(gameState.speed / 2) : 0; // Adjusted for new max speed 600 -> 300kmh
  
  // Calculate shake
  const isOffRoad = gameState ? (gameState.playerX < -1 || gameState.playerX > 1) : false;
  const isCrashed = gameState?.crashed;
  
  let shakeAmount = 0;
  let rotateAmount = 0;
  let blurAmount = 0;

  if (isCrashed) {
      shakeAmount = 20;
      rotateAmount = (Math.random() - 0.5) * 10; // +/- 5 deg
      blurAmount = 4;
  } else if (isOffRoad) {
      shakeAmount = 5;
      rotateAmount = (Math.random() - 0.5) * 2;
      blurAmount = 1;
  } else if (speedKmh > 100) {
      shakeAmount = 1;
  }

  const shakeStyle = shakeAmount > 0 ? {
    transform: `translate(${Math.random() * shakeAmount - shakeAmount/2}px, ${Math.random() * shakeAmount - shakeAmount/2}px) rotate(${rotateAmount}deg)`,
    filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none'
  } : {};

  if (!hasStarted) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center w-full h-screen bg-zinc-900 text-white font-mono p-4 text-center select-none">
          <div className="max-w-2xl">
              <h1 className="text-5xl md:text-7xl font-black mb-4 skew-x-12 uppercase" style={{ textShadow: '5px 5px 0px rgba(0,0,0,0.5)' }}>
                  FORMULA RACING
              </h1>
              <p className="text-xl text-zinc-400 mb-12 uppercase tracking-widest">
                  This game is made By Sharva Gavalkar
              </p>
              
              <button 
                  className="group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xl uppercase tracking-widest skew-x-12 transition-all shadow-[0_0_20px_rgba(5,150,105,0.5)] hover:shadow-[0_0_40px_rgba(16,185,129,0.8)]"
                  onClick={() => setHasStarted(true)}
              >
                  <span className="block -skew-x-12 flex items-center gap-2">
                      <Play size={28} fill="currentColor" />
                      PLAY NOW
                  </span>
              </button>
          </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-zinc-900 overflow-hidden font-mono select-none">
      {/* Game Canvas */}
      <div className="absolute inset-0 z-0" style={shakeStyle}>
          <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

        {/* Loading Overlay */}
        {!gameState && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900 text-emerald-500 font-mono">
                <div className="animate-pulse">INITIALIZING SYSTEMS...</div>
            </div>
        )}
        
        {/* Pit Stop Overlay (Only when stopped) */}
        {gameState && gameState.pitPhase === 'stopped' && (
            <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/50 backdrop-blur-sm">
                 <div className="text-center">
                    <h2 className="text-4xl font-bold text-white mb-2 uppercase italic animate-pulse">Pit Stop</h2>
                    <div className="text-6xl font-mono text-emerald-400">
                        {(gameState.pitTimer / 1000).toFixed(2)}
                    </div>
                 </div>
            </div>
        )}

        {/* Crash Overlay */}
        {gameState && gameState.crashed && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-sm animate-pulse">
                <h1 className="text-6xl md:text-9xl font-black text-white mb-4 tracking-tighter skew-x-12 uppercase" style={{ textShadow: '10px 10px 0px rgba(0,0,0,0.5)' }}>
                    CRITICAL DAMAGE
                </h1>
                <div className="text-2xl md:text-4xl font-mono text-white bg-black px-4 py-2 mb-8">
                    SYSTEM FAILURE DETECTED
                </div>
                <div className="w-64 h-2 bg-black rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-white transition-all duration-100 ease-linear"
                        style={{ width: `${100 - (gameState.crashTimer / 2000) * 100}%` }}
                    />
                </div>
                <div className="mt-2 text-xs font-mono text-white animate-pulse">
                    REBOOTING SYSTEMS...
                </div>
            </div>
        )}

        {/* Start Lights Overlay */}
        {gameState && !gameState.raceStarted && (
            <div className="absolute top-10 left-0 right-0 flex justify-center z-50 pointer-events-none">
                <div className="bg-black p-4 rounded-xl border-4 border-zinc-800 flex gap-4 shadow-2xl">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-16 h-16 rounded-full border-4 border-zinc-700 transition-all duration-100 ${
                                gameState.startSequence > i 
                                ? 'bg-red-600 shadow-[0_0_30px_rgba(220,38,38,1)] border-red-800' 
                                : 'bg-zinc-900'
                            }`}
                        />
                    ))}
                </div>
            </div>
        )}

        {/* Mute & Fullscreen Buttons */}
        {gameState && (
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <button 
                    className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
                    onClick={toggleFullscreen}
                >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
                <button 
                    className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
                    onClick={() => engineRef.current?.toggleMute()}
                >
                    {gameState.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
            </div>
        )}

        {/* Start Hint */}
        {/* {gameState && gameState.speed < 10 && gameState.gear === 0 && (
            <div className="absolute bottom-12 left-0 right-0 flex justify-center z-30 pointer-events-none">
                <div className="bg-black/50 backdrop-blur text-yellow-400 font-bold text-lg animate-pulse px-6 py-2 rounded border border-yellow-500/50">
                    SHIFT TO 1ST GEAR (PRESS D) TO START
                </div>
            </div>
        )} */}

      {/* HUD Overlays */}
      {gameState && (
        <>
          {/* Top Left: Telemetry & Lap */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <div className="bg-black/70 backdrop-blur p-2 rounded-lg border border-zinc-800 shadow-xl">
                  <div className="flex justify-between items-center mb-1">
                      <div className="text-xs text-zinc-300 uppercase tracking-widest font-bold">Lap {gameState.lap}</div>
                      <div className="text-[10px] text-emerald-500 animate-pulse">LIVE</div>
                  </div>
                  
                  {/* RPM Bar */}
                  <div className="flex gap-0.5 h-2 w-32 md:w-48 mb-1">
                      {Array.from({ length: 20 }).map((_, i) => {
                          const active = (i / 20) * 100 < rpmPercent;
                          let color = 'bg-zinc-800';
                          if (active) {
                              if (i < 10) color = 'bg-green-500';
                              else if (i < 16) color = 'bg-yellow-500';
                              else color = 'bg-red-600';
                          }
                          return <div key={i} className={`flex-1 rounded-sm ${color}`} />;
                      })}
                  </div>
                  <div className="flex justify-between text-[8px] text-zinc-500 font-mono">
                      <span>0</span>
                      <span>RPM {Math.round(gameState.rpm)}</span>
                      <span>13k</span>
                  </div>
              </div>
          </div>

          {/* Top Right: Car Status (below mute button) */}
          <div className="absolute top-14 right-4 z-20 flex flex-col gap-2 w-36 md:w-40">
              <div className="bg-black/70 backdrop-blur p-2 rounded-lg border border-zinc-800 shadow-xl space-y-2">
                  <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                          <span className="flex items-center gap-1"><Activity size={10}/> Tires ({gameState.tyreCompound})</span>
                          <span>{Math.round(gameState.tires)}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                          <div className={`h-full ${gameState.tires < 30 ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${gameState.tires}%` }} />
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                          <span className="flex items-center gap-1"><Battery size={10}/> Fuel</span>
                          <span>{Math.round(gameState.fuel)}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                          <div className={`h-full ${gameState.fuel < 20 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${gameState.fuel}%` }} />
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 uppercase mb-0.5">
                          <span className="flex items-center gap-1"><Zap size={10}/> ERS</span>
                          <span>100%</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400" style={{ width: '100%' }} />
                      </div>
                  </div>
              </div>
          </div>

          {/* Bottom Right: Gear & Speed */}
          <div className="absolute bottom-4 right-4 z-20">
              <div className="bg-black/70 backdrop-blur p-3 rounded-lg border border-zinc-800 shadow-xl flex flex-col items-end min-w-[100px]">
                  <div className="text-zinc-500 text-[10px] uppercase mb-0.5">Gear</div>
                  <div className="text-5xl font-bold text-white leading-none mb-1" style={{ textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                      {gameState.gear === 0 ? 'N' : gameState.gear}
                  </div>
                  <div className="flex items-baseline gap-1">
                      <div className="text-2xl font-bold text-zinc-300">{speedKmh}</div>
                      <div className="text-xs text-zinc-500 font-bold">KMH</div>
                  </div>
              </div>
          </div>

          {/* Bottom Left: Pit Control & Hints */}
          <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2 w-48">
              {/* Gear Shift Hints */}
              {gameState.rpm > 12000 && gameState.gear < 6 && (
                  <div className="text-center text-red-500 font-bold text-[10px] animate-pulse border border-red-500/50 bg-red-500/20 p-1.5 rounded-lg backdrop-blur">
                      SHIFT UP (PRESS D)
                  </div>
              )}
              {gameState.rpm < 4000 && gameState.gear > 1 && gameState.speed > 10 && (
                  <div className="text-center text-yellow-500 font-bold text-[10px] animate-pulse border border-yellow-500/50 bg-yellow-500/20 p-1.5 rounded-lg backdrop-blur">
                      SHIFT DOWN (PRESS A)
                  </div>
              )}

              <div className="bg-black/70 backdrop-blur p-2 rounded-lg border border-zinc-800 shadow-xl">
                  {gameState.pitMenuOpen && (
                      <div className="mb-2 grid grid-cols-3 gap-1">
                          {(['soft', 'medium', 'hard'] as const).map((t) => (
                              <button
                                  key={t}
                                  className={`text-[8px] uppercase font-bold py-1.5 rounded border ${
                                      gameState.tyreCompound === t 
                                      ? 'bg-zinc-800 border-white text-white' 
                                      : 'bg-black border-zinc-700 text-zinc-500 hover:border-zinc-500'
                                  }`}
                                  onClick={() => engineRef.current?.setTyreCompound(t)}
                              >
                                  {t}
                              </button>
                          ))}
                      </div>
                  )}
                  <button 
                      className={`w-full py-2 rounded border-2 font-bold text-[10px] tracking-widest uppercase transition-all ${
                          gameState.pitMenuOpen 
                          ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' 
                          : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                      onClick={() => engineRef.current?.requestPit()}
                  >
                      {gameState.pitMenuOpen ? 'BOX CONFIRMED' : 'REQUEST PIT'}
                  </button>
                  <div className="mt-2 text-[8px] text-zinc-500 text-center uppercase tracking-widest leading-relaxed">
                      Arrows: Drive | A/D: Shift | P: Pit
                  </div>
              </div>
          </div>
        </>
      )}
    </div>
  );
}
