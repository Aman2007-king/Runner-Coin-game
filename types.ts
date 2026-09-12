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
  // ── Levels 1-5: Temple-Run-style ground biomes ─────────────────────────────
  JUNGLE_RUINS  = 'JUNGLE_RUINS',   // overgrown stone temple, vines, dense green canopy
  DEEP_FOREST   = 'DEEP_FOREST',    // tall pine woods, misty and cool
  DESERT_TEMPLE = 'DESERT_TEMPLE',  // sandstone ruins, dunes, warm dusty light
  CANYON_DUSK   = 'CANYON_DUSK',    // red-rock canyon at sunset
  ICE_TEMPLE    = 'ICE_TEMPLE',     // frozen ruins, snow, pale blue light
  // ── Levels 6-10: real-galaxy space biomes ──────────────────────────────────
  MILKY_CORE      = 'MILKY_CORE',      // dense starfield near the galactic disc
  ORION_NEBULA    = 'ORION_NEBULA',    // glowing blue/teal star-forming clouds
  ANDROMEDA_DRIFT = 'ANDROMEDA_DRIFT', // distant spiral galaxy, violet dust lanes
  DEEP_VOID       = 'DEEP_VOID',       // sparse deep space, cold and quiet
  GALACTIC_HEART  = 'GALACTIC_HEART',  // blazing supermassive core, warm gold/red
}

export const BIOME_BY_LEVEL: Record<number, BiomeType> = {
  1: BiomeType.JUNGLE_RUINS,
  2: BiomeType.DEEP_FOREST,
  3: BiomeType.DESERT_TEMPLE,
  4: BiomeType.CANYON_DUSK,
  5: BiomeType.ICE_TEMPLE,
  6:  BiomeType.MILKY_CORE,
  7:  BiomeType.ORION_NEBULA,
  8:  BiomeType.ANDROMEDA_DRIFT,
  9:  BiomeType.DEEP_VOID,
  10: BiomeType.GALACTIC_HEART,
};

// bg=sky/void colour, fog=matches bg for horizon blending, ambient/dir=lighting,
// accent=key highlight colour (canopy glow / ice glint / nebula glow),
// floor=ground colour (levels 1-5) or lane-marker colour (levels 6-10),
// grid=secondary structure colour (bark/stone/rock, or asteroid/dust colour)
export const BIOME_COLORS: Record<BiomeType, { bg: string; fog: string; ambient: string; dir: string; accent: string; floor: string; grid: string }> = {
  [BiomeType.JUNGLE_RUINS]:  { bg: '#3a6b4a', fog: '#4a8058', ambient: '#2f6b3a', dir: '#fff0c0', accent: '#ffe28a', floor: '#8a5a35', grid: '#4a3320' },
  [BiomeType.DEEP_FOREST]:   { bg: '#2c4a3e', fog: '#3a5c4c', ambient: '#1f3a2a', dir: '#cfe8d8', accent: '#eaffe0', floor: '#5a5040', grid: '#2e2015' },
  [BiomeType.DESERT_TEMPLE]: { bg: '#8a6a34', fog: '#a5854a', ambient: '#a5762f', dir: '#ffe6a8', accent: '#ffdca0', floor: '#c9a15c', grid: '#8a6a3a' },
  [BiomeType.CANYON_DUSK]:   { bg: '#6a2e3c', fog: '#7a3a44', ambient: '#5c2a20', dir: '#ff9a60', accent: '#ffc088', floor: '#8a4530', grid: '#4a2015' },
  [BiomeType.ICE_TEMPLE]:    { bg: '#6a9ab8', fog: '#7fb0c8', ambient: '#3a6a8a', dir: '#eaffff', accent: '#ffffff', floor: '#c9e6f5', grid: '#5a7a90' },
  // ── Real-galaxy space biomes ────────────────────────────────────────────────
  [BiomeType.MILKY_CORE]:      { bg: '#03040c', fog: '#03040c', ambient: '#2a3060', dir: '#dfe6ff', accent: '#ffe9b0', floor: '#2255ff', grid: '#aab4ff' },
  [BiomeType.ORION_NEBULA]:    { bg: '#03080a', fog: '#03080a', ambient: '#0a4a55', dir: '#8fe8ff', accent: '#5df0c8', floor: '#1ec8ee', grid: '#3aa89a' },
  [BiomeType.ANDROMEDA_DRIFT]: { bg: '#08040e', fog: '#08040e', ambient: '#3a1a5a', dir: '#c79bff', accent: '#ff9be0', floor: '#7c4aff', grid: '#5a3a8a' },
  [BiomeType.DEEP_VOID]:       { bg: '#000004', fog: '#000004', ambient: '#101830', dir: '#8fa8ff', accent: '#cfe0ff', floor: '#3355aa', grid: '#445a88' },
  [BiomeType.GALACTIC_HEART]:  { bg: '#140502', fog: '#140502', ambient: '#7a2a0a', dir: '#ffb84a', accent: '#ffe07a', floor: '#ff6a1a', grid: '#aa4a1a' },
};

export interface DailyMission {
  id: string;
  label: string;
  target: number;
  current: number;
  reward: number;
  type: 'gems' | 'distance' | 'letters' | 'noHit';
  completed: boolean;
  claimed: boolean;
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
