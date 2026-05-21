/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import { create } from 'zustand';
import {
  GameStatus, RUN_SPEED_BASE, PowerUpType, SkinType,
  DailyMission, Achievement, SPEED_PER_LETTER, SPEED_PER_LEVEL, MAX_LEVEL,
} from './types';
import { audio } from './components/System/Audio';

// ─── Timer registry ────────────────────────────────────────────────────────
const activeTimers = new Set<ReturnType<typeof setTimeout>>();
function safeTimeout(fn: () => void, ms: number) {
  const id = setTimeout(() => { activeTimers.delete(id); fn(); }, ms);
  activeTimers.add(id);
  return id;
}
function clearAllTimers() { activeTimers.forEach(clearTimeout); activeTimers.clear(); }

// ─── Persisted values ──────────────────────────────────────────────────────
const savedHighScore = Number(localStorage.getItem('gr_highscore')) || 0;
const savedMuted     = localStorage.getItem('gr_muted') === 'true';
const savedGems      = Number(localStorage.getItem('gr_gems')) || 0;
const savedXP        = Number(localStorage.getItem('gr_xp'))   || 0;
const savedSkins     = JSON.parse(localStorage.getItem('gr_skins') || '["DEFAULT"]') as SkinType[];

// ─── Daily missions pool ───────────────────────────────────────────────────
const MISSION_POOL: Omit<DailyMission, 'current' | 'completed'>[] = [
  { id: 'm1', label: 'Gem Hunter',    target: 30,   reward: 200, type: 'gems'     },
  { id: 'm2', label: 'Long Runner',   target: 1000, reward: 300, type: 'distance' },
  { id: 'm3', label: 'Word Wizard',   target: 6,    reward: 250, type: 'letters'  },
  { id: 'm4', label: 'Ghost Mode',    target: 1,    reward: 400, type: 'noHit'    },
  { id: 'm5', label: 'Mega Collector',target: 60,   reward: 400, type: 'gems'     },
  { id: 'm6', label: 'Speed Demon',   target: 2000, reward: 500, type: 'distance' },
];

function pickDailyMissions(): DailyMission[] {
  const todayKey = new Date().toDateString();
  const cached = localStorage.getItem('gr_missions');
  if (cached) {
    try {
      const { date, missions } = JSON.parse(cached);
      if (date === todayKey) return missions;
    } catch {}
  }
  const shuffled = [...MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  const missions = shuffled.map(m => ({ ...m, current: 0, completed: false }));
  localStorage.setItem('gr_missions', JSON.stringify({ date: todayKey, missions }));
  return missions;
}

function saveMissions(missions: DailyMission[]) {
  const todayKey = new Date().toDateString();
  localStorage.setItem('gr_missions', JSON.stringify({ date: todayKey, missions }));
}

// ─── Achievements ──────────────────────────────────────────────────────────
const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_run',   label: 'First Steps',    description: 'Complete your first run',         unlocked: false, icon: '🏃' },
  { id: 'dist_500',    label: 'Marathoner',      description: 'Travel 500 light years',          unlocked: false, icon: '🚀' },
  { id: 'dist_2000',   label: 'Deep Space',      description: 'Travel 2000 light years',         unlocked: false, icon: '🌌' },
  { id: 'gems_100',    label: 'Gem Hunter',      description: 'Collect 100 gems in one run',     unlocked: false, icon: '💎' },
  { id: 'level2',      label: 'Level Up',        description: 'Reach Level 2',                   unlocked: false, icon: '⬆️'  },
  { id: 'level5',      label: 'Galaxy Brain',    description: 'Reach Level 5',                   unlocked: false, icon: '🧠' },
  { id: 'no_hit',      label: 'Untouchable',     description: 'Finish without taking damage',    unlocked: false, icon: '🛡️'  },
  { id: 'score_10k',   label: 'High Scorer',     description: 'Score 10,000 in one run',         unlocked: false, icon: '🏆' },
  { id: 'combo_10',    label: 'Combo King',       description: 'Reach ×10 combo multiplier',      unlocked: false, icon: '🔥' },
];

function loadAchievements(): Achievement[] {
  try {
    const saved = JSON.parse(localStorage.getItem('gr_achievements') || '[]') as { id: string; unlocked: boolean }[];
    return ALL_ACHIEVEMENTS.map(a => ({ ...a, unlocked: saved.find(s => s.id === a.id)?.unlocked ?? false }));
  } catch { return ALL_ACHIEVEMENTS; }
}

function saveAchievements(list: Achievement[]) {
  localStorage.setItem('gr_achievements', JSON.stringify(list.map(a => ({ id: a.id, unlocked: a.unlocked }))));
}

