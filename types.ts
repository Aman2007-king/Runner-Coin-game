/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

export enum GameStatus {
  MENU     = 'MENU',
  PLAYING  = 'PLAYING',
  SHOP     = 'SHOP',
  PAUSED   = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY  = 'VICTORY',
  // ── NEW ────────────────────────────────────────────────────────────────────
  AIRCRAFT_SHOP     = 'AIRCRAFT_SHOP',      // Aircraft selection after Level 5
  SPACE_TRANSITION  = 'SPACE_TRANSITION',   // Warp cinematic before Phase 3
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
  // ── NEW: Phase 3 objects ────────────────────────────────────────────────────
  SPACE_ENEMY_SMALL  = 'SPACE_ENEMY_SMALL',
  SPACE_ENEMY_MEDIUM = 'SPACE_ENEMY_MEDIUM',
  SPACE_ASTEROID     = 'SPACE_ASTEROID',
  SPACE_GEM          = 'SPACE_GEM',
  PLAYER_BULLET      = 'PLAYER_BULLET',
  PLAYER_ROCKET      = 'PLAYER_ROCKET',
  ENEMY_BULLET       = 'ENEMY_BULLET',
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
  // ── NEW: space biomes for Levels 6-10 ──────────────────────────────────────
  NEBULA        = 'NEBULA',
  ASTEROID_BELT = 'ASTEROID_BELT',
  DARK_MATTER   = 'DARK_MATTER',
  PULSAR        = 'PULSAR',
  SINGULARITY   = 'SINGULARITY',
}

export const BIOME_BY_LEVEL: Record<number, BiomeType> = {
  1: BiomeType.NEON_CITY,
  2: BiomeType.LAVA_CORE,
  3: BiomeType.ICE_VOID,
  4: BiomeType.STORM,
  5: BiomeType.VOID,
  // ── NEW ────────────────────────────────────────────────────────────────────
  6:  BiomeType.NEBULA,
  7:  BiomeType.ASTEROID_BELT,
  8:  BiomeType.DARK_MATTER,
  9:  BiomeType.PULSAR,
  10: BiomeType.SINGULARITY,
};

export const BIOME_COLORS: Record<BiomeType, { bg: string; fog: string; ambient: string; dir: string; accent: string; floor: string; grid: string }> = {
  [BiomeType.NEON_CITY]:     { bg: '#050011', fog: '#050011', ambient: '#400080', dir: '#00ffff', accent: '#ff00aa', floor: '#1a0b2e', grid: '#8800ff' },
  [BiomeType.LAVA_CORE]:     { bg: '#1a0000', fog: '#1a0000', ambient: '#800020', dir: '#ff4400', accent: '#ff8800', floor: '#2e0a00', grid: '#ff2200' },
  [BiomeType.ICE_VOID]:      { bg: '#001120', fog: '#001120', ambient: '#004080', dir: '#88ddff', accent: '#00ffee', floor: '#001e33', grid: '#00aaff' },
  [BiomeType.STORM]:         { bg: '#0a0a1a', fog: '#0a0a1a', ambient: '#303060', dir: '#aaaaff', accent: '#ffffff', floor: '#111128', grid: '#4444ff' },
  [BiomeType.VOID]:          { bg: '#000000', fog: '#000000', ambient: '#200020', dir: '#ff00ff', accent: '#cc00ff', floor: '#0d000d', grid: '#ff00ff' },
  // ── NEW space biomes ────────────────────────────────────────────────────────
  [BiomeType.NEBULA]:        { bg: '#000518', fog: '#000518', ambient: '#001060', dir: '#2255ff', accent: '#55aaff', floor: '#000c28', grid: '#1133aa' },
  [BiomeType.ASTEROID_BELT]: { bg: '#100a00', fog: '#100a00', ambient: '#402000', dir: '#cc6600', accent: '#ffaa33', floor: '#1e1000', grid: '#884400' },
  [BiomeType.DARK_MATTER]:   { bg: '#080010', fog: '#080010', ambient: '#300050', dir: '#9900ff', accent: '#cc44ff', floor: '#0e001e', grid: '#6600cc' },
  [BiomeType.PULSAR]:        { bg: '#001818', fog: '#001818', ambient: '#005050', dir: '#00ffcc', accent: '#00ffff', floor: '#001e1e', grid: '#00aaaa' },
  [BiomeType.SINGULARITY]:   { bg: '#000000', fog: '#000000', ambient: '#220000', dir: '#ff2200', accent: '#ff5500', floor: '#0a0000', grid: '#cc1100' },
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
  // ── NEW: Phase 3 fields ─────────────────────────────────────────────────────
  hp?: number;
  maxHp?: number;
  radius?: number;
  damage?: number;
  fireTimer?: number;
  velocity?: [number, number, number];
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

// ── NEW: Aircraft models for Phase 2 shop ──────────────────────────────────────
export enum AircraftModel {
  ALPHA = 'ALPHA',
  BETA  = 'BETA',
  GAMMA = 'GAMMA',
  DELTA = 'DELTA',
}

export interface AircraftSpec {
  model:            AircraftModel;
  name:             string;
  cost:             number;
  feature:          string;
  description:      string;
  color:            string;
  enhancedAgility:  boolean;
  magnetizedHull:   boolean;
  doubleBlasters:   boolean;
  shieldGenerator:  boolean;
}

export const AIRCRAFT_SPECS: Record<AircraftModel, AircraftSpec> = {
  [AircraftModel.ALPHA]: {
    model: AircraftModel.ALPHA, name: 'Model Alpha', cost: 500,
    feature: 'Enhanced Agility', description: 'Faster banking & dodging speed',
    color: '#00ffff',
    enhancedAgility: true, magnetizedHull: false, doubleBlasters: false, shieldGenerator: false,
  },
  [AircraftModel.BETA]: {
    model: AircraftModel.BETA, name: 'Model Beta', cost: 1000,
    feature: 'Magnetized Hull', description: 'Automatically pulls nearby gems',
    color: '#ff44ff',
    enhancedAgility: false, magnetizedHull: true, doubleBlasters: false, shieldGenerator: false,
  },
  [AircraftModel.GAMMA]: {
    model: AircraftModel.GAMMA, name: 'Model Gamma', cost: 1500,
    feature: 'Double-Barrel Blasters', description: 'Wider bullet spread',
    color: '#ffff00',
    enhancedAgility: false, magnetizedHull: false, doubleBlasters: true, shieldGenerator: false,
  },
  [AircraftModel.DELTA]: {
    model: AircraftModel.DELTA, name: 'Model Delta', cost: 2000,
    feature: 'Shield Generator', description: 'Passively absorbs 1 hit per level',
    color: '#00ff88',
    enhancedAgility: false, magnetizedHull: false, doubleBlasters: false, shieldGenerator: true,
  },
};

// ── NEW: Space tuning constants ─────────────────────────────────────────────────
export const ROCKETS_PER_LEVEL      = 3;
export const MAX_SPACE_LEVEL        = 10;
export const SPACE_GEM_VALUE        = 150;
export const SPACE_GEM_TARGET_BASE  = 30;  // gems needed per space level = level * this
export const ENEMY_BULLET_SPEED     = 18;
export const GEM_MAGNET_RADIUS      = 12;
