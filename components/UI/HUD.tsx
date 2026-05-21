/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Heart, Zap, Trophy, MapPin, Diamond, Rocket, ArrowUpCircle,
  Shield, Activity, PlusCircle, Play, Palette, Pause,
  Volume2, VolumeX, Star, Award, Target, CheckCircle2,
} from 'lucide-react';
import { useStore } from '../../store';
import {
  GameStatus, GEMINI_COLORS, RUN_SPEED_BASE, SkinType, BiomeType,
  BIOME_BY_LEVEL, BIOME_COLORS,
} from '../../types';
import { audio } from '../System/Audio';

// ─── Mute button ──────────────────────────────────────────────────────────────
const MuteBtn: React.FC = () => {
  const { isMuted, toggleMute } = useStore();
  return (
    <button onClick={toggleMute} className="p-2 bg-black/50 border border-white/10 rounded-lg hover:bg-white/10 transition-all pointer-events-auto">
      {isMuted ? <VolumeX className="text-gray-400 w-5 h-5" /> : <Volume2 className="text-white w-5 h-5" />}
    </button>
  );
};

// ─── XP bar ───────────────────────────────────────────────────────────────────
const XPBar: React.FC = () => {
  const { xp, playerLevel } = useStore();
  const needed = playerLevel * playerLevel * 500;
  const prev   = (playerLevel-1)*(playerLevel-1)*500;
  const pct    = Math.min(100, Math.round(((xp - prev) / (needed - prev)) * 100));
  return (
    <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full border border-white/10">
      <Star className="text-yellow-400 w-4 h-4" />
      <span className="text-yellow-300 text-xs font-bold font-mono">Lv.{playerLevel}</span>
      <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 text-xs font-mono">{pct}%</span>
    </div>
  );
};

// ─── Combo display ────────────────────────────────────────────────────────────
const ComboDisplay: React.FC = () => {
  const { comboMultiplier, comboStreak } = useStore();
  if (comboMultiplier < 2) return null;
  return (
    <div className={`text-center animate-pulse ${comboMultiplier >= 8 ? 'text-red-400' : comboMultiplier >= 5 ? 'text-orange-400' : 'text-yellow-400'}`}>
      <div className="text-2xl font-black font-cyber drop-shadow-[0_0_8px_currentColor]">×{comboMultiplier} COMBO</div>
      <div className="text-xs font-mono text-gray-400">{comboStreak} streak</div>
    </div>
  );
};

