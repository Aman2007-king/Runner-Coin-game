/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SHOP = 'SHOP',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
}

export enum ObjectType {
  OBSTACLE        = 'OBSTACLE',
  GEM             = 'GEM',
  LETTER          = 'LETTER',
  SHOP_PORTAL     = 'SHOP_PORTAL',
  ALIEN           = 'ALIEN',
  MISSILE         = 'MISSILE',
  POWERUP         = 'POWERUP',
  MOVING_OBSTACLE = 'MOVING_OBSTACLE',
  BOOST_RAMP      = 'BOOST_RAMP',
}

export enum PowerUpType {
  SHIELD      = 'SHIELD',
  MAGNET      = 'MAGNET',
  SPEED_BOOST = 'SPEED_BOOST',
}

export enum SkinType {
  DEFAULT   = 'DEFAULT',
  NEON_BLUE = 'NEON_BLUE',
  NEON_GOLD = 'NEON_GOLD',
  PHANTOM   = 'PHANTOM',
}

export enum BiomeType {
  NEON_CITY = 'NEON_CITY',
  LAVA_CORE = 'LAVA_CORE',
  ICE_VOID  = 'ICE_VOID',
  STORM     = 'STORM',
  VOID      = 'VOID',
}

export const BIOME_BY_LEVEL: Record<number, BiomeType> = {
  1: BiomeType.NEON_CITY,
  2: BiomeType.LAVA_CORE,
  3: BiomeType.ICE_VOID,
  4: BiomeType.STORM,
  5: BiomeType.VOID,
};

export const BIOME_COLORS: Record<BiomeType, { bg: string; fog: string; ambient: string; dir: string; accent: string; floor: string; grid: string }> = {
  [BiomeType.NEON_CITY]: { bg: '#050011', fog: '#050011', ambient: '#400080', dir: '#00ffff', accent: '#ff00aa', floor: '#1a0b2e', grid: '#8800ff' },
  [BiomeType.LAVA_CORE]: { bg: '#1a0000', fog: '#1a0000', ambient: '#800020', dir: '#ff4400', accent: '#ff8800', floor: '#2e0a00', grid: '#ff2200' },
  [BiomeType.ICE_VOID]:  { bg: '#001120', fog: '#001120', ambient: '#004080', dir: '#88ddff', accent: '#00ffee', floor: '#001e33', grid: '#00aaff' },
  [BiomeType.STORM]:     { bg: '#0a0a1a', fog: '#0a0a1a', ambient: '#303060', dir: '#aaaaff', accent: '#ffffff', floor: '#111128', grid: '#4444ff' },
  [BiomeType.VOID]:      { bg: '#000000', fog: '#000000', ambient: '#200020', dir: '#ff00ff', accent: '#cc00ff', floor: '#0d000d', grid: '#ff00ff' },
};

export interface DailyMission {
  id: string;
  label: string;
  target: number;
  current: number;
  reward: number;
  type: 'gems' | 'distance' | 'letters' | 'noHit';
  completed: boolean;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export interface GameObject {
  id: string;
  type: ObjectType;
  powerUpType?: PowerUpType;
  position: [number, number, number];
  active: boolean;
  value?: string;
  color?: string;
  targetIndex?: number;
  points?: number;
  hasFired?: boolean;
  sweepDir?: 1 | -1;
  sweepRange?: number;
  sweepOriginX?: number;
}

export const LANE_WIDTH      = 2.2;
export const RUN_SPEED_BASE  = 22.5;
export const SPAWN_DISTANCE  = 120;
export const REMOVE_DISTANCE = 20;
export const MAX_LEVEL       = 5;

// Letter speed bump per letter collected (% of base)
export const SPEED_PER_LETTER = 0.06;
// Speed bonus on level advance (% of base)
export const SPEED_PER_LEVEL  = 0.50;

export const GEMINI_COLORS = [
  '#2979ff',
  '#ff1744',
  '#ffea00',
  '#2979ff',
  '#00e676',
  '#ff1744',
];

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: any;
  oneTime?: boolean;
}
