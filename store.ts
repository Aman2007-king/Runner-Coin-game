/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE, PowerUpType, SkinType } from './types';
import { audio } from './components/System/Audio';

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
  distance: number;

  // Power-ups
  shieldActive: boolean;
  magnetActive: boolean;
  speedBoostActive: boolean;

  // Skins
  currentSkin: SkinType;
  unlockedSkins: SkinType[];

  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  // Audio
  isMuted: boolean;

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
}

const GEMINI_TARGET = ['G', 'E', 'M', 'I', 'N', 'I'];
const MAX_LEVEL = 3;

// Load persisted values from localStorage
const savedHighScore = Number(localStorage.getItem('gemini_high_score')) || 0;
const savedMuted = localStorage.getItem('gemini_muted') === 'true';

// --- Timer registry so we can clear all timers on restart ---
const activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();

function safeTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(() => {
    activeTimers.delete(id);
    fn();
  }, ms);
  activeTimers.add(id);
  return id;
}

function clearAllTimers() {
  activeTimers.forEach(id => clearTimeout(id));
  activeTimers.clear();
}

// Shared reset state so startGame and restartGame stay in sync
const getResetState = () => ({
  status: GameStatus.PLAYING,
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
});

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
  distance: 0,

  shieldActive: false,
  magnetActive: false,
  speedBoostActive: false,

  currentSkin: SkinType.DEFAULT,
  unlockedSkins: [SkinType.DEFAULT],

  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  isMuted: savedMuted,

  startGame: () => {
    clearAllTimers();
    set(getResetState());
  },

  restartGame: () => {
    clearAllTimers();
    set(getResetState());
  },

  pauseGame: () => {
    if (get().status === GameStatus.PLAYING) {
      set({ status: GameStatus.PAUSED });
    }
  },

  resumeGame: () => {
    if (get().status === GameStatus.PAUSED) {
      set({ status: GameStatus.PLAYING });
    }
  },

  togglePause: () => {
    const { status } = get();
    if (status === GameStatus.PLAYING) set({ status: GameStatus.PAUSED });
    else if (status === GameStatus.PAUSED) set({ status: GameStatus.PLAYING });
  },

  takeDamage: () => {
    const { lives, isImmortalityActive, shieldActive } = get();

    if (isImmortalityActive) return;

    if (shieldActive) {
      set({ shieldActive: false });
      return;
    }

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      const { score, highScore } = get();
      const newHighScore = score > highScore ? score : highScore;
      if (score > highScore) {
        localStorage.setItem('gemini_high_score', score.toString());
      }
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0, highScore: newHighScore });
    }
  },

  addScore: (amount) => {
    set((state) => ({ score: state.score + amount }));
  },

  collectGem: (value) => set((state) => ({
    score: state.score + value,
    gemsCollected: state.gemsCollected + 1,
  })),

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

      case PowerUpType.SPEED_BOOST: {
        audio.playPowerUp();
        const currentSpeed = get().speed;
        set({ speedBoostActive: true, speed: currentSpeed * 1.5 });
        safeTimeout(() => {
          // Divide the CURRENT speed (not a stale capture) to reverse the boost
          set((state) => ({ speedBoostActive: false, speed: state.speed / 1.5 }));
        }, 5000);
        break;
      }
    }
  },

  setDistance: (dist) => set({ distance: dist }),

  setSkin: (skin) => set({ currentSkin: skin }),

  unlockSkin: (skin, cost) => {
    const { gemsCollected, unlockedSkins } = get();
    if (gemsCollected >= cost && !unlockedSkins.includes(skin)) {
      set({
        gemsCollected: gemsCollected - cost,
        unlockedSkins: [...unlockedSkins, skin],
      });
      return true;
    }
    return false;
  },

  collectLetter: (index) => {
    const { collectedLetters, level, speed } = get();

    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];

      // LINEAR SPEED INCREASE: +10% of base speed per letter
      const speedIncrease = RUN_SPEED_BASE * 0.10;
      const nextSpeed = speed + speedIncrease;

      set({ collectedLetters: newLetters, speed: nextSpeed });

      if (newLetters.length === GEMINI_TARGET.length) {
        if (level < MAX_LEVEL) {
          get().advanceLevel();
        } else {
          set({ status: GameStatus.VICTORY, score: get().score + 5000 });
        }
      }
    }
  },

  advanceLevel: () => {
    const { level, laneCount, speed } = get();
    const nextLevel = level + 1;

    // LINEAR LEVEL INCREASE: +40% of base speed per level
    const speedIncrease = RUN_SPEED_BASE * 0.40;
    const newSpeed = speed + speedIncrease;

    set({
      level: nextLevel,
      laneCount: Math.min(laneCount + 2, 9),
      status: GameStatus.PLAYING,
      speed: newSpeed,
      collectedLetters: [],
    });
  },

  openShop: () => set({ status: GameStatus.SHOP }),
  closeShop: () => set({ status: GameStatus.PLAYING }),

  buyItem: (type, cost) => {
    const { score, maxLives, lives } = get();

    if (score >= cost) {
      set({ score: score - cost });

      switch (type) {
        case 'DOUBLE_JUMP':
          set({ hasDoubleJump: true });
          break;
        case 'MAX_LIFE':
          set({ maxLives: maxLives + 1, lives: lives + 1 });
          break;
        case 'HEAL':
          set({ lives: Math.min(lives + 1, maxLives) });
          break;
        case 'IMMORTAL':
          set({ hasImmortality: true });
          break;
      }
      return true;
    }
    return false;
  },

  activateImmortality: () => {
    const { hasImmortality, isImmortalityActive } = get();
    if (hasImmortality && !isImmortalityActive) {
      set({ isImmortalityActive: true });
      safeTimeout(() => set({ isImmortalityActive: false }), 5000);
    }
  },

  setStatus: (status) => set({ status }),

  toggleMute: () => {
    const next = !get().isMuted;
    set({ isMuted: next });
    localStorage.setItem('gemini_muted', String(next));
    audio.setMuted(next);
  },
}));