// ─── Reset state factory ───────────────────────────────────────────────────
const getResetState = () => ({
  status: GameStatus.PLAYING as GameStatus,
  score: 0,
  lives: 3,
  maxLives: 3,
  speed: RUN_SPEED_BASE,
  collectedLetters: [] as number[],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,
  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,
  shieldActive: false,
  magnetActive: false,
  speedBoostActive: false,
  comboMultiplier: 1,
  comboStreak: 0,
  isSliding: false,
  screenShake: 0,
  noHitRun: true,
  newAchievements: [] as string[],
});

// ─── Store interface ───────────────────────────────────────────────────────
interface GameState {
  status: GameStatus;
  score: number;
  highScore: number;
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[];
  level: number;
  laneCount: number;
  gemsCollected: number;
  totalGems: number;       // persisted across runs
  distance: number;
  xp: number;              // persisted
  playerLevel: number;     // derived from xp

  shieldActive: boolean;
  magnetActive: boolean;
  speedBoostActive: boolean;

  currentSkin: SkinType;
  unlockedSkins: SkinType[];

  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  isMuted: boolean;
  comboMultiplier: number;
  comboStreak: number;
  isSliding: boolean;
  screenShake: number;       // trauma value 0-1, decays in frame loop
  noHitRun: boolean;
  newAchievements: string[]; // ids of just-unlocked achievements to show

  dailyMissions: DailyMission[];
  achievements: Achievement[];

  // Actions
  startGame: () => void;
  restartGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  togglePause: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  collectPowerUp: (type: PowerUpType) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  setSkin: (skin: SkinType) => void;
  unlockSkin: (skin: SkinType, cost: number) => boolean;
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
  toggleMute: () => void;
  startSlide: () => void;
  endSlide: () => void;
  breakCombo: () => void;
  applyScreenShake: (trauma: number) => void;
  decayScreenShake: (delta: number) => void;
  dismissAchievements: () => void;
  claimMissionReward: (id: string) => void;
}

