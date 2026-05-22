/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import {
  GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE,
  GameStatus, GEMINI_COLORS, PowerUpType, MAX_LEVEL,
  // ── NEW ─────────────────────────────────────────────────────────────────────
  AircraftModel, AIRCRAFT_SPECS,
  SPACE_GEM_VALUE, SPACE_GEM_TARGET_BASE, ENEMY_BULLET_SPEED, GEM_MAGNET_RADIUS,
} from '../../types';
import { audio } from '../System/Audio';

const IS_MOBILE  = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
const MAX_DELTA  = 0.05;
const MISSILE_V  = 28;
const OBS_H      = 1.6;

// ── Particle system (instanced) ────────────────────────────────────────────────
const PCNT = IS_MOBILE ? 200 : 500;
const ParticleSystem: React.FC = () => {
  const mesh  = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: PCNT }, () => ({
    life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    rot: new THREE.Vector3(), rotV: new THREE.Vector3(), col: new THREE.Color(),
  })), []);

  useEffect(() => {
    const burst = (e: CustomEvent) => {
      const { position, color } = e.detail;
      let spawned = 0;
      for (let i = 0; i < PCNT && spawned < 30; i++) {
        const p = particles[i];
        if (p.life > 0) continue;
        p.life = 1 + Math.random() * 0.5;
        p.pos.set(...position);
        const θ = Math.random()*Math.PI*2, φ = Math.acos(2*Math.random()-1);
        const v = 2 + Math.random() * 8;
        p.vel.set(Math.sin(φ)*Math.cos(θ), Math.sin(φ)*Math.sin(θ), Math.cos(φ)).multiplyScalar(v);
        p.rot.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
        p.rotV.set(Math.random()-.5, Math.random()-.5, 0).multiplyScalar(4);
        p.col.set(color);
        spawned++;
      }
    };
    window.addEventListener('particle-burst', burst as any);
    return () => window.removeEventListener('particle-burst', burst as any);
  }, [particles]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const dt = Math.min(delta, MAX_DELTA);
    particles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt * 1.5;
        p.pos.addScaledVector(p.vel, dt);
        p.vel.y -= dt * 4; p.vel.multiplyScalar(0.98);
        p.rot.x += p.rotV.x * dt;
        dummy.position.copy(p.pos);
        const s = Math.max(0, p.life * 0.22);
        dummy.scale.set(s, s, s); dummy.rotation.set(p.rot.x, p.rot.y, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
        mesh.current!.setColorAt(i, p.col);
      } else {
        dummy.scale.set(0,0,0); dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
      }
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PCNT]}>
      <octahedronGeometry args={[0.5, 0]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
  );
};

// ── Floating score popup ────────────────────────────────────────────────────────
interface ScorePopup { id: string; value: string; x: number; y: number; life: number }
const scorePopups: ScorePopup[] = [];
let popupTrigger: React.Dispatch<React.SetStateAction<number>> | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────
const LANE = (laneCount: number) => {
  const max = Math.floor(laneCount / 2);
  return Math.floor(Math.random() * (max*2+1)) - max;
};

const LETTER_INTERVAL_BASE = 120;
const getLetterInterval = (level: number) =>
  Math.max(40, LETTER_INTERVAL_BASE - (level - 1) * 18);

const getMinGap = (level: number, speed: number) =>
  Math.max(6, 14 - (level - 1) * 1.5 + speed * 0.15);

const getSweepSpeed = (level: number) => 1.5 + (level - 1) * 0.6;

// ── Static geometries ──────────────────────────────────────────────────────────
const OBS_GEO       = new THREE.ConeGeometry(0.9, OBS_H, 6);
const GEM_GEO       = new THREE.IcosahedronGeometry(0.3, 0);
const POWERUP_GEO   = new THREE.TorusKnotGeometry(0.3, 0.1, IS_MOBILE ? 32 : 64, 8);
const RAMP_GEO      = new THREE.BoxGeometry(LANE_WIDTH * 0.9, 0.15, 3);
const MISSILE_GEO   = new THREE.CylinderGeometry(0.08, 0.08, 3, 6);
const ALIEN_B_GEO   = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_D_GEO   = new THREE.SphereGeometry(0.4, IS_MOBILE ? 8 : 16, IS_MOBILE ? 8 : 16, 0, Math.PI*2, 0, Math.PI/2);
const MOVE_OBS_GEO  = new THREE.BoxGeometry(1.8, 1.4, 1.0);

// ── NEW: Space geometries ──────────────────────────────────────────────────────
const SPACE_GEM_GEO      = new THREE.OctahedronGeometry(0.35, 0);
const ENEMY_SMALL_GEO    = new THREE.ConeGeometry(0.45, 1.1, 5);
const ENEMY_MEDIUM_GEO   = new THREE.ConeGeometry(0.75, 1.5, 6);
const ASTEROID_GEO       = new THREE.DodecahedronGeometry(0.9, 0);
const ASTEROID_LG_GEO    = new THREE.DodecahedronGeometry(1.4, 0);
const PLAYER_BULLET_GEO  = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5);
const ROCKET_GEO         = new THREE.CylinderGeometry(0.12, 0.08, 1.4, 6);
const ENEMY_BULLET_GEO   = new THREE.SphereGeometry(0.12, 6, 6);

