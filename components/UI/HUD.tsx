/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import {
  Heart, Zap, Trophy, MapPin, Diamond, Rocket,
  ArrowUpCircle, Shield, Activity, PlusCircle,
  Play, Palette, List, Pause, Volume2, VolumeX,
} from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, GEMINI_COLORS, ShopItem, RUN_SPEED_BASE, SkinType } from '../../types';
import { audio } from '../System/Audio';
import { saveHighScore, getLeaderboard } from '../../firebase';

// Available Shop Items
const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'DOUBLE_JUMP',
    name: 'DOUBLE JUMP',
    description: 'Jump again in mid-air. Essential for high obstacles.',
    cost: 1000,
    icon: ArrowUpCircle,
    oneTime: true,
  },
  {
    id: 'MAX_LIFE',
    name: 'MAX LIFE UP',
    description: 'Permanently adds a heart slot and heals you.',
    cost: 1500,
    icon: Activity,
  },
  {
    id: 'HEAL',
    name: 'REPAIR KIT',
    description: 'Restores 1 Life point instantly.',
    cost: 1000,
    icon: PlusCircle,
  },
  {
    id: 'IMMORTAL',
    name: 'IMMORTALITY',
    description: 'Unlock Ability: Press Space/Tap to be invincible for 5s.',
    cost: 3000,
    icon: Shield,
    oneTime: true,
  },
];

// ─── Mute Button ─────────────────────────────────────────────────────────────
const MuteButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isMuted, toggleMute } = useStore();
  return (
    <button
      onClick={toggleMute}
      title={isMuted ? 'Unmute' : 'Mute'}
      className={`p-2 bg-black/50 border border-white/10 rounded-lg hover:bg-white/10 transition-all pointer-events-auto ${className}`}
    >
      {isMuted
        ? <VolumeX className="text-gray-400 w-5 h-5" />
        : <Volume2 className="text-white w-5 h-5" />}
    </button>
  );
};

