/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center, Float } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import {
  GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE,
  GameStatus, GEMINI_COLORS, PowerUpType,
} from '../../types';
import { audio } from '../System/Audio';

// ─── Geometry Constants (created once at module level) ─────────────────────
const OBSTACLE_HEIGHT    = 1.6;
const OBSTACLE_GEO       = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_GLOW_GEO  = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_RING_GEO  = new THREE.RingGeometry(0.6, 0.9, 6);

const GEM_GEO     = new THREE.IcosahedronGeometry(0.3, 0);
const POWERUP_GEO = new THREE.TorusKnotGeometry(0.3, 0.1, 64, 8);

const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const ALIEN_EYE_GEO  = new THREE.SphereGeometry(0.1);

const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);

const SHADOW_LETTER_GEO  = new THREE.PlaneGeometry(2, 0.6);
const SHADOW_GEM_GEO     = new THREE.CircleGeometry(0.6, 32);
const SHADOW_POWERUP_GEO = new THREE.CircleGeometry(0.8, 32);
const SHADOW_ALIEN_GEO   = new THREE.CircleGeometry(0.8, 32);
const SHADOW_MISSILE_GEO = new THREE.PlaneGeometry(0.15, 3);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

const SHOP_FRAME_GEO   = new THREE.BoxGeometry(1, 7, 1);
const SHOP_BACK_GEO    = new THREE.BoxGeometry(1, 5, 1.2);
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8);
const SHOP_FLOOR_GEO   = new THREE.PlaneGeometry(1, 4);

// ─── Constants ────────────────────────────────────────────────────────────────
const PARTICLE_COUNT       = 600;
const BASE_LETTER_INTERVAL = 150;
const MISSILE_SPEED        = 30;
const MAX_DELTA            = 0.05; // Clamp delta to prevent tunneling/jitter on tab resume
const FONT_URL             = 'https://cdn.jsdelivr.net/npm/three/examples/fonts/helvetiker_bold.typeface.json';

const getLetterInterval = (level: number) =>
  BASE_LETTER_INTERVAL * Math.pow(1.5, Math.max(0, level - 1));

const getRandomLane = (laneCount: number) => {
  const max = Math.floor(laneCount / 2);
  return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

// ─── Particle System ──────────────────────────────────────────────────────────
const ParticleSystem: React.FC = () => {
  const mesh  = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() =>
    new Array(PARTICLE_COUNT).fill(0).map(() => ({
      life:   0,
      pos:    new THREE.Vector3(),
      vel:    new THREE.Vector3(),
      rot:    new THREE.Vector3(),
      rotVel: new THREE.Vector3(),
      color:  new THREE.Color(),
    })),
  []);

  useEffect(() => {
    const handleExplosion = (e: CustomEvent) => {
      const { position, color } = e.detail;
      const burstAmount = 40;
      let spawned = 0;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        if (p.life <= 0) {
          p.life = 1.0 + Math.random() * 0.5;
          p.pos.set(position[0], position[1], position[2]);

          const theta = Math.random() * Math.PI * 2;
          const phi   = Math.acos(2 * Math.random() - 1);
          const speed = 2 + Math.random() * 10;

          p.vel.set(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi),
          ).multiplyScalar(speed);

          p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          p.rotVel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(5);
          p.color.set(color);

          spawned++;
          if (spawned >= burstAmount) break;
        }
      }
    };

    window.addEventListener('particle-burst', handleExplosion as any);
    return () => window.removeEventListener('particle-burst', handleExplosion as any);
  }, [particles]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const { status } = useStore.getState();
    if (status === GameStatus.PAUSED) return;

    // FIX: clamp delta in the particle loop as well
    const safeDelta = Math.min(delta, MAX_DELTA);

    particles.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= safeDelta * 1.5;
        p.pos.addScaledVector(p.vel, safeDelta);
        p.vel.y -= safeDelta * 5;
        p.vel.multiplyScalar(0.98);
        p.rot.x += p.rotVel.x * safeDelta;
        p.rot.y += p.rotVel.y * safeDelta;

        dummy.position.copy(p.pos);
        const scale = Math.max(0, p.life * 0.25);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
        dummy.updateMatrix();

        mesh.current!.setMatrixAt(i, dummy.matrix);
        mesh.current!.setColorAt(i, p.color);
      } else {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
      }
    });

    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
      <octahedronGeometry args={[0.5, 0]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  );
};