const xpForLevel = (lvl: number) => lvl * lvl * 500;
const getPlayerLevel = (xp: number) => {
  let lvl = 1;
  while (xp >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
};

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  highScore: savedHighScore,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  totalGems: savedGems,
  distance: 0,
  xp: savedXP,
  playerLevel: getPlayerLevel(savedXP),

  shieldActive: false,
  magnetActive: false,
  speedBoostActive: false,

  currentSkin: SkinType.DEFAULT,
  unlockedSkins: savedSkins,

  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  isMuted: savedMuted,
  comboMultiplier: 1,
  comboStreak: 0,
  isSliding: false,
  screenShake: 0,
  noHitRun: true,
  newAchievements: [],

  dailyMissions: pickDailyMissions(),
  achievements: loadAchievements(),

  // ── helpers ──────────────────────────────────────────────────────────────
  startGame: () => { clearAllTimers(); set(getResetState()); },
  restartGame: () => { clearAllTimers(); set(getResetState()); },
  pauseGame: () => { if (get().status === GameStatus.PLAYING) set({ status: GameStatus.PAUSED }); },
  resumeGame: () => { if (get().status === GameStatus.PAUSED) set({ status: GameStatus.PLAYING }); },
  togglePause: () => {
    const { status } = get();
    if (status === GameStatus.PLAYING) set({ status: GameStatus.PAUSED });
    else if (status === GameStatus.PAUSED) set({ status: GameStatus.PLAYING });
  },

  startSlide: () => set({ isSliding: true }),
  endSlide:   () => safeTimeout(() => set({ isSliding: false }), 600),

  breakCombo: () => set({ comboMultiplier: 1, comboStreak: 0 }),

  applyScreenShake: (trauma) => set(s => ({ screenShake: Math.min(1, s.screenShake + trauma) })),
  decayScreenShake: (delta)  => set(s => ({ screenShake: Math.max(0, s.screenShake - delta * 2.5) })),

  dismissAchievements: () => set({ newAchievements: [] }),

  claimMissionReward: (id) => {
    const { dailyMissions, totalGems } = get();
    const m = dailyMissions.find(x => x.id === id);
    if (!m || !m.completed) return;
    const newMissions = dailyMissions.map(x => x.id === id ? { ...x, current: -1 } : x); // mark claimed
    const newTotal = totalGems + m.reward;
    localStorage.setItem('gr_gems', String(newTotal));
    saveMissions(newMissions);
    set({ dailyMissions: newMissions, totalGems: newTotal });
  },

  // ── takeDamage ────────────────────────────────────────────────────────────
  takeDamage: () => {
    const { lives, isImmortalityActive, shieldActive } = get();
    if (isImmortalityActive) return;
    if (shieldActive) { set({ shieldActive: false }); return; }
    get().applyScreenShake(0.6);
    get().breakCombo();
    set(s => ({ noHitRun: false }));
    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      const { score, highScore, distance, gemsCollected, level, noHitRun, achievements } = get();
      const newHigh = Math.max(score, highScore);
      if (score > highScore) localStorage.setItem('gr_highscore', String(score));

      // XP reward
      const xpEarned = Math.floor(score / 10) + distance + level * 100;
      const newXP = get().xp + xpEarned;
      localStorage.setItem('gr_xp', String(newXP));

      // Gems persist
      const newTotal = get().totalGems + gemsCollected;
      localStorage.setItem('gr_gems', String(newTotal));

      // Check achievements
      const unlocked: string[] = [];
      const newAch = achievements.map(a => {
        if (a.unlocked) return a;
        let unlock = false;
        if (a.id === 'first_run')  unlock = true;
        if (a.id === 'dist_500'  && distance >= 500)  unlock = true;
        if (a.id === 'dist_2000' && distance >= 2000) unlock = true;
        if (a.id === 'gems_100'  && gemsCollected >= 100) unlock = true;
        if (a.id === 'level2'    && level >= 2) unlock = true;
        if (a.id === 'level5'    && level >= 5) unlock = true;
        if (a.id === 'no_hit'    && noHitRun)   unlock = true;
        if (a.id === 'score_10k' && score >= 10000) unlock = true;
        if (unlock) { unlocked.push(a.id); return { ...a, unlocked: true }; }
        return a;
      });
      saveAchievements(newAch);

      // Update missions
      const missions = get().dailyMissions.map(m => {
        let cur = m.current;
        if (m.type === 'distance' && !m.completed) cur = Math.min(m.target, Math.floor(distance));
        if (m.type === 'letters'  && !m.completed) cur = Math.min(m.target, get().collectedLetters.length + cur);
        if (m.type === 'noHit'    && !m.completed && noHitRun) cur = 1;
        const completed = cur >= m.target;
        return { ...m, current: cur, completed };
      });
      saveMissions(missions);

      set({
        lives: 0, status: GameStatus.GAME_OVER, speed: 0,
        highScore: newHigh, xp: newXP, playerLevel: getPlayerLevel(newXP),
        totalGems: newTotal, achievements: newAch, newAchievements: unlocked,
        dailyMissions: missions,
      });
    }
  },

  // ── addScore ──────────────────────────────────────────────────────────────
  addScore: (amount) => set(s => ({ score: s.score + amount })),

  // ── collectGem ────────────────────────────────────────────────────────────
  collectGem: (value) => {
    const { comboStreak, comboMultiplier, dailyMissions } = get();
    const newStreak = comboStreak + 1;
    const newMult   = Math.min(10, 1 + Math.floor(newStreak / 5));
    const earned    = value * newMult;

    // Check combo achievement
    const newAch = newMult >= 10 ? get().achievements.map(a =>
      a.id === 'combo_10' && !a.unlocked ? { ...a, unlocked: true } : a
    ) : get().achievements;
    if (newMult >= 10) saveAchievements(newAch);

    // Update gem missions in-flight
    const missions = dailyMissions.map(m => {
      if (m.type === 'gems' && !m.completed) {
        const cur = Math.min(m.target, m.current + 1);
        return { ...m, current: cur, completed: cur >= m.target };
      }
      return m;
    });

    set(s => ({
      score: s.score + earned,
      gemsCollected: s.gemsCollected + 1,
      comboStreak: newStreak,
      comboMultiplier: newMult,
      achievements: newAch,
      dailyMissions: missions,
    }));
  },

  // ── collectPowerUp ────────────────────────────────────────────────────────
  collectPowerUp: (type) => {
    switch (type) {
      case PowerUpType.SHIELD:
        audio.playShieldActivate();
        set({ shieldActive: true });
        break;
      case PowerUpType.MAGNET:
        audio.playPowerUp();
        set({ magnetActive: true });
        safeTimeout(() => set({ magnetActive: false }), 10000);
        break;
      case PowerUpType.SPEED_BOOST:
        audio.playPowerUp();
        set(s => ({ speedBoostActive: true, speed: s.speed * 1.4 }));
        safeTimeout(() => set(s => ({ speedBoostActive: false, speed: s.speed / 1.4 })), 5000);
        break;
    }
  },

  // ── collectLetter ─────────────────────────────────────────────────────────
  collectLetter: (index) => {
    const { collectedLetters, level, speed } = get();
    if (collectedLetters.includes(index)) return;
    const newLetters = [...collectedLetters, index];
    const newSpeed   = speed + RUN_SPEED_BASE * SPEED_PER_LETTER;

    // Update letter missions
    const missions = get().dailyMissions.map(m => {
      if (m.type === 'letters' && !m.completed) {
        const cur = Math.min(m.target, m.current + 1);
        return { ...m, current: cur, completed: cur >= m.target };
      }
      return m;
    });

    set({ collectedLetters: newLetters, speed: newSpeed, dailyMissions: missions });

    if (newLetters.length === 6) {
      if (level < MAX_LEVEL) get().advanceLevel();
      else {
        const { score, highScore, distance, gemsCollected, achievements } = get();
        const newHigh = Math.max(score + 10000, highScore);
        if (newHigh > highScore) localStorage.setItem('gr_highscore', String(newHigh));
        const xpEarned = Math.floor(score / 10) + distance + level * 100;
        const newXP    = get().xp + xpEarned;
        localStorage.setItem('gr_xp', String(newXP));
        const newTotal = get().totalGems + gemsCollected;
        localStorage.setItem('gr_gems', String(newTotal));
        const newAch   = achievements.map(a => a.id === 'level5' && !a.unlocked ? { ...a, unlocked: true } : a);
        saveAchievements(newAch);
        set({ status: GameStatus.VICTORY, score: score + 10000, highScore: newHigh, xp: newXP, playerLevel: getPlayerLevel(newXP), totalGems: newTotal, achievements: newAch });
      }
    }
  },

  // ── advanceLevel ──────────────────────────────────────────────────────────
  advanceLevel: () => {
    const { level, laneCount, speed, achievements } = get();
    const nextLevel = level + 1;
    const newSpeed  = speed + RUN_SPEED_BASE * SPEED_PER_LEVEL;
    // Lanes: 3 → 5 → 7 → 9 → 9
    const newLanes  = Math.min(laneCount + 2, 9);
    const newAch    = achievements.map(a => {
      if (a.id === 'level2' && nextLevel >= 2 && !a.unlocked) return { ...a, unlocked: true };
      if (a.id === 'level5' && nextLevel >= 5 && !a.unlocked) return { ...a, unlocked: true };
      return a;
    });
    saveAchievements(newAch);
    set({
      level: nextLevel, laneCount: newLanes, status: GameStatus.PLAYING,
      speed: newSpeed, collectedLetters: [], achievements: newAch,
    });
  },

  setDistance: (dist) => {
    // Update distance missions in-flight
    const missions = get().dailyMissions.map(m => {
      if (m.type === 'distance' && !m.completed) {
        const cur = Math.min(m.target, Math.floor(dist));
        return { ...m, current: cur, completed: cur >= m.target };
      }
      return m;
    });
    set({ distance: dist, dailyMissions: missions });
  },

  setSkin:     (skin) => set({ currentSkin: skin }),

  unlockSkin: (skin, cost) => {
    const { totalGems, unlockedSkins } = get();
    if (totalGems >= cost && !unlockedSkins.includes(skin)) {
      const newTotal = totalGems - cost;
      const newSkins = [...unlockedSkins, skin];
      localStorage.setItem('gr_gems', String(newTotal));
      localStorage.setItem('gr_skins', JSON.stringify(newSkins));
      set({ totalGems: newTotal, unlockedSkins: newSkins });
      return true;
    }
    return false;
  },

  buyItem: (type, cost) => {
    const { score, maxLives, lives } = get();
    if (score < cost) return false;
    set({ score: score - cost });
    if (type === 'DOUBLE_JUMP') set({ hasDoubleJump: true });
    if (type === 'MAX_LIFE')    set({ maxLives: maxLives + 1, lives: lives + 1 });
    if (type === 'HEAL')        set({ lives: Math.min(lives + 1, maxLives) });
    if (type === 'IMMORTAL')    set({ hasImmortality: true });
    return true;
  },

  openShop:  () => set({ status: GameStatus.SHOP }),
  closeShop: () => set({ status: GameStatus.PLAYING }),

  activateImmortality: () => {
    const { hasImmortality, isImmortalityActive } = get();
    if (!hasImmortality || isImmortalityActive) return;
    set({ isImmortalityActive: true });
    safeTimeout(() => set({ isImmortalityActive: false }), 5000);
  },

  setStatus: (status) => set({ status }),

  toggleMute: () => {
    const next = !get().isMuted;
    set({ isMuted: next });
    localStorage.setItem('gr_muted', String(next));
    audio.setMuted(next);
  },
}));