// ── Main LevelManager ──────────────────────────────────────────────────────────
export const LevelManager: React.FC = () => {
  const {
    status, speed, collectGem, collectLetter, collectPowerUp,
    collectedLetters, laneCount, setDistance, openShop, level,
    magnetActive, comboMultiplier, breakCombo, isSliding,
    // ── NEW ───────────────────────────────────────────────────────────────────
    gamePhase, selectedAircraft, collectSpaceGem, advanceSpaceLevel,
    spaceGemsCollected, rocketsRemaining,
  } = useStore();

  const objects        = useRef<GameObject[]>([]);
  const [, setTick]    = useState(0);
  const prevStatus     = useRef(status);
  const prevLevel      = useRef(level);
  const playerPos      = useRef(new THREE.Vector3());
  const distTraveled   = useRef(0);
  const nextLetterDist = useRef(LETTER_INTERVAL_BASE);

  // ── NEW: Phase 3 timers ────────────────────────────────────────────────────
  const enemySpawnTimer    = useRef(0);
  const asteroidSpawnTimer = useRef(0);
  const gemSpawnTimer      = useRef(0);
  const autoFireTimer      = useRef(0);

  const [, setPopTick] = useState(0);
  useEffect(() => { popupTrigger = setPopTick; }, []);

  const addPopup = (label: string, x: number, y: number) => {
    scorePopups.push({ id: uuidv4(), value: label, x, y, life: 1 });
    if (popupTrigger) popupTrigger(t => t + 1);
  };

  // ── NEW: listen for rocket fire events from Player ─────────────────────────
  useEffect(() => {
    const onRocket = (e: CustomEvent) => {
      if (gamePhase !== 3) return;
      const px = playerPos.current.x;
      const py = playerPos.current.y;
      const pz = playerPos.current.z;
      objects.current.push({
        id: uuidv4(), type: ObjectType.PLAYER_ROCKET,
        position: [px, py, pz - 1],
        active: true, color: '#ff8800', damage: 5,
        velocity: [0, 0, -55],
      });
      window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: [px, py, pz], color: '#ff8800' } }));
      setTick(t => t + 1);
    };
    window.addEventListener('player-fire-rocket', onRocket as any);
    return () => window.removeEventListener('player-fire-rocket', onRocket as any);
  }, [gamePhase]);

  // Status / level resets
  useEffect(() => {
    const wasGameOver = prevStatus.current === GameStatus.GAME_OVER;
    const wasVictory  = prevStatus.current === GameStatus.VICTORY;
    const nowPlaying  = status === GameStatus.PLAYING;
    const levelUp     = level !== prevLevel.current && nowPlaying;

    if ((wasGameOver || wasVictory || prevStatus.current === GameStatus.MENU || prevStatus.current === GameStatus.SPACE_TRANSITION || prevStatus.current === GameStatus.AIRCRAFT_SHOP) && nowPlaying) {
      objects.current = []; setTick(t => t+1);
      distTraveled.current = 0; nextLetterDist.current = getLetterInterval(1);
      enemySpawnTimer.current    = 1.5;
      asteroidSpawnTimer.current = 2.0;
      gemSpawnTimer.current      = 0.5;
      autoFireTimer.current      = 0;
    } else if (levelUp && level > 1) {
      if (gamePhase === 1) {
        objects.current = objects.current.filter(o => o.position[2] > -80);
        // Only spawn mid-level shop portal for levels 2-4 (NOT level 5 — level 5 opens aircraft shop)
        if (level <= 4) {
          objects.current.push({ id: uuidv4(), type: ObjectType.SHOP_PORTAL, position: [0,0,-100], active: true });
        }
        nextLetterDist.current = distTraveled.current - SPAWN_DISTANCE + getLetterInterval(level);
      } else {
        // Space level up: clear all hazards
        objects.current = objects.current.filter(o =>
          o.type === ObjectType.SPACE_GEM
        );
        enemySpawnTimer.current    = 1.5;
        asteroidSpawnTimer.current = 2.0;
      }
      setTick(t => t+1);
    } else if (!nowPlaying) {
      setDistance(Math.floor(distTraveled.current));
    }
    prevStatus.current = status;
    prevLevel.current  = level;
  }, [status, level, gamePhase]);

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;
    const dt   = Math.min(delta, MAX_DELTA);
    const dist = (gamePhase === 3 ? 15 : speed) * dt; // space uses fixed scroll
    distTraveled.current += dist;

    // Player world pos
    playerPos.current.set(0, 0, 0);
    const pg = state.scene.getObjectByName('PlayerGroup');
    if (pg && pg.children[0]) pg.children[0].getWorldPosition(playerPos.current);

    // ── NEW: Phase 3 frame update ───────────────────────────────────────────
    if (gamePhase === 3) {
      updateSpacePhase(dt, state.clock.elapsedTime);
      return;
    }

    // ── Phase 1: original runner update (unchanged) ────────────────────────
    updateRunnerPhase(dt);
  });

  // ── NEW: space phase update function ──────────────────────────────────────
  const updateSpacePhase = (dt: number, elapsed: number) => {
    const spLvl  = level - 5;              // 1-5 difficulty multiplier
    const spec   = selectedAircraft ? AIRCRAFT_SPECS[selectedAircraft] : AIRCRAFT_SPECS[AircraftModel.ALPHA];
    const px     = playerPos.current.x;
    const py     = playerPos.current.y;
    const pz     = playerPos.current.z;
    let changed  = false;
    const kept:  GameObject[] = [];

    // ── Auto-fire player bullets ────────────────────────────────────────────
    autoFireTimer.current -= dt;
    if (autoFireTimer.current <= 0) {
      autoFireTimer.current = 0.13;
      if (spec.doubleBlasters) {
        objects.current.push(
          { id: uuidv4(), type: ObjectType.PLAYER_BULLET, position: [px - 0.35, py, pz - 1], active: true, color: spec.color, velocity: [0, 0, -60] },
          { id: uuidv4(), type: ObjectType.PLAYER_BULLET, position: [px + 0.35, py, pz - 1], active: true, color: spec.color, velocity: [0, 0, -60] },
        );
      } else {
        objects.current.push({ id: uuidv4(), type: ObjectType.PLAYER_BULLET, position: [px, py, pz - 1], active: true, color: spec.color, velocity: [0, 0, -60] });
      }
      changed = true;
    }

    // ── Enemy spawn ─────────────────────────────────────────────────────────
    enemySpawnTimer.current -= dt;
    if (enemySpawnTimer.current <= 0) {
      const interval = Math.max(0.5, 2.2 - spLvl * 0.28);
      enemySpawnTimer.current = interval + Math.random() * 0.4;
      const isMedium = Math.random() < 0.3 + spLvl * 0.05;
      const count    = Math.random() < 0.35 + spLvl * 0.06 ? 2 : 1;
      const maxLane  = Math.floor(laneCount / 2);
      for (let k = 0; k < count; k++) {
        const ex = (Math.floor(Math.random() * (maxLane * 2 + 1)) - maxLane) * LANE_WIDTH;
        const hp = isMedium ? 3 + spLvl : 1;
        objects.current.push({
          id: uuidv4(),
          type: isMedium ? ObjectType.SPACE_ENEMY_MEDIUM : ObjectType.SPACE_ENEMY_SMALL,
          position: [ex, 0, pz - SPAWN_DISTANCE - Math.random() * 20],
          active: true, color: '#ff2200',
          hp, maxHp: hp,
          fireTimer: 1.2 + Math.random() * 1.5,
          velocity: [0, 0, 10 + spLvl * 2 + Math.random() * 4],
        });
      }
      changed = true;
    }

    // ── Asteroid spawn ──────────────────────────────────────────────────────
    asteroidSpawnTimer.current -= dt;
    if (asteroidSpawnTimer.current <= 0) {
      asteroidSpawnTimer.current = Math.max(0.6, 1.8 - spLvl * 0.12) + Math.random() * 0.3;
      const maxLane = Math.floor(laneCount / 2);
      const ax = (Math.floor(Math.random() * (maxLane * 2 + 1)) - maxLane) * LANE_WIDTH + (Math.random() - 0.5) * LANE_WIDTH * 0.5;
      const big = Math.random() < 0.25;
      objects.current.push({
        id: uuidv4(), type: ObjectType.SPACE_ASTEROID,
        position: [ax, 0, pz - SPAWN_DISTANCE],
        active: true, color: '#887755',
        radius: big ? 1.3 : 0.85,
        hp: big ? 3 : 1,
        velocity: [0, 0, 8 + spLvl * 1.5 + Math.random() * 3],
      });
      changed = true;
    }

    // ── Space gem spawn ─────────────────────────────────────────────────────
    gemSpawnTimer.current -= dt;
    if (gemSpawnTimer.current <= 0) {
      gemSpawnTimer.current = 0.35 + Math.random() * 0.35;
      const maxLane = Math.floor(laneCount / 2);
      const gx = (Math.floor(Math.random() * (maxLane * 2 + 1)) - maxLane) * LANE_WIDTH;
      objects.current.push({
        id: uuidv4(), type: ObjectType.SPACE_GEM,
        position: [gx, 0, pz - SPAWN_DISTANCE + 20],
        active: true, color: '#00ffcc', points: SPACE_GEM_VALUE,
      });
      changed = true;
    }

    // ── Update & collide all objects ────────────────────────────────────────
    for (const obj of objects.current) {
      if (!obj.active) continue;
      const vel = obj.velocity ?? [0, 0, 0];

      // Beta hull magnet — pulls space gems
      if (obj.type === ObjectType.SPACE_GEM && spec.magnetizedHull) {
        const dx = px - obj.position[0], dz = pz - obj.position[2];
        const d  = Math.sqrt(dx*dx + dz*dz);
        if (d < GEM_MAGNET_RADIUS) {
          const pull = 30 * dt;
          obj.position[0] += (dx / d) * pull;
          obj.position[2] += (dz / d) * pull;
        }
      }

      // Move
      obj.position[0] += vel[0] * dt;
      obj.position[1] += vel[1] * dt;
      obj.position[2] += vel[2] * dt;

      // Enemy fires bullets
      if ((obj.type === ObjectType.SPACE_ENEMY_SMALL || obj.type === ObjectType.SPACE_ENEMY_MEDIUM) && obj.fireTimer !== undefined) {
        obj.fireTimer -= dt;
        if (obj.fireTimer <= 0) {
          const fireInterval = Math.max(0.7, 2.0 - spLvl * 0.2);
          obj.fireTimer = fireInterval + Math.random();
          const dx = px - obj.position[0], dz = pz - obj.position[2];
          const mag = Math.sqrt(dx*dx + dz*dz) || 1;
          objects.current.push({
            id: uuidv4(), type: ObjectType.ENEMY_BULLET,
            position: [...obj.position] as [number, number, number],
            active: true, color: '#ff4400',
            velocity: [(dx/mag) * ENEMY_BULLET_SPEED, 0, (dz/mag) * ENEMY_BULLET_SPEED],
          });
          changed = true;
        }
      }

      const removeZ = pz + REMOVE_DISTANCE;
      if (obj.position[2] > removeZ) { obj.active = false; changed = true; }

      if (!obj.active) { kept.push(obj); continue; }

      const dx  = obj.position[0] - px;
      const dz  = obj.position[2] - pz;
      const dist2D = Math.sqrt(dx*dx + dz*dz);

      // ── Collision checks ─────────────────────────────────────────────────
      if (obj.type === ObjectType.SPACE_GEM) {
        if (dist2D < 1.1) {
          audio.playGemCollect();
          collectSpaceGem(obj.points ?? SPACE_GEM_VALUE);
          addPopup(`+${(obj.points ?? SPACE_GEM_VALUE) * useStore.getState().comboMultiplier}`, obj.position[0], obj.position[1]);
          window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: obj.color } }));
          obj.active = false; changed = true;

          // Check space level gem target
          const needed = (level - 5) * SPACE_GEM_TARGET_BASE + SPACE_GEM_TARGET_BASE;
          if (useStore.getState().spaceGemsCollected >= needed) {
            advanceSpaceLevel();
          }
        }
      } else if (obj.type === ObjectType.SPACE_ENEMY_SMALL || obj.type === ObjectType.SPACE_ENEMY_MEDIUM) {
        if (dist2D < 1.0) {
          window.dispatchEvent(new Event('player-hit'));
          window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#ff0000' } }));
          obj.active = false; changed = true;
        }
      } else if (obj.type === ObjectType.SPACE_ASTEROID) {
        const r = obj.radius ?? 0.85;
        if (dist2D < r + 0.5) {
          window.dispatchEvent(new Event('player-hit'));
          window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#887755' } }));
          obj.active = false; changed = true; breakCombo();
        }
      } else if (obj.type === ObjectType.ENEMY_BULLET) {
        if (dist2D < 0.55) {
          window.dispatchEvent(new Event('player-hit'));
          obj.active = false; changed = true; breakCombo();
        }
      } else if (obj.type === ObjectType.PLAYER_BULLET || obj.type === ObjectType.PLAYER_ROCKET) {
        // Check vs enemies
        for (const target of objects.current) {
          if (!target.active) continue;
          const isEnemy = target.type === ObjectType.SPACE_ENEMY_SMALL || target.type === ObjectType.SPACE_ENEMY_MEDIUM;
          const isRock  = target.type === ObjectType.SPACE_ASTEROID;
          if (!isEnemy && !isRock) continue;
          const bx   = obj.position[0] - target.position[0];
          const bz   = obj.position[2] - target.position[2];
          const hit  = Math.sqrt(bx*bx + bz*bz);
          const hrad = isRock ? (target.radius ?? 0.85) : (target.type === ObjectType.SPACE_ENEMY_MEDIUM ? 0.85 : 0.55);
          const isDmg = obj.type === ObjectType.PLAYER_ROCKET ? 5 : 1;

          if (hit < hrad + 0.25) {
            target.hp = (target.hp ?? 1) - isDmg;
            window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: target.position, color: isRock ? '#887755' : '#ff4400' } }));
            if (target.hp <= 0) {
              target.active = false;
              const pts = isRock ? 80 : (target.type === ObjectType.SPACE_ENEMY_MEDIUM ? 300 : 150);
              const earned = pts * useStore.getState().comboMultiplier;
              useStore.getState().addScore(earned);
              addPopup(`+${earned}`, target.position[0], target.position[1]);
              window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: target.position, color: isRock ? '#cc8844' : '#ff2200' } }));
            }
            obj.active = false; changed = true;
            break;
          }
        }
      }

      kept.push(obj);
    }

    if (changed) { objects.current = kept; setTick(t => t + 1); }
  };

  // ── Phase 1 runner update (original logic, unchanged) ─────────────────────
  const updateRunnerPhase = (dt: number) => {
    const dist = speed * dt;
    let changed = false;
    const kept: GameObject[] = [];
    const spawns: GameObject[] = [];

    for (const obj of objects.current) {
      let mv = dist;
      if (obj.type === ObjectType.MISSILE) mv += MISSILE_V * dt;

      // Magnet
      if (magnetActive && obj.type === ObjectType.GEM && obj.active) {
        const gp  = new THREE.Vector3(...obj.position);
        const dir = new THREE.Vector3().subVectors(playerPos.current, gp).normalize();
        const pull = 22 * dt;
        obj.position[0] += dir.x * pull;
        obj.position[1] += dir.y * pull;
        obj.position[2] += dir.z * pull;
      }

      // Moving obstacle sweep
      if (obj.type === ObjectType.MOVING_OBSTACLE && obj.active) {
        const sweepSpd = getSweepSpeed(level);
        const maxLane  = Math.floor(laneCount / 2);
        obj.position[0] += (obj.sweepDir ?? 1) * sweepSpd * dt * LANE_WIDTH;
        if (Math.abs(obj.position[0]) > maxLane * LANE_WIDTH) {
          obj.sweepDir = (obj.sweepDir === 1 ? -1 : 1) as 1 | -1;
        }
      }

      const prevZ = obj.position[2];
      obj.position[2] += mv;

      // Alien fires missile
      if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired && obj.position[2] > -90) {
        obj.hasFired = true;
        spawns.push({ id: uuidv4(), type: ObjectType.MISSILE, position: [obj.position[0], 1.0, obj.position[2]+2], active: true, color: '#ff0000' });
        window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#ff00ff' } }));
        changed = true;
      }

      let keep = true;
      if (obj.active) {
        if (obj.type === ObjectType.SHOP_PORTAL) {
          if (Math.abs(obj.position[2] - playerPos.current.z) < 3) {
            openShop(); obj.active = false; changed = true; keep = false;
          }
        } else if (obj.type === ObjectType.BOOST_RAMP) {
          if (Math.abs(obj.position[0] - playerPos.current.x) < LANE_WIDTH/2 &&
              obj.position[2] > playerPos.current.z - 2 &&
              obj.position[2] < playerPos.current.z + 2) {
            window.dispatchEvent(new Event('boost-launch'));
            obj.active = false; changed = true;
          }
        } else {
          const zNear = (prevZ < playerPos.current.z + 2.5) && (obj.position[2] > playerPos.current.z - 2.5);
          if (zNear) {
            const hw = obj.type === ObjectType.MISSILE         ? 0.55
                     : obj.type === ObjectType.ALIEN           ? 0.75
                     : obj.type === ObjectType.MOVING_OBSTACLE ? 0.85
                     : 0.88;
            const dx = Math.abs(obj.position[0] - playerPos.current.x);
            if (dx < hw) {
              const isDmg = [ObjectType.OBSTACLE, ObjectType.ALIEN, ObjectType.MISSILE, ObjectType.MOVING_OBSTACLE].includes(obj.type);
              if (isDmg) {
                const isLow = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.MOVING_OBSTACLE;
                if (isSliding && isLow) {
                  obj.active = false; changed = true;
                  window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#00ffff' } }));
                } else {
                  const py0 = playerPos.current.y, py1 = py0 + (isSliding ? 0.8 : 1.8);
                  let oy0 = 0, oy1 = 0.5;
                  if (obj.type === ObjectType.OBSTACLE)        { oy0 = 0; oy1 = OBS_H; }
                  if (obj.type === ObjectType.MISSILE)         { oy0 = 0.5; oy1 = 1.5; }
                  if (obj.type === ObjectType.ALIEN)           { oy0 = 1.0; oy1 = 2.0; }
                  if (obj.type === ObjectType.MOVING_OBSTACLE) { oy0 = 0; oy1 = 1.5; }
                  if (py0 < oy1 && py1 > oy0) {
                    window.dispatchEvent(new Event('player-hit'));
                    obj.active = false; changed = true;
                    if (obj.type === ObjectType.MISSILE)
                      window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: '#ff4400' } }));
                    breakCombo();
                  }
                }
              } else {
                const dy = Math.abs(obj.position[1] - playerPos.current.y);
                if (dy < 2.5) {
                  if (obj.type === ObjectType.GEM) {
                    collectGem(obj.points ?? 50);
                    audio.playGemCollect();
                    addPopup(`+${(obj.points??50)*comboMultiplier}${comboMultiplier>1?'×'+comboMultiplier:''}`, obj.position[0], obj.position[1]);
                  }
                  if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                    collectLetter(obj.targetIndex); audio.playLetterCollect();
                    addPopup('LETTER!', obj.position[0], obj.position[1]);
                  }
                  if (obj.type === ObjectType.POWERUP && obj.powerUpType) {
                    collectPowerUp(obj.powerUpType);
                    addPopup(obj.powerUpType, obj.position[0], obj.position[1]);
                  }
                  window.dispatchEvent(new CustomEvent('particle-burst', { detail: { position: obj.position, color: obj.color ?? '#ffffff' } }));
                  obj.active = false; changed = true;
                }
              }
            }
          }
        }
      }

      if (obj.position[2] > REMOVE_DISTANCE) { keep = false; changed = true; }
      if (keep) kept.push(obj);
    }

    if (spawns.length) { kept.push(...spawns); changed = true; }

    // ── Runner spawning ────────────────────────────────────────────────────
    const statics  = kept.filter(o => o.type !== ObjectType.MISSILE);
    const furthest = statics.length ? Math.min(...statics.map(o => o.position[2])) : -20;
    const minGap   = getMinGap(level, speed);

    if (furthest > -SPAWN_DISTANCE) {
      const spawnZ = Math.min(furthest - minGap, -SPAWN_DISTANCE);
      const isLetterDue = distTraveled.current >= nextLetterDist.current;

      if (isLetterDue) {
        const lx     = LANE(laneCount) * LANE_WIDTH;
        const target = ['G','E','M','I','N','I'];
        const avail  = target.map((_,i)=>i).filter(i=>!collectedLetters.includes(i));
        if (avail.length > 0) {
          const idx = avail[Math.floor(Math.random()*avail.length)];
          kept.push({ id: uuidv4(), type: ObjectType.LETTER, position: [lx,1.0,spawnZ], active:true, color:GEMINI_COLORS[idx], value:target[idx], targetIndex:idx });
        }
        nextLetterDist.current += getLetterInterval(level);
        changed = true;

      } else if (Math.random() > 0.08) {
        if (Math.random() < 0.06) {
          const types = [PowerUpType.SHIELD, PowerUpType.MAGNET, PowerUpType.SPEED_BOOST];
          const pType = types[Math.floor(Math.random()*types.length)];
          const pCol  = pType === PowerUpType.SHIELD ? '#00ffff' : pType === PowerUpType.MAGNET ? '#ff00ff' : '#ffff00';
          kept.push({ id:uuidv4(), type:ObjectType.POWERUP, powerUpType:pType, position:[LANE(laneCount)*LANE_WIDTH,1.5,spawnZ], active:true, color:pCol });
          changed = true;

        } else if (Math.random() < 0.05) {
          kept.push({ id:uuidv4(), type:ObjectType.BOOST_RAMP, position:[LANE(laneCount)*LANE_WIDTH,0.05,spawnZ], active:true, color:'#00ff88' });
          changed = true;

        } else {
          const maxLane  = Math.floor(laneCount / 2);
          const allLanes = Array.from({length:maxLane*2+1},(_,i)=>i-maxLane).sort(()=>Math.random()-.5);

          if (level >= 2 && Math.random() < 0.15) {
            const dir: 1|-1 = Math.random() > 0.5 ? 1 : -1;
            kept.push({ id:uuidv4(), type:ObjectType.MOVING_OBSTACLE, position:[0,0.7,spawnZ], active:true, color:'#ff8800', sweepDir:dir });
            changed = true;

          } else if (level >= 2 && Math.random() < 0.2) {
            const cnt = Math.random() < 0.7 ? 1 : Math.min(2 + (level-2), allLanes.length);
            for (let k = 0; k < cnt; k++)
              kept.push({ id:uuidv4(), type:ObjectType.ALIEN, position:[allLanes[k]*LANE_WIDTH,1.5,spawnZ], active:true, color:'#00ff00', hasFired:false });
            changed = true;

          } else {
            const p      = Math.random();
            const maxObs = Math.min(2 + Math.floor(level/2), allLanes.length - 1);
            const cnt    = p > 0.75 ? maxObs : p > 0.45 ? Math.min(2, allLanes.length-1) : 1;
            for (let i = 0; i < cnt; i++) {
              const lx = allLanes[i] * LANE_WIDTH;
              kept.push({ id:uuidv4(), type:ObjectType.OBSTACLE, position:[lx,OBS_H/2,spawnZ], active:true, color:'#ff0054' });
              if (Math.random() < 0.35)
                kept.push({ id:uuidv4(), type:ObjectType.GEM, position:[lx,OBS_H+1.0,spawnZ], active:true, color:'#ffd700', points:100 });
            }
            if (cnt < allLanes.length) {
              const freeLane = allLanes[cnt] * LANE_WIDTH;
              const trailLen = 3 + Math.floor(Math.random()*4);
              for (let t = 0; t < trailLen; t++)
                kept.push({ id:uuidv4(), type:ObjectType.GEM, position:[freeLane,1.2,spawnZ-t*3], active:true, color:'#00ffff', points:50 });
            }
            changed = true;
          }
        }
      }
    }

    if (changed) { objects.current = kept; setTick(t => t+1); }
  };

  return (
    <group>
      <ParticleSystem />
      {objects.current.map(obj => obj.active ? <GameEntity key={obj.id} data={obj} level={level} gamePhase={gamePhase} /> : null)}
    </group>
  );
};

