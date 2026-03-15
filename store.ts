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
  
  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
}

const GEMINI_TARGET = ['G', 'E', 'M', 'I', 'N', 'I'];
const MAX_LEVEL = 3;

// Load high score from local storage
const savedHighScore = Number(localStorage.getItem('gemini_high_score')) || 0;

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

  startGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: RUN_SPEED_BASE,
    collectedLetters: [],
    level: 1,
    laneCount: 3,
    gemsCollected: 0,
    distance: 0,
    hasDoubleJump: false,
    hasImmortality: false,
    isImmortalityActive: false,
    shieldActive: false,
    magnetActive: false,
    speedBoostActive: false
  }),

  restartGame: () => set({ 
    status: GameStatus.PLAYING, 
    score: 0, 
    lives: 3, 
    maxLives: 3,
    speed: RUN_SPEED_BASE,
    collectedLetters: [],
    level: 1,
    laneCount: 3,
    gemsCollected: 0,
    distance: 0,
    hasDoubleJump: false,
    hasImmortality: false,
    isImmortalityActive: false,
    shieldActive: false,
    magnetActive: false,
    speedBoostActive: false
  }),

  pauseGame: () => {
    const { status } = get();
    if (status === GameStatus.PLAYING) {
      set({ status: GameStatus.PAUSED });
    }
  },

  resumeGame: () => {
    const { status } = get();
    if (status === GameStatus.PAUSED) {
      set({ status: GameStatus.PLAYING });
    }
  },

  togglePause: () => {
    const { status } = get();
    if (status === GameStatus.PLAYING) {
      set({ status: GameStatus.PAUSED });
    } else if (status === GameStatus.PAUSED) {
      set({ status: GameStatus.PLAYING });
    }
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
      if (score > highScore) {
        set({ highScore: score });
        localStorage.setItem('gemini_high_score', score.toString());
      }
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
    }
  },

  addScore: (amount) => {
    set((state) => {
      const newScore = state.score + amount;
      return { score: newScore };
    });
  },
  
  collectGem: (value) => set((state) => ({ 
    score: state.score + value, 
    gemsCollected: state.gemsCollected + 1 
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
        setTimeout(() => set({ magnetActive: false }), 10000);
        break;
      case PowerUpType.SPEED_BOOST:
        audio.playPowerUp();
        const currentSpeed = get().speed;
        set({ speedBoostActive: true, speed: currentSpeed * 1.5 });
        setTimeout(() => {
          set({ speedBoostActive: false, speed: get().speed / 1.5 });
        }, 5000);
        break;
    }
  },

  setDistance: (dist) => set({ distance: dist }),

  setSkin: (skin) => set({ currentSkin: skin }),

  unlockSkin: (skin, cost) => {
    const { gemsCollected, unlockedSkins } = get();
    if (gemsCollected >= cost && !unlockedSkins.includes(skin)) {
      set({ 
        gemsCollected: gemsCollected - cost,
        unlockedSkins: [...unlockedSkins, skin]
      });
      return true;
    }
    return false;
  },

  collectLetter: (index) => {
    const { collectedLetters, level, speed } = get();
    
    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      
      // LINEAR SPEED INCREASE: Add 10% of BASE speed per letter
      // This ensures 110% -> 120% -> 130% consistent steps
      const speedIncrease = RUN_SPEED_BASE * 0.10;
      const nextSpeed = speed + speedIncrease;

      set({ 
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      // Check if full word collected
      if (newLetters.length === GEMINI_TARGET.length) {
        if (level < MAX_LEVEL) {
            // Immediately advance level
            // The Shop Portal will be spawned by LevelManager at the start of the new level
            get().advanceLevel();
        } else {
            // Victory Condition
            set({
                status: GameStatus.VICTORY,
                score: get().score + 5000
            });
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, laneCount, speed } = get();
      const nextLevel = level + 1;
      
      // LINEAR LEVEL INCREASE: Add 40% of BASE speed per level
      // Combined with the 6 letters (60%), this totals +100% speed per full level cycle
      const speedIncrease = RUN_SPEED_BASE * 0.40;
      const newSpeed = speed + speedIncrease;

      set({
          level: nextLevel,
          laneCount: Math.min(laneCount + 2, 9), // Expand lanes
          status: GameStatus.PLAYING, // Keep playing, user runs into shop
          speed: newSpeed,
          collectedLetters: [] // Reset letters
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
          
          // Lasts 5 seconds
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  setStatus: (status) => set({ status }),
  increaseLevel: () => set((state) => ({ level: state.level + 1 })),
}));