// ─── Level Manager ────────────────────────────────────────────────────────────
export const LevelManager: React.FC = () => {
  const {
    status, speed, collectGem, collectLetter, collectPowerUp,
    collectedLetters, laneCount, setDistance, openShop, level, magnetActive,
  } = useStore();

  const objectsRef       = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus       = useRef(status);
  const prevLevel        = useRef(level);
  const playerObjRef     = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextLetterDist   = useRef(BASE_LETTER_INTERVAL);

  // Handle status / level transitions
  useEffect(() => {
    const isRestart      = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset    = status === GameStatus.MENU;
    const isLevelUp      = level !== prevLevel.current && status === GameStatus.PLAYING;
    const isVictoryReset = status === GameStatus.PLAYING && prevStatus.current === GameStatus.VICTORY;

    if (isMenuReset || isRestart || isVictoryReset) {
      objectsRef.current = [];
      setRenderTrigger(t => t + 1);
      distanceTraveled.current = 0;
      nextLetterDist.current   = getLetterInterval(1);

    } else if (isLevelUp && level > 1) {
      // Keep visible objects, clear far ones, spawn shop portal
      objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);
      objectsRef.current.push({
        id: uuidv4(), type: ObjectType.SHOP_PORTAL,
        position: [0, 0, -100], active: true,
      });
      nextLetterDist.current = distanceTraveled.current - SPAWN_DISTANCE + getLetterInterval(level);
      setRenderTrigger(t => t + 1);

    } else if (status === GameStatus.GAME_OVER || status === GameStatus.VICTORY) {
      setDistance(Math.floor(distanceTraveled.current));
    }

    prevStatus.current = status;
    prevLevel.current  = level;
  }, [status, level, setDistance]);

  // Resolve player mesh reference
  useFrame((state) => {
    if (!playerObjRef.current) {
      const group = state.scene.getObjectByName('PlayerGroup');
      if (group && group.children.length > 0) {
        playerObjRef.current = group.children[0];
      }
    }
  });

  // Main game loop
  useFrame((_, delta) => {
    if (status !== GameStatus.PLAYING) return;

    // FIX: clamp delta to prevent tunneling at high speeds after tab resume
    const safeDelta = Math.min(delta, MAX_DELTA);
    const dist      = speed * safeDelta;

    distanceTraveled.current += dist;

    let hasChanges = false;
    const playerPos = new THREE.Vector3(0, 0, 0);
    if (playerObjRef.current) playerObjRef.current.getWorldPosition(playerPos);

    const keptObjects: GameObject[] = [];
    const newSpawns:   GameObject[] = [];

    for (const obj of objectsRef.current) {
      let moveAmount = dist;
      if (obj.type === ObjectType.MISSILE) moveAmount += MISSILE_SPEED * safeDelta;

      // Magnet pull
      if (magnetActive && obj.type === ObjectType.GEM && obj.active) {
        const gemPos = new THREE.Vector3(...obj.position);
        const dir    = new THREE.Vector3().subVectors(playerPos, gemPos).normalize();
        const pull   = 25 * safeDelta;
        obj.position[0] += dir.x * pull;
        obj.position[1] += dir.y * pull;
        obj.position[2] += dir.z * pull;
      }

      const prevZ = obj.position[2];
      obj.position[2] += moveAmount;

      // Alien AI: fire missile when close enough
      if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired && obj.position[2] > -90) {
        obj.hasFired = true;
        newSpawns.push({
          id: uuidv4(), type: ObjectType.MISSILE,
          position: [obj.position[0], 1.0, obj.position[2] + 2],
          active: true, color: '#ff0000',
        });
        hasChanges = true;
        window.dispatchEvent(new CustomEvent('particle-burst', {
          detail: { position: obj.position, color: '#ff00ff' },
        }));
      }

      let keep = true;

      if (obj.active) {
        // ── Shop portal ──
        if (obj.type === ObjectType.SHOP_PORTAL) {
          if (Math.abs(obj.position[2] - playerPos.z) < 2) {
            openShop();
            obj.active = false;
            hasChanges = true;
            keep = false;
          }
        } else {
          // ── Swept collision ──
          const zThreshold = 2.0;
          const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);

          if (inZZone) {
            // Per-type AABB horizontal widths for fairer collision
            const hWidth = obj.type === ObjectType.MISSILE ? 0.6
                         : obj.type === ObjectType.ALIEN   ? 0.8
                         : 0.9;
            const dx = Math.abs(obj.position[0] - playerPos.x);

            if (dx < hWidth) {
              const isDamage = obj.type === ObjectType.OBSTACLE
                            || obj.type === ObjectType.ALIEN
                            || obj.type === ObjectType.MISSILE;

              if (isDamage) {
                // Per-type vertical AABB
                const playerBottom = playerPos.y;
                const playerTop    = playerPos.y + 1.8;

                let objBottom = obj.position[1] - 0.5;
                let objTop    = obj.position[1] + 0.5;

                if (obj.type === ObjectType.OBSTACLE) {
                  objBottom = 0;
                  objTop    = OBSTACLE_HEIGHT;
                } else if (obj.type === ObjectType.MISSILE) {
                  objBottom = 0.5;
                  objTop    = 1.5;
                } else if (obj.type === ObjectType.ALIEN) {
                  objBottom = 1.0;
                  objTop    = 2.0;
                }

                if (playerBottom < objTop && playerTop > objBottom) {
                  window.dispatchEvent(new Event('player-hit'));
                  obj.active = false;
                  hasChanges = true;

                  if (obj.type === ObjectType.MISSILE) {
                    window.dispatchEvent(new CustomEvent('particle-burst', {
                      detail: { position: obj.position, color: '#ff4400' },
                    }));
                  }
                }
              } else {
                // ── Collectibles ──
                const dy = Math.abs(obj.position[1] - playerPos.y);
                if (dy < 2.5) {
                  if (obj.type === ObjectType.GEM) {
                    collectGem(obj.points || 50);
                    audio.playGemCollect();
                  }
                  if (obj.type === ObjectType.LETTER && obj.targetIndex !== undefined) {
                    collectLetter(obj.targetIndex);
                    audio.playLetterCollect();
                  }
                  if (obj.type === ObjectType.POWERUP && obj.powerUpType) {
                    collectPowerUp(obj.powerUpType);
                    audio.playPowerUp();
                  }

                  window.dispatchEvent(new CustomEvent('particle-burst', {
                    detail: { position: obj.position, color: obj.color || '#ffffff' },
                  }));

                  obj.active = false;
                  hasChanges = true;
                }
              }
            }
          }
        }
      }

      if (obj.position[2] > REMOVE_DISTANCE) {
        keep = false;
        hasChanges = true;
      }

      if (keep) keptObjects.push(obj);
    }

    if (newSpawns.length > 0) keptObjects.push(...newSpawns);

    // ── Spawning ──
    const staticObjs = keptObjects.filter(o => o.type !== ObjectType.MISSILE);
    let furthestZ = staticObjs.length > 0
      ? Math.min(...staticObjs.map(o => o.position[2]))
      : -20;

    if (furthestZ > -SPAWN_DISTANCE) {
      const minGap = 12 + speed * 0.4;
      const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
      const isLetterDue = distanceTraveled.current >= nextLetterDist.current;

      if (isLetterDue) {
        const lane   = getRandomLane(laneCount);
        const target = ['G', 'E', 'M', 'I', 'N', 'I'];
        const available = target.map((_, i) => i).filter(i => !collectedLetters.includes(i));

        if (available.length > 0) {
          const idx   = available[Math.floor(Math.random() * available.length)];
          keptObjects.push({
            id: uuidv4(), type: ObjectType.LETTER,
            position: [lane * LANE_WIDTH, 1.0, spawnZ],
            active: true, color: GEMINI_COLORS[idx],
            value: target[idx], targetIndex: idx,
          });
          nextLetterDist.current += getLetterInterval(level);
        } else {
          keptObjects.push({
            id: uuidv4(), type: ObjectType.GEM,
            position: [lane * LANE_WIDTH, 1.2, spawnZ],
            active: true, color: '#00ffff', points: 50,
          });
        }
        hasChanges = true;

      } else if (Math.random() > 0.1) {
        // Power-up (5% chance)
        if (Math.random() < 0.05) {
          const lane  = getRandomLane(laneCount);
          const types = [PowerUpType.SHIELD, PowerUpType.MAGNET, PowerUpType.SPEED_BOOST];
          const pType = types[Math.floor(Math.random() * types.length)];
          const colors: Record<PowerUpType, string> = {
            [PowerUpType.SHIELD]:      '#00ffff',
            [PowerUpType.MAGNET]:      '#ff00ff',
            [PowerUpType.SPEED_BOOST]: '#ffff00',
          };
          keptObjects.push({
            id: uuidv4(), type: ObjectType.POWERUP, powerUpType: pType,
            position: [lane * LANE_WIDTH, 1.5, spawnZ],
            active: true, color: colors[pType],
          });
          hasChanges = true;

        } else {
          const isObstacle = Math.random() > 0.20;

          if (isObstacle) {
            const spawnAlien = level >= 2 && Math.random() < 0.2;

            if (spawnAlien) {
              const maxLane = Math.floor(laneCount / 2);
              const lanes   = Array.from({ length: maxLane * 2 + 1 }, (_, i) => i - maxLane)
                              .sort(() => Math.random() - 0.5);
              let count = 1;
              const p = Math.random();
              if (p > 0.7) count = Math.min(2, lanes.length);
              if (p > 0.9 && lanes.length >= 3) count = 3;

              for (let k = 0; k < count; k++) {
                keptObjects.push({
                  id: uuidv4(), type: ObjectType.ALIEN,
                  position: [lanes[k] * LANE_WIDTH, 1.5, spawnZ],
                  active: true, color: '#00ff00', hasFired: false,
                });
              }
            } else {
              const maxLane = Math.floor(laneCount / 2);
              const lanes   = Array.from({ length: maxLane * 2 + 1 }, (_, i) => i - maxLane)
                              .sort(() => Math.random() - 0.5);
              let count = 1;
              const p = Math.random();
              if (p > 0.80) count = Math.min(3, lanes.length);
              else if (p > 0.50) count = Math.min(2, lanes.length);

              for (let i = 0; i < count; i++) {
                const laneX = lanes[i] * LANE_WIDTH;
                keptObjects.push({
                  id: uuidv4(), type: ObjectType.OBSTACLE,
                  position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ],
                  active: true, color: '#ff0054',
                });
                if (Math.random() < 0.3) {
                  keptObjects.push({
                    id: uuidv4(), type: ObjectType.GEM,
                    position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ],
                    active: true, color: '#ffd700', points: 100,
                  });
                }
              }
            }
          } else {
            keptObjects.push({
              id: uuidv4(), type: ObjectType.GEM,
              position: [getRandomLane(laneCount) * LANE_WIDTH, 1.2, spawnZ],
              active: true, color: '#00ffff', points: 50,
            });
          }
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      objectsRef.current = keptObjects;
      setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

// ─── Game Entity ──────────────────────────────────────────────────────────────
const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
  const groupRef  = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const { laneCount } = useStore();

  useFrame((state, delta) => {
    const { status } = useStore.getState();
    if (status === GameStatus.PAUSED) return;

    // FIX: clamp delta in entity animations too
    const safeDelta = Math.min(delta, MAX_DELTA);

    if (groupRef.current) {
      groupRef.current.position.set(data.position[0], 0, data.position[2]);
    }

    if (visualRef.current) {
      const baseHeight = data.position[1];

      if (data.type === ObjectType.SHOP_PORTAL) {
        visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.02);

      } else if (data.type === ObjectType.MISSILE) {
        visualRef.current.rotation.z += safeDelta * 20;
        visualRef.current.position.y  = baseHeight;

      } else if (data.type === ObjectType.ALIEN) {
        visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
        visualRef.current.rotation.y += safeDelta;

      } else if (data.type !== ObjectType.OBSTACLE) {
        visualRef.current.rotation.y += safeDelta * 3;
        const bob = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
        visualRef.current.position.y = baseHeight + bob;

        if (shadowRef.current) {
          shadowRef.current.scale.setScalar(1 - bob);
        }
      } else {
        visualRef.current.position.y = baseHeight;
      }
    }
  });

  const shadowGeo = useMemo(() => {
    if (data.type === ObjectType.LETTER)    return SHADOW_LETTER_GEO;
    if (data.type === ObjectType.GEM)       return SHADOW_GEM_GEO;
    if (data.type === ObjectType.POWERUP)   return SHADOW_POWERUP_GEO;
    if (data.type === ObjectType.SHOP_PORTAL) return null;
    if (data.type === ObjectType.ALIEN)     return SHADOW_ALIEN_GEO;
    if (data.type === ObjectType.MISSILE)   return SHADOW_MISSILE_GEO;
    return SHADOW_DEFAULT_GEO;
  }, [data.type]);

  return (
    <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
      {data.type !== ObjectType.SHOP_PORTAL && shadowGeo && (
        <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
          <meshBasicMaterial color="#000000" opacity={0.3} transparent />
        </mesh>
      )}

      <group ref={visualRef} position={[0, data.position[1], 0]}>

        {/* ── Shop Portal ── */}
        {data.type === ObjectType.SHOP_PORTAL && (
          <group>
            <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}>
              <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
              <meshBasicMaterial color="#000000" />
            </mesh>
            <mesh position={[0, 3, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.2, 1, 1]}>
              <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.3} />
            </mesh>
            <Center position={[0, 5, 0.6]}>
              <Text3D font={FONT_URL} size={1.2} height={0.2}>
                CYBER SHOP
                <meshBasicMaterial color="#ffff00" />
              </Text3D>
            </Center>
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
              <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
            </mesh>
          </group>
        )}

        {/* ── Obstacle ── */}
        {data.type === ObjectType.OBSTACLE && (
          <group>
            <mesh geometry={OBSTACLE_GEO} castShadow receiveShadow>
              <meshStandardMaterial color="#330011" roughness={0.3} metalness={0.8} flatShading />
            </mesh>
            <mesh scale={[1.02, 1.02, 1.02]} geometry={OBSTACLE_GLOW_GEO}>
              <meshBasicMaterial color={data.color} wireframe transparent opacity={0.3} />
            </mesh>
            <mesh position={[0, -OBSTACLE_HEIGHT / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={OBSTACLE_RING_GEO}>
              <meshBasicMaterial color={data.color} transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}

        {/* ── Alien ── */}
        {data.type === ObjectType.ALIEN && (
          <group>
            <mesh castShadow geometry={ALIEN_BODY_GEO}>
              <meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.2, 0]} geometry={ALIEN_DOME_GEO}>
              <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} />
            </mesh>
            <mesh position={[ 0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
              <meshBasicMaterial color="#ff00ff" />
            </mesh>
            <mesh position={[-0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
              <meshBasicMaterial color="#ff00ff" />
            </mesh>
          </group>
        )}

        {/* ── Missile ── */}
        {data.type === ObjectType.MISSILE && (
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh geometry={MISSILE_CORE_GEO}>
              <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
            </mesh>
            <mesh position={[0,  1.0, 0]} geometry={MISSILE_RING_GEO}>
              <meshBasicMaterial color="#ffff00" />
            </mesh>
            <mesh position={[0,  0.0, 0]} geometry={MISSILE_RING_GEO}>
              <meshBasicMaterial color="#ffff00" />
            </mesh>
            <mesh position={[0, -1.0, 0]} geometry={MISSILE_RING_GEO}>
              <meshBasicMaterial color="#ffff00" />
            </mesh>
          </group>
        )}

        {/* ── Gem ── */}
        {data.type === ObjectType.GEM && (
          <mesh castShadow geometry={GEM_GEO}>
            <meshStandardMaterial
              color={data.color} roughness={0} metalness={1}
              emissive={data.color} emissiveIntensity={2}
            />
          </mesh>
        )}

        {/* ── Letter ── */}
        {data.type === ObjectType.LETTER && (
          <group scale={[1.5, 1.5, 1.5]}>
            <Center>
              <Text3D
                font={FONT_URL} size={0.8} height={0.5}
                bevelEnabled bevelThickness={0.02} bevelSize={0.02} bevelSegments={5}
              >
                {data.value}
                <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} />
              </Text3D>
            </Center>
          </group>
        )}

        {/* ── Power-up ── */}
        {data.type === ObjectType.POWERUP && (
          <group>
            <mesh geometry={POWERUP_GEO} castShadow>
              <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={2} metalness={1} roughness={0} />
            </mesh>
            <Float speed={5} rotationIntensity={2} floatIntensity={2}>
              <Center position={[0, 1.2, 0]}>
                <Text3D font={FONT_URL} size={0.3} height={0.1}>
                  {data.powerUpType}
                  <meshBasicMaterial color={data.color} />
                </Text3D>
              </Center>
            </Float>
          </group>
        )}
      </group>
    </group>
  );
});