// ─── Achievement toast ────────────────────────────────────────────────────────
const AchievementToast: React.FC = () => {
  const { newAchievements, achievements, dismissAchievements } = useStore();
  const items = achievements.filter(a => newAchievements.includes(a.id));
  if (!items.length) return null;
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[300] pointer-events-auto">
      {items.map(a => (
        <div key={a.id} onClick={dismissAchievements}
          className="flex items-center gap-3 bg-yellow-900/90 border border-yellow-500 px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(255,215,0,0.3)] cursor-pointer">
          <span className="text-2xl">{a.icon}</span>
          <div>
            <div className="text-yellow-300 font-bold text-sm">Achievement Unlocked!</div>
            <div className="text-white font-black">{a.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Daily missions panel ─────────────────────────────────────────────────────
const MissionsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { dailyMissions, claimMissionReward } = useStore();
  return (
    <div className="absolute inset-0 bg-black/95 z-[110] text-white pointer-events-auto flex flex-col items-center justify-center p-6">
      <h2 className="text-3xl font-black text-cyan-400 mb-6 tracking-widest">DAILY MISSIONS</h2>
      <div className="w-full max-w-md space-y-4 mb-8">
        {dailyMissions.map(m => {
          const pct    = Math.min(100, Math.round((m.current / m.target) * 100));
          const claimed = m.current === -1;
          return (
            <div key={m.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-lg">{m.label}</div>
                  <div className="text-gray-400 text-sm">
                    {m.type === 'gems'     ? `Collect ${m.target} gems`    :
                     m.type === 'distance' ? `Run ${m.target} light years` :
                     m.type === 'letters' ? `Collect ${m.target} letters` :
                                            'Complete a run without damage'}
                  </div>
                </div>
                <div className="text-yellow-400 font-bold flex items-center gap-1">
                  <Diamond className="w-4 h-4" />{m.reward}
                </div>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{claimed ? 'Claimed' : m.completed ? 'Complete!' : `${m.current}/${m.target}`}</span>
                {m.completed && !claimed && (
                  <button onClick={() => claimMissionReward(m.id)}
                    className="flex items-center gap-1 bg-yellow-600 px-3 py-1 rounded font-bold text-sm hover:bg-yellow-500">
                    <CheckCircle2 className="w-4 h-4" /> Claim
                  </button>
                )}
                {claimed && <CheckCircle2 className="text-green-400 w-5 h-5" />}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onClose} className="px-10 py-3 bg-white text-black font-black rounded-full hover:scale-105 transition-all">BACK</button>
    </div>
  );
};

// ─── Achievements panel ───────────────────────────────────────────────────────
const AchievementsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { achievements } = useStore();
  return (
    <div className="absolute inset-0 bg-black/95 z-[110] text-white pointer-events-auto flex flex-col items-center justify-center p-6">
      <h2 className="text-3xl font-black text-yellow-400 mb-6 tracking-widest">ACHIEVEMENTS</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mb-8 overflow-y-auto max-h-[60vh]">
        {achievements.map(a => (
          <div key={a.id} className={`p-3 rounded-xl border flex items-center gap-3 ${a.unlocked ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-800 bg-gray-900/50 opacity-50'}`}>
            <span className="text-2xl">{a.icon}</span>
            <div>
              <div className="font-bold text-sm">{a.label}</div>
              <div className="text-gray-400 text-xs">{a.description}</div>
            </div>
            {a.unlocked && <CheckCircle2 className="ml-auto text-yellow-400 w-5 h-5 flex-shrink-0" />}
          </div>
        ))}
      </div>
      <button onClick={onClose} className="px-10 py-3 bg-white text-black font-black rounded-full hover:scale-105 transition-all">BACK</button>
    </div>
  );
};

// ─── Shop screen ──────────────────────────────────────────────────────────────
const ShopScreen: React.FC = () => {
  const { score, buyItem, closeShop, hasDoubleJump, hasImmortality } = useStore();
  const ITEMS = [
    { id:'DOUBLE_JUMP', name:'DOUBLE JUMP',  desc:'Jump again mid-air',          cost:1000, icon:ArrowUpCircle, one:true  },
    { id:'MAX_LIFE',    name:'MAX LIFE UP',  desc:'Adds a permanent heart slot', cost:1500, icon:Activity,      one:false },
    { id:'HEAL',        name:'REPAIR KIT',   desc:'Restores 1 life immediately', cost:800,  icon:PlusCircle,    one:false },
    { id:'IMMORTAL',    name:'IMMORTALITY',  desc:'5s invincibility on demand',  cost:3000, icon:Shield,        one:true  },
  ].filter(i => !(i.id==='DOUBLE_JUMP'&&hasDoubleJump) && !(i.id==='IMMORTAL'&&hasImmortality))
   .sort(()=>Math.random()-.5).slice(0,3);

  return (
    <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-md flex flex-col items-center justify-center p-6">
      <div className="flex items-center justify-between w-full max-w-2xl mb-2">
        <h2 className="text-3xl font-black text-cyan-400 tracking-widest">CYBER SHOP</h2>
        <MuteBtn />
      </div>
      <div className="flex items-center text-yellow-400 mb-6">
        <span className="mr-2">CREDITS:</span>
        <span className="text-2xl font-bold">{score.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-8">
        {ITEMS.map(item => {
          const Icon = item.icon;
          const can  = score >= item.cost;
          return (
            <div key={item.id} className="bg-gray-900 border border-gray-700 p-5 rounded-xl flex flex-col items-center text-center hover:border-cyan-500 transition-colors">
              <div className="bg-gray-800 p-3 rounded-full mb-3"><Icon className="w-7 h-7 text-cyan-400" /></div>
              <h3 className="font-bold text-lg mb-1">{item.name}</h3>
              <p className="text-gray-400 text-xs mb-4 h-8 flex items-center">{item.desc}</p>
              <button onClick={() => buyItem(item.id as any, item.cost)} disabled={!can}
                className={`px-5 py-2 rounded font-bold w-full text-sm ${can ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110' : 'bg-gray-700 opacity-50 cursor-not-allowed'}`}>
                {item.cost} GEMS
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={closeShop}
        className="flex items-center px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-lg rounded hover:scale-105 transition-all">
        RESUME <Play className="ml-2 w-5 h-5" fill="white" />
      </button>
    </div>
  );
};

// ─── Pause screen ─────────────────────────────────────────────────────────────
const PauseScreen: React.FC = () => {
  const { resumeGame, restartGame, setStatus } = useStore();
  return (
    <div className="absolute inset-0 bg-black/85 z-[200] text-white pointer-events-auto backdrop-blur-md flex flex-col items-center justify-center p-8">
      <div className="absolute top-4 right-4"><MuteBtn /></div>
      <h2 className="text-5xl font-black text-cyan-400 mb-10 tracking-widest">PAUSED</h2>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button onClick={resumeGame} className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 font-black text-xl rounded-xl hover:scale-105 transition-all flex items-center justify-center">
          <Play className="mr-3 fill-white" /> RESUME
        </button>
        <button onClick={restartGame} className="w-full py-3 bg-white/10 border border-white/20 font-bold rounded-xl hover:bg-white/20">RESTART</button>
        <button onClick={() => setStatus(GameStatus.MENU)} className="text-gray-400 hover:text-white text-sm tracking-widest">[ MAIN MENU ]</button>
      </div>
    </div>
  );
};

// ─── Skin shop ────────────────────────────────────────────────────────────────
const SkinShop: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { totalGems, currentSkin, unlockedSkins, setSkin, unlockSkin } = useStore();
  const SKINS = [
    { type:SkinType.DEFAULT,   name:'CLASSIC NEON', cost:0,    color:'#00aaff' },
    { type:SkinType.NEON_BLUE, name:'DEEP BLUE',    cost:500,  color:'#0066ff' },
    { type:SkinType.NEON_GOLD, name:'CYBER GOLD',   cost:1000, color:'#ffaa00' },
    { type:SkinType.PHANTOM,   name:'PHANTOM',      cost:2000, color:'#ff00ff' },
  ];
  return (
    <div className="absolute inset-0 bg-black/95 z-[110] text-white pointer-events-auto flex flex-col items-center justify-center p-6">
      <h2 className="text-3xl font-black text-pink-500 mb-4 tracking-widest">SKIN PROTOCOLS</h2>
      <div className="flex items-center text-cyan-400 mb-6"><Diamond className="mr-2" /><span className="text-xl font-bold">{totalGems}</span></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-xl mb-8">
        {SKINS.map(s => {
          const unlocked = unlockedSkins.includes(s.type);
          const selected = currentSkin === s.type;
          return (
            <div key={s.type} className={`p-4 rounded-xl border-2 flex flex-col items-center ${selected ? 'border-white bg-white/10' : 'border-gray-800 bg-gray-900'}`}>
              <div className="w-12 h-12 rounded-full mb-3" style={{ background: s.color }} />
              <div className="font-bold text-sm text-center mb-3">{s.name}</div>
              {unlocked
                ? <button onClick={() => setSkin(s.type)} className={`w-full py-1 rounded font-bold text-sm ${selected ? 'bg-white text-black' : 'bg-gray-700'}`}>{selected?'ACTIVE':'SELECT'}</button>
                : <button onClick={() => unlockSkin(s.type, s.cost)} disabled={totalGems < s.cost}
                    className={`w-full py-1 rounded font-bold text-sm ${totalGems >= s.cost ? 'bg-pink-600' : 'bg-gray-800 text-gray-500'}`}>{s.cost} GEMS</button>}
            </div>
          );
        })}
      </div>
      <button onClick={onClose} className="px-10 py-3 bg-white text-black font-black rounded-full hover:scale-105 transition-all">BACK</button>
    </div>
  );
};

// ─── MENU ─────────────────────────────────────────────────────────────────────
const MenuScreen: React.FC = () => {
  const { startGame, highScore, playerLevel, totalGems } = useStore();
  const [showSkins, setShowSkins] = useState(false);
  const [showAch,   setShowAch  ] = useState(false);
  const [showMiss,  setShowMiss ] = useState(false);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,255,255,0.15)]">
        <div className="bg-gradient-to-b from-purple-900/60 to-black p-8 flex flex-col items-center">
          <Rocket className="text-cyan-400 w-16 h-16 mb-3 animate-bounce" />
          <h1 className="text-4xl font-black text-white tracking-widest mb-1">GEMINI RUN</h1>
          <p className="text-cyan-400 font-mono text-sm tracking-widest mb-2">BEAT THE UNIVERSE</p>

          <div className="flex gap-4 text-sm mb-6">
            <span className="text-yellow-400 flex items-center gap-1"><Trophy className="w-4 h-4" />{highScore.toLocaleString()}</span>
            <span className="text-cyan-400 flex items-center gap-1"><Star className="w-4 h-4" />Lv.{playerLevel}</span>
            <span className="text-pink-400 flex items-center gap-1"><Diamond className="w-4 h-4" />{totalGems}</span>
          </div>

          <button onClick={() => { audio.init(); startGame(); }}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xl rounded-xl hover:brightness-110 transition-all mb-4 shadow-[0_0_20px_rgba(0,255,255,0.3)]">
            INITIALIZE RUN ▶
          </button>

          <div className="flex gap-3 mt-2">
            <button onClick={() => setShowSkins(true)} className="p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"><Palette className="text-pink-500 w-5 h-5" /></button>
            <button onClick={() => setShowAch(true)}   className="p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"><Award className="text-yellow-500 w-5 h-5" /></button>
            <button onClick={() => setShowMiss(true)}  className="p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all"><Target className="text-cyan-500 w-5 h-5" /></button>
            <MuteBtn />
          </div>

          <p className="text-gray-600 text-[10px] font-mono mt-4 tracking-wider text-center">ARROWS/SWIPE · ↓ SLIDE · ↑ JUMP · SPACE IMMORTAL</p>
        </div>
      </div>
      {showSkins && <SkinShop onClose={() => setShowSkins(false)} />}
      {showAch   && <AchievementsPanel onClose={() => setShowAch(false)} />}
      {showMiss  && <MissionsPanel onClose={() => setShowMiss(false)} />}
    </div>
  );
};

// ─── Game Over ────────────────────────────────────────────────────────────────
const GameOverScreen: React.FC = () => {
  const { score, highScore, restartGame, gemsCollected, distance, level, achievements, newAchievements, dismissAchievements, xp, playerLevel } = useStore();
  const [showAch, setShowAch] = useState(false);
  const newUnlocked = achievements.filter(a => newAchievements.includes(a.id));

  return (
    <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-black mb-2 text-red-400 drop-shadow-[0_0_10px_rgba(255,0,0,0.6)]">GAME OVER</h1>
      {newUnlocked.length > 0 && (
        <div className="mb-4 cursor-pointer" onClick={() => setShowAch(true)}>
          <div className="flex items-center gap-2 bg-yellow-900/80 border border-yellow-500 px-4 py-2 rounded-xl">
            <span className="text-lg">{newUnlocked[0].icon}</span>
            <span className="text-yellow-300 font-bold text-sm">{newUnlocked.length} Achievement{newUnlocked.length>1?'s':''} Unlocked! →</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6 mt-2">
        {[
          { label:'SCORE',    val: score.toLocaleString(),       color:'text-yellow-400' },
          { label:'BEST',     val: highScore.toLocaleString(),   color:'text-cyan-400'   },
          { label:'LEVEL',    val: `${level}/${5}`,              color:'text-purple-400' },
          { label:'GEMS',     val: gemsCollected,                color:'text-pink-400'   },
          { label:'DISTANCE', val: `${Math.floor(distance)} LY`, color:'text-green-400'  },
          { label:'XP',       val: `+${Math.floor(score/10)}`,   color:'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 p-3 rounded-lg text-center">
            <div className="text-gray-500 text-xs mb-1">{s.label}</div>
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>
      <button onClick={() => { audio.init(); restartGame(); }}
        className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 font-black text-xl rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.3)] mb-3">
        RUN AGAIN ▶
      </button>
      {showAch && <AchievementsPanel onClose={() => { setShowAch(false); dismissAchievements(); }} />}
    </div>
  );
};

// ─── Victory ──────────────────────────────────────────────────────────────────
const VictoryScreen: React.FC = () => {
  const { score, restartGame, gemsCollected, distance } = useStore();
  return (
    <div className="absolute inset-0 bg-black/95 z-[100] text-white pointer-events-auto flex flex-col items-center justify-center p-6">
      <Rocket className="w-20 h-20 text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_20px_gold]" />
      <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-pink-500 mb-2 text-center">MISSION COMPLETE</h1>
      <p className="text-cyan-300 font-mono tracking-widest mb-6 text-center">THE COSMOS HAS BEEN CONQUERED</p>
      <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-xs">
        <div className="bg-black/60 border border-yellow-500/30 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-400">SCORE</div><div className="text-xl font-bold text-yellow-400">{score.toLocaleString()}</div>
        </div>
        <div className="bg-black/60 border border-cyan-500/30 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-400">GEMS</div><div className="text-xl font-bold text-cyan-400">{gemsCollected}</div>
        </div>
        <div className="bg-black/60 border border-purple-500/30 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-400">DIST</div><div className="text-xl font-bold text-purple-400">{Math.floor(distance)}</div>
        </div>
      </div>
      <button onClick={() => { audio.init(); restartGame(); }}
        className="px-10 py-4 bg-white text-black font-black text-xl rounded-xl hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
        PLAY AGAIN ▶
      </button>
    </div>
  );
};

// ─── Main HUD (playing) ───────────────────────────────────────────────────────
const PlayingHUD: React.FC = () => {
  const {
    score, lives, maxLives, collectedLetters, level,
    gemsCollected, distance, isImmortalityActive, speed,
    shieldActive, magnetActive, speedBoostActive, isSliding,
    comboMultiplier, pauseGame,
  } = useStore();

  const TARGET = ['G','E','M','I','N','I'];
  const biome  = BIOME_BY_LEVEL[level] ?? BiomeType.NEON_CITY;
  const cols   = BIOME_COLORS[biome];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-6 z-50">
      {/* Top bar */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={pauseGame} className="p-2 bg-black/50 border border-white/10 rounded-lg hover:bg-white/10 pointer-events-auto">
            <Pause className="text-white w-5 h-5" />
          </button>
          <MuteBtn />
          <div className="text-2xl sm:text-4xl font-bold text-cyan-400 drop-shadow-[0_0_10px_#00ffff] font-cyber">{score.toLocaleString()}</div>
          {comboMultiplier >= 2 && (
            <div className={`px-2 py-0.5 rounded font-black text-sm ${comboMultiplier>=8?'bg-red-600':'comboMultiplier>=5'?'bg-orange-600':'bg-yellow-600'} text-white animate-pulse`}>
              ×{comboMultiplier}
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {Array.from({length:maxLives}).map((_,i)=>(
            <Heart key={i} className={`w-6 h-6 ${i<lives?'text-pink-500 fill-pink-500':'text-gray-800 fill-gray-800'}`} />
          ))}
        </div>
      </div>

      {/* Level badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <div className="bg-black/60 px-3 py-1 rounded-full border text-xs font-bold font-mono tracking-widest" style={{ borderColor: cols.dir, color: cols.dir }}>
          LEVEL {level} / {5} — {biome.replace('_',' ')}
        </div>
      </div>

      {/* Power-up indicators */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        {isImmortalityActive && <div className="text-yellow-400 font-black text-xl animate-pulse flex items-center gap-1"><Shield className="w-5 h-5 fill-yellow-400"/>IMMORTAL</div>}
        {shieldActive        && <div className="text-cyan-400 font-bold text-base flex items-center gap-1"><Shield className="w-4 h-4"/>SHIELD</div>}
        {magnetActive        && <div className="text-pink-400 font-bold text-base animate-bounce">⚡ MAGNET</div>}
        {speedBoostActive    && <div className="text-yellow-400 font-bold text-base italic">🚀 BOOST</div>}
        {isSliding           && <div className="text-green-400 font-bold text-base">▼ SLIDING</div>}
      </div>

      {/* Letter bar */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
        {TARGET.map((ch,idx)=>{
          const got = collectedLetters.includes(idx);
          return (
            <div key={idx} style={{
              borderColor: got ? GEMINI_COLORS[idx] : 'rgba(55,65,81,1)',
              color:        got ? '#000' : 'rgba(55,65,81,1)',
              boxShadow:    got ? `0 0 12px ${GEMINI_COLORS[idx]}` : 'none',
              background:   got ? GEMINI_COLORS[idx] : 'rgba(0,0,0,0.9)',
            }} className="w-7 h-9 sm:w-9 sm:h-11 flex items-center justify-center border-2 font-black text-sm sm:text-lg font-cyber rounded-lg transition-all">
              {ch}
            </div>
          );
        })}
      </div>

      {/* Bottom: XP + speed + distance */}
      <div className="flex justify-between items-end flex-wrap gap-2">
        <XPBar />
        <div className="flex gap-3 text-gray-500 text-xs font-mono">
          <span><MapPin className="inline w-3 h-3 mr-1" />{Math.floor(distance)} LY</span>
          <span><Zap className="inline w-3 h-3 mr-1" />{Math.round((speed/RUN_SPEED_BASE)*100)}%</span>
          <span><Diamond className="inline w-3 h-3 mr-1" />{gemsCollected}</span>
        </div>
      </div>

      {/* Achievement toasts */}
      <AchievementToast />
    </div>
  );
};

// ─── Root HUD switch ──────────────────────────────────────────────────────────
export const HUD: React.FC = () => {
  const { status } = useStore();
  if (status === GameStatus.SHOP)      return <ShopScreen />;
  if (status === GameStatus.PAUSED)    return <PauseScreen />;
  if (status === GameStatus.MENU)      return <MenuScreen />;
  if (status === GameStatus.GAME_OVER) return <GameOverScreen />;
  if (status === GameStatus.VICTORY)   return <VictoryScreen />;
  return <PlayingHUD />;
};