// ── Game entity renderer ────────────────────────────────────────────────────────
const GEM_MAT_CACHE: Record<string, THREE.MeshStandardMaterial> = {};
function getGemMat(color: string) {
  if (!GEM_MAT_CACHE[color]) {
    GEM_MAT_CACHE[color] = new THREE.MeshStandardMaterial({ color, roughness:0, metalness:1, emissive:color, emissiveIntensity:2 });
  }
  return GEM_MAT_CACHE[color];
}

const GameEntity: React.FC<{ data: GameObject; level: number; gamePhase: 1 | 3 }> = React.memo(({ data, level, gamePhase }) => {
  const groupRef  = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current || !visualRef.current) return;
    const { status } = useStore.getState();
    if (status === GameStatus.PAUSED) return;
    const dt = Math.min(delta, MAX_DELTA);

    groupRef.current.position.set(data.position[0], 0, data.position[2]);

    // ── NEW: Phase 3 entity animations ─────────────────────────────────────
    if (gamePhase === 3) {
      if (data.type === ObjectType.SPACE_GEM) {
        visualRef.current.rotation.y += dt * 3;
        visualRef.current.rotation.x += dt * 1.5;
        visualRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.15;
      } else if (data.type === ObjectType.SPACE_ENEMY_SMALL || data.type === ObjectType.SPACE_ENEMY_MEDIUM) {
        visualRef.current.rotation.y += dt * 2;
        visualRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime * 3 + data.position[0]) * 0.2;
      } else if (data.type === ObjectType.SPACE_ASTEROID) {
        visualRef.current.rotation.x += dt * 0.7;
        visualRef.current.rotation.z += dt * 0.5;
        visualRef.current.position.y = data.position[1];
      } else {
        visualRef.current.position.y = data.position[1];
      }
      return;
    }

    // Phase 1 original animations (unchanged)
    if (data.type === ObjectType.GEM || data.type === ObjectType.POWERUP || data.type === ObjectType.LETTER) {
      visualRef.current.rotation.y += dt * 3;
      visualRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime*4 + data.position[0]) * 0.12;
    } else if (data.type === ObjectType.ALIEN) {
      visualRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime*3)*0.2;
      visualRef.current.rotation.y += dt;
    } else if (data.type === ObjectType.MISSILE) {
      visualRef.current.rotation.z += dt * 20;
      visualRef.current.position.y = data.position[1];
    } else if (data.type === ObjectType.MOVING_OBSTACLE) {
      visualRef.current.position.y = data.position[1] + Math.sin(state.clock.elapsedTime*2)*0.1;
    } else {
      visualRef.current.position.y = data.position[1];
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={visualRef} position={[0, data.position[1], 0]}>

        {/* ── NEW: Phase 3 entity meshes ───────────────────────────────────── */}

        {data.type === ObjectType.SPACE_GEM && (
          <group>
            <mesh geometry={SPACE_GEM_GEO} material={getGemMat(data.color ?? '#00ffcc')} />
            <mesh geometry={SPACE_GEM_GEO} scale={[1.4, 1.4, 1.4]}>
              <meshBasicMaterial color={data.color ?? '#00ffcc'} transparent opacity={0.15} />
            </mesh>
          </group>
        )}

        {data.type === ObjectType.SPACE_ENEMY_SMALL && (
          <group rotation={[Math.PI, 0, 0]}>
            <mesh geometry={ENEMY_SMALL_GEO}>
              <meshStandardMaterial color="#220000" roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh scale={[1.05, 1.05, 1.05]} geometry={ENEMY_SMALL_GEO}>
              <meshBasicMaterial color="#ff2200" wireframe transparent opacity={0.3} />
            </mesh>
          </group>
        )}

        {data.type === ObjectType.SPACE_ENEMY_MEDIUM && (
          <group rotation={[Math.PI, 0, 0]}>
            <mesh geometry={ENEMY_MEDIUM_GEO}>
              <meshStandardMaterial color="#1a0011" roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh scale={[1.05, 1.05, 1.05]} geometry={ENEMY_MEDIUM_GEO}>
              <meshBasicMaterial color="#ff44aa" wireframe transparent opacity={0.35} />
            </mesh>
            {/* HP bar above medium enemy */}
            {(data.hp ?? 1) < (data.maxHp ?? 1) && (
              <mesh position={[0, 1.2, 0]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[1.4 * (data.hp ?? 1) / (data.maxHp ?? 1), 0.12]} />
                <meshBasicMaterial color="#ff4400" />
              </mesh>
            )}
          </group>
        )}

        {data.type === ObjectType.SPACE_ASTEROID && (
          <group>
            <mesh geometry={(data.radius ?? 0.85) > 1 ? ASTEROID_LG_GEO : ASTEROID_GEO}>
              <meshStandardMaterial color="#664433" roughness={0.95} metalness={0.05} flatShading />
            </mesh>
            <mesh scale={[1.04, 1.04, 1.04]} geometry={(data.radius ?? 0.85) > 1 ? ASTEROID_LG_GEO : ASTEROID_GEO}>
              <meshBasicMaterial color="#887755" wireframe transparent opacity={0.2} />
            </mesh>
          </group>
        )}

        {data.type === ObjectType.PLAYER_BULLET && (
          <group rotation={[Math.PI/2, 0, 0]}>
            <mesh geometry={PLAYER_BULLET_GEO}>
              <meshBasicMaterial color={data.color ?? '#00ffff'} />
            </mesh>
          </group>
        )}

        {data.type === ObjectType.PLAYER_ROCKET && (
          <group rotation={[Math.PI/2, 0, 0]}>
            <mesh geometry={ROCKET_GEO}>
              <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={2} metalness={0.7} />
            </mesh>
            <mesh position={[0, -0.8, 0]}>
              <coneGeometry args={[0.2, 0.5, 5]} />
              <meshBasicMaterial color="#ffaa00" transparent opacity={0.8} />
            </mesh>
          </group>
        )}

        {data.type === ObjectType.ENEMY_BULLET && (
          <mesh geometry={ENEMY_BULLET_GEO}>
            <meshBasicMaterial color={data.color ?? '#ff4400'} />
          </mesh>
        )}

        {/* ── Phase 1 entity meshes (original, unchanged) ─────────────────── */}

        {data.type === ObjectType.OBSTACLE && (
          <group>
            <mesh geometry={OBS_GEO}><meshStandardMaterial color="#330011" roughness={0.3} metalness={0.8} flatShading /></mesh>
            <mesh scale={[1.02,1.02,1.02]} geometry={OBS_GEO}><meshBasicMaterial color={data.color} wireframe transparent opacity={0.25} /></mesh>
          </group>
        )}

        {data.type === ObjectType.MOVING_OBSTACLE && (
          <group>
            <mesh geometry={MOVE_OBS_GEO}><meshStandardMaterial color="#ff4400" roughness={0.2} metalness={0.9} /></mesh>
            <mesh scale={[1.05,1.05,1.05]} geometry={MOVE_OBS_GEO}><meshBasicMaterial color="#ff8800" wireframe transparent opacity={0.3} /></mesh>
          </group>
        )}

        {data.type === ObjectType.BOOST_RAMP && (
          <group>
            <mesh geometry={RAMP_GEO} rotation={[-0.3,0,0]}><meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={1} metalness={0.8} roughness={0.1} /></mesh>
            {[-0.6,-0.2,0.2].map((dz,i) => (
              <mesh key={i} position={[0,0.12,dz]} rotation={[-0.3,0,0]}>
                <coneGeometry args={[0.18,0.2,3]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
        )}

        {data.type === ObjectType.ALIEN && (
          <group>
            <mesh geometry={ALIEN_B_GEO}><meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} /></mesh>
            <mesh position={[0,0.2,0]} geometry={ALIEN_D_GEO}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} /></mesh>
          </group>
        )}

        {data.type === ObjectType.MISSILE && (
          <group rotation={[Math.PI/2,0,0]}>
            <mesh geometry={MISSILE_GEO}><meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} /></mesh>
          </group>
        )}

        {data.type === ObjectType.GEM && (
          <mesh geometry={GEM_GEO} material={getGemMat(data.color ?? '#00ffff')} />
        )}

        {data.type === ObjectType.LETTER && (
          <mesh>
            <boxGeometry args={[0.8,0.8,0.3]} />
            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} />
          </mesh>
        )}

        {data.type === ObjectType.POWERUP && (
          <mesh geometry={POWERUP_GEO}>
            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={2} metalness={1} roughness={0} />
          </mesh>
        )}

        {data.type === ObjectType.SHOP_PORTAL && (
          <group>
            <mesh position={[0,3,0]}>
              <boxGeometry args={[8,7,0.3]} />
              <meshBasicMaterial color="#001122" transparent opacity={0.8} />
            </mesh>
            <mesh position={[0,3,0]}>
              <boxGeometry args={[8.2,7.2,0.1]} />
              <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.4} />
            </mesh>
          </group>
        )}

      </group>
    </group>
  );
});