// ─── Shop Screen ─────────────────────────────────────────────────────────────
const ShopScreen: React.FC = () => {
  const { score, buyItem, closeShop, hasDoubleJump, hasImmortality } = useStore();

  // FIX: include hasDoubleJump / hasImmortality in deps so the filter is fresh
  const items = React.useMemo(() => {
    let pool = SHOP_ITEMS.filter(item => {
      if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) return false;
      if (item.id === 'IMMORTAL'    && hasImmortality)  return false;
      return true;
    });
    pool = [...pool].sort(() => 0.5 - Math.random());
    return pool.slice(0, 3);
  }, [hasDoubleJump, hasImmortality]);

  return (
    <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
      <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
        <div className="flex items-center justify-between w-full max-w-4xl mb-2">
          <h2 className="text-3xl md:text-4xl font-black text-cyan-400 font-cyber tracking-widest">CYBER SHOP</h2>
          <MuteButton />
        </div>

        <div className="flex items-center text-yellow-400 mb-6 md:mb-8">
          <span className="text-base md:text-lg mr-2">AVAILABLE CREDITS:</span>
          <span className="text-xl md:text-2xl font-bold">{score.toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl w-full mb-8">
          {items.map(item => {
            const Icon = item.icon;
            const canAfford = score >= item.cost;
            return (
              <div
                key={item.id}
                className="bg-gray-900/80 border border-gray-700 p-4 md:p-6 rounded-xl flex flex-col items-center text-center hover:border-cyan-500 transition-colors"
              >
                <div className="bg-gray-800 p-3 md:p-4 rounded-full mb-3 md:mb-4">
                  <Icon className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">{item.name}</h3>
                <p className="text-gray-400 text-xs md:text-sm mb-4 h-10 md:h-12 flex items-center justify-center">
                  {item.description}
                </p>
                <button
                  onClick={() => buyItem(item.id as any, item.cost)}
                  disabled={!canAfford}
                  className={`px-4 md:px-6 py-2 rounded font-bold w-full text-sm md:text-base ${
                    canAfford
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110'
                      : 'bg-gray-700 cursor-not-allowed opacity-50'
                  }`}
                >
                  {item.cost} GEMS
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={closeShop}
          className="flex items-center px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,0,255,0.4)]"
        >
          RESUME MISSION <Play className="ml-2 w-5 h-5" fill="white" />
        </button>
      </div>
    </div>
  );
};

// ─── Pause Screen ─────────────────────────────────────────────────────────────
const PauseScreen: React.FC = () => {
  const { resumeGame, restartGame, setStatus } = useStore();
  return (
    <div className="absolute inset-0 bg-black/80 z-[200] text-white pointer-events-auto backdrop-blur-md flex flex-col items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <MuteButton />
      </div>
      <h2 className="text-5xl font-black text-cyan-400 mb-12 font-cyber tracking-widest uppercase">
        Mission Paused
      </h2>
      <div className="flex flex-col space-y-6 w-full max-w-xs">
        <button
          onClick={resumeGame}
          className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xl rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.3)] flex items-center justify-center"
        >
          <Play className="mr-3 fill-white" /> RESUME
        </button>
        <button
          onClick={restartGame}
          className="w-full py-4 bg-white/10 border border-white/20 text-white font-bold text-lg rounded-xl hover:bg-white/20 transition-all"
        >
          RESTART MISSION
        </button>
        <button
          onClick={() => setStatus(GameStatus.MENU)}
          className="w-full py-4 text-gray-400 hover:text-white transition-all font-mono text-sm tracking-widest"
        >
          [ ABORT MISSION ]
        </button>
      </div>
    </div>
  );
};

// ─── Skin Shop ────────────────────────────────────────────────────────────────
const SkinShop: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { gemsCollected, currentSkin, unlockedSkins, setSkin, unlockSkin } = useStore();

  const skins = [
    { type: SkinType.DEFAULT,   name: 'CLASSIC NEON', cost: 0,    color: '#00aaff' },
    { type: SkinType.NEON_BLUE, name: 'DEEP BLUE',    cost: 500,  color: '#0066ff' },
    { type: SkinType.NEON_GOLD, name: 'CYBER GOLD',   cost: 1000, color: '#ffaa00' },
    { type: SkinType.PHANTOM,   name: 'PHANTOM',      cost: 2000, color: '#ff00ff' },
  ];

  return (
    <div className="absolute inset-0 bg-black/95 z-[110] text-white pointer-events-auto backdrop-blur-lg flex flex-col items-center justify-center p-8">
      <h2 className="text-4xl font-black text-pink-500 mb-8 font-cyber tracking-widest">SKIN PROTOCOLS</h2>
      <div className="flex items-center text-cyan-400 mb-8">
        <Diamond className="mr-2" />
        <span className="text-2xl font-bold">{gemsCollected}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl mb-12">
        {skins.map(skin => {
          const isUnlocked = unlockedSkins.includes(skin.type);
          const isSelected = currentSkin === skin.type;
          const canAfford  = gemsCollected >= skin.cost;

          return (
            <div
              key={skin.type}
              className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center ${
                isSelected ? 'border-white bg-white/10' : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="w-16 h-16 rounded-full mb-4 shadow-lg" style={{ backgroundColor: skin.color }} />
              <h3 className="font-bold mb-4 text-center">{skin.name}</h3>
              {isUnlocked ? (
                <button
                  onClick={() => setSkin(skin.type)}
                  className={`w-full py-2 rounded font-bold ${isSelected ? 'bg-white text-black' : 'bg-gray-700 text-white'}`}
                >
                  {isSelected ? 'ACTIVE' : 'SELECT'}
                </button>
              ) : (
                <button
                  onClick={() => unlockSkin(skin.type, skin.cost)}
                  disabled={!canAfford}
                  className={`w-full py-2 rounded font-bold ${canAfford ? 'bg-pink-600' : 'bg-gray-800 text-gray-500'}`}
                >
                  {skin.cost} GEMS
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={onClose} className="px-12 py-4 bg-white text-black font-black rounded-full hover:scale-105 transition-all">
        BACK TO MENU
      </button>
    </div>
  );
};

// ─── Leaderboard Modal ────────────────────────────────────────────────────────
const LeaderboardModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [scores, setScores]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // FIX: catch Firebase errors gracefully instead of letting them propagate
    getLeaderboard()
      .then(data => { if (mounted) { setScores(data); setLoading(false); } })
      .catch(err  => {
        console.warn('Leaderboard fetch failed:', err);
        if (mounted) { setError('Could not load rankings. Check your connection.'); setLoading(false); }
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="absolute inset-0 bg-black/95 z-[110] text-white pointer-events-auto backdrop-blur-lg flex flex-col items-center justify-center p-8">
      <h2 className="text-4xl font-black text-yellow-500 mb-8 font-cyber tracking-widest">GLOBAL RANKINGS</h2>

      <div className="w-full max-w-md bg-gray-900/50 rounded-2xl border border-gray-800 p-6 mb-8 overflow-y-auto max-h-[60vh]">
        {loading ? (
          <div className="flex justify-center py-12">
            <Zap className="animate-spin text-yellow-500" />
          </div>
        ) : error ? (
          <p className="text-center text-red-400 font-mono text-sm py-8">{error}</p>
        ) : scores.length === 0 ? (
          <p className="text-center text-gray-500 font-mono text-sm py-8">No scores yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {scores.map((s, i) => (
              <div key={i} className="flex justify-between items-center p-3 border-b border-gray-800">
                <div className="flex items-center">
                  <span className={`w-8 font-bold ${i < 3 ? 'text-yellow-400' : 'text-gray-500'}`}>{i + 1}</span>
                  <span className="font-medium">{s.name}</span>
                </div>
                <span className="font-mono text-cyan-400">{s.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onClose} className="px-12 py-4 bg-white text-black font-black rounded-full hover:scale-105 transition-all">
        CLOSE
      </button>
    </div>
  );
};

// ─── Main HUD ─────────────────────────────────────────────────────────────────
export const HUD: React.FC = () => {
  const {
    score, lives, maxLives, collectedLetters, status, level,
    restartGame, startGame, gemsCollected, distance,
    isImmortalityActive, speed, shieldActive, magnetActive,
    speedBoostActive, pauseGame,
  } = useStore();

  const [showSkins,       setShowSkins]       = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName,      setPlayerName]      = useState(localStorage.getItem('gemini_player_name') || '');
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [submitError,     setSubmitError]     = useState<string | null>(null);

  const target = ['G', 'E', 'M', 'I', 'N', 'I'];

  if (status === GameStatus.SHOP)   return <ShopScreen />;
  if (status === GameStatus.PAUSED) return <PauseScreen />;

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (status === GameStatus.MENU) {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
        <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.2)] border border-white/10 animate-in zoom-in-95 duration-500">
          <div className="relative w-full bg-gray-900">
            <img
              src="https://www.gstatic.com/aistudio/starter-apps/gemini_runner/gemini_runner.png"
              alt="Gemini Runner Cover"
              className="w-full h-auto block"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050011] via-black/30 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end items-center p-6 pb-8 text-center z-10">
              <button
                onClick={() => { audio.init(); startGame(); }}
                className="w-full group relative px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-xl rounded-xl hover:bg-white/20 transition-all shadow-[0_0_20px_rgba(0,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,255,255,0.4)] hover:border-cyan-400 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-pink-500/40 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative z-10 tracking-widest flex items-center justify-center">
                  INITIALIZE RUN <Play className="ml-2 w-5 h-5 fill-white" />
                </span>
              </button>

              <p className="text-cyan-400/60 text-[10px] md:text-xs font-mono mt-3 tracking-wider">
                [ ARROWS / SWIPE TO MOVE ]
              </p>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => setShowSkins(true)}
                  className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
                >
                  <Palette className="text-pink-500" />
                </button>
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"
                >
                  <List className="text-yellow-500" />
                </button>
                <MuteButton className="rounded-full border-white/10 bg-white/5" />
              </div>
            </div>
          </div>
        </div>

        {showSkins       && <SkinShop          onClose={() => setShowSkins(false)}       />}
        {showLeaderboard && <LeaderboardModal  onClose={() => setShowLeaderboard(false)} />}
      </div>
    );
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (status === GameStatus.GAME_OVER) {
    const handleScoreSubmit = async () => {
      if (!playerName.trim() || isSubmitting) return;
      setIsSubmitting(true);
      setSubmitError(null);
      localStorage.setItem('gemini_player_name', playerName);

      // FIX: wrap Firebase call in try/catch so an error never crashes the UI
      try {
        await saveHighScore(playerName, score);
        setShowLeaderboard(true);
      } catch (err) {
        console.warn('Score submit failed:', err);
        setSubmitError('Could not submit score. Check your connection and try again.');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-sm overflow-y-auto">
        <div className="absolute top-4 right-4">
          <MuteButton />
        </div>

        <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] font-cyber text-center">
            GAME OVER
          </h1>

          <div className="w-full max-w-md mb-8">
            <div className="bg-gray-900/80 p-6 rounded-xl border border-gray-700 mb-4">
              <label className="block text-xs text-gray-400 mb-2 tracking-widest uppercase">
                TRANSMIT SCORE TO COSMOS
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="ENTER NAME"
                  className="flex-1 bg-black border border-gray-700 rounded px-4 py-2 font-mono text-cyan-400 focus:border-cyan-500 outline-none"
                />
                <button
                  onClick={handleScoreSubmit}
                  disabled={isSubmitting || !playerName.trim()}
                  className="bg-yellow-600 px-4 py-2 rounded font-bold disabled:opacity-50"
                >
                  {isSubmitting ? '...' : 'SUBMIT'}
                </button>
              </div>
              {submitError && (
                <p className="text-red-400 text-xs mt-2 font-mono">{submitError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:gap-4 text-center mb-8 w-full max-w-md">
            <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
              <div className="flex items-center text-yellow-400 text-sm md:text-base">
                <Trophy className="mr-2 w-4 h-4 md:w-5 md:h-5" /> LEVEL
              </div>
              <div className="text-xl md:text-2xl font-bold font-mono">{level} / 3</div>
            </div>
            <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
              <div className="flex items-center text-cyan-400 text-sm md:text-base">
                <Diamond className="mr-2 w-4 h-4 md:w-5 md:h-5" /> GEMS COLLECTED
              </div>
              <div className="text-xl md:text-2xl font-bold font-mono">{gemsCollected}</div>
            </div>
            <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
              <div className="flex items-center text-purple-400 text-sm md:text-base">
                <MapPin className="mr-2 w-4 h-4 md:w-5 md:h-5" /> DISTANCE
              </div>
              <div className="text-xl md:text-2xl font-bold font-mono">{Math.floor(distance)} LY</div>
            </div>
            <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg flex items-center justify-between mt-2">
              <div className="flex items-center text-white text-sm md:text-base">TOTAL SCORE</div>
              <div className="text-2xl md:text-3xl font-bold font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                {score.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            onClick={() => { audio.init(); restartGame(); }}
            className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
          >
            RUN AGAIN
          </button>
        </div>

        {showLeaderboard && <LeaderboardModal onClose={() => setShowLeaderboard(false)} />}
      </div>
    );
  }

  // ── VICTORY ───────────────────────────────────────────────────────────────
  if (status === GameStatus.VICTORY) {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/90 to-black/95 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
        <div className="absolute top-4 right-4">
          <MuteButton />
        </div>
        <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
          <Rocket className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" />
          <h1 className="text-3xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-pink-500 mb-2 font-cyber text-center leading-tight">
            MISSION COMPLETE
          </h1>
          <p className="text-cyan-300 text-sm md:text-2xl font-mono mb-8 tracking-widest text-center">
            THE ANSWER TO THE UNIVERSE HAS BEEN FOUND
          </p>

          <div className="grid grid-cols-1 gap-4 text-center mb-8 w-full max-w-md">
            <div className="bg-black/60 p-6 rounded-xl border border-yellow-500/30 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
              <div className="text-xs md:text-sm text-gray-400 mb-1 tracking-wider">FINAL SCORE</div>
              <div className="text-3xl md:text-4xl font-bold font-cyber text-yellow-400">{score.toLocaleString()}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/60 p-4 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400">GEMS</div>
                <div className="text-xl md:text-2xl font-bold text-cyan-400">{gemsCollected}</div>
              </div>
              <div className="bg-black/60 p-4 rounded-lg border border-white/10">
                <div className="text-xs text-gray-400">DISTANCE</div>
                <div className="text-xl md:text-2xl font-bold text-purple-400">{Math.floor(distance)} LY</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => { audio.init(); restartGame(); }}
            className="px-8 md:px-12 py-4 md:py-5 bg-white text-black font-black text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] tracking-widest"
          >
            RESTART MISSION
          </button>
        </div>
      </div>
    );
  }

  // ── PLAYING HUD ───────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50">

      {/* Top bar */}
      <div className="flex justify-between items-start w-full">
        <div className="flex items-center space-x-2">
          <button
            onClick={pauseGame}
            className="p-2 bg-black/50 border border-white/10 rounded-lg hover:bg-white/10 transition-all pointer-events-auto"
          >
            <Pause className="text-white w-6 h-6" />
          </button>
          <MuteButton />
          <div className="text-3xl md:text-5xl font-bold text-cyan-400 drop-shadow-[0_0_10px_#00ffff] font-cyber ml-2">
            {score.toLocaleString()}
          </div>
        </div>

        <div className="flex space-x-1 md:space-x-2">
          {[...Array(maxLives)].map((_, i) => (
            <Heart
              key={i}
              className={`w-6 h-6 md:w-8 md:h-8 ${
                i < lives ? 'text-pink-500 fill-pink-500' : 'text-gray-800 fill-gray-800'
              } drop-shadow-[0_0_5px_#ff0054]`}
            />
          ))}
        </div>
      </div>

      {/* Level indicator */}
      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 text-sm md:text-lg text-purple-300 font-bold tracking-wider font-mono bg-black/50 px-3 py-1 rounded-full border border-purple-500/30 backdrop-blur-sm z-50">
        LEVEL {level} <span className="text-gray-500 text-xs md:text-sm">/ 3</span>
      </div>

      {/* Active power-up indicators */}
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center space-y-2">
        {isImmortalityActive && (
          <div className="text-yellow-400 font-bold text-xl md:text-2xl animate-pulse flex items-center drop-shadow-[0_0_10px_gold]">
            <Shield className="mr-2 fill-yellow-400" /> IMMORTAL
          </div>
        )}
        {shieldActive && (
          <div className="text-cyan-400 font-bold text-lg md:text-xl flex items-center drop-shadow-[0_0_10px_cyan]">
            <Shield className="mr-2" /> SHIELD ACTIVE
          </div>
        )}
        {magnetActive && (
          <div className="text-pink-400 font-bold text-lg md:text-xl flex items-center drop-shadow-[0_0_10px_pink] animate-bounce">
            <Zap className="mr-2 fill-pink-400" /> MAGNET ACTIVE
          </div>
        )}
        {speedBoostActive && (
          <div className="text-yellow-400 font-bold text-lg md:text-xl flex items-center drop-shadow-[0_0_10px_yellow] italic">
            <Rocket className="mr-2" /> SPEED BOOST
          </div>
        )}
      </div>

      {/* GEMINI letter collection */}
      <div className="absolute top-16 md:top-24 left-1/2 transform -translate-x-1/2 flex space-x-2 md:space-x-3">
        {target.map((char, idx) => {
          const isCollected = collectedLetters.includes(idx);
          const color = GEMINI_COLORS[idx];
          return (
            <div
              key={idx}
              style={{
                borderColor:     isCollected ? color : 'rgba(55,65,81,1)',
                color:           isCollected ? 'rgba(0,0,0,0.8)' : 'rgba(55,65,81,1)',
                boxShadow:       isCollected ? `0 0 20px ${color}` : 'none',
                backgroundColor: isCollected ? color : 'rgba(0,0,0,0.9)',
              }}
              className="w-8 h-10 md:w-10 md:h-12 flex items-center justify-center border-2 font-black text-lg md:text-xl font-cyber rounded-lg transform transition-all duration-300"
            >
              {char}
            </div>
          );
        })}
      </div>

      {/* Speed readout */}
      <div className="w-full flex justify-end items-end">
        <div className="flex items-center space-x-2 text-cyan-500 opacity-70">
          <Zap className="w-4 h-4 md:w-6 md:h-6 animate-pulse" />
          <span className="font-mono text-base md:text-xl">
            SPEED {Math.round((speed / RUN_SPEED_BASE) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
