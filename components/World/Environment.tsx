/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, BiomeType, BIOME_BY_LEVEL, BIOME_COLORS } from '../../types';

const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
const STAR_COUNT = IS_MOBILE ? 800 : 2000;

// ── Star field ────────────────────────────────────────────────────────────────
const StarField: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const speed  = useStore(s => s.speed);
  const mesh   = useRef<THREE.Points>(null);
  const cols   = BIOME_COLORS[biome];

  const positions = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      pos[i*3]   = (Math.random()-0.5)*400;
      pos[i*3+1] = (Math.random()-0.5)*200+50;
      pos[i*3+2] = -550 + Math.random()*650;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const arr = mesh.current.geometry.attributes.position.array as Float32Array;
    const spd = (speed > 0 ? speed : 2) * Math.min(delta, 0.05) * 2;
    for (let i = 0; i < STAR_COUNT; i++) {
      arr[i*3+2] += spd;
      if (arr[i*3+2] > 100) {
        arr[i*3]   = (Math.random()-0.5)*400;
        arr[i*3+1] = (Math.random()-0.5)*200+50;
        arr[i*3+2] = -550 - Math.random()*50;
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={STAR_COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.5} color={cols.accent} transparent opacity={0.8} sizeAttenuation />
    </points>
  );
};

// ── Moving grid ────────────────────────────────────────────────────────────────
const MovingGrid: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const speed  = useStore(s => s.speed);
  const ref    = useRef<THREE.Mesh>(null);
  const offset = useRef(0);
  const cols   = BIOME_COLORS[biome];
  // Fewer segments on mobile
  const segs   = IS_MOBILE ? [20, 25] : [30, 40];

  useFrame((_, delta) => {
    if (!ref.current) return;
    const spd = Math.max(speed, 5);
    offset.current += spd * Math.min(delta, 0.05);
    ref.current.position.z = -100 + (offset.current % 10);
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI/2, 0, 0]} position={[0, -0.2, -100]}>
      <planeGeometry args={[300, 400, segs[0], segs[1]]} />
      <meshBasicMaterial color={cols.grid} wireframe transparent opacity={0.12} />
    </mesh>
  );
};

// ── Lane guides ────────────────────────────────────────────────────────────────
const LaneGuides: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const laneCount = useStore(s => s.laneCount);
  const cols      = BIOME_COLORS[biome];

  const separators = useMemo(() => {
    const xs: number[] = [];
    const startX = -(laneCount * LANE_WIDTH) / 2;
    for (let i = 0; i <= laneCount; i++) xs.push(startX + i * LANE_WIDTH);
    return xs;
  }, [laneCount]);

  return (
    <group position={[0, 0.02, 0]}>
      <mesh position={[0, -0.02, -20]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[laneCount * LANE_WIDTH, 200]} />
        <meshBasicMaterial color={cols.floor} transparent opacity={0.9} />
      </mesh>
      {separators.map((x, i) => (
        <mesh key={i} position={[x, 0, -20]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[0.05, 200]} />
          <meshBasicMaterial color={cols.dir} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
};

// ── Retro sun (skip on mobile for perf) ────────────────────────────────────────
const RetroSun: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const sunRef = useRef<THREE.Group>(null);

  useFrame(state => {
    if (!sunRef.current) return;
    sunRef.current.position.y = 30 + Math.sin(state.clock.elapsedTime * 0.2);
  });

  const cols = BIOME_COLORS[biome];

  return (
    <group ref={sunRef} position={[0, 30, -180]}>
      <mesh>
        <sphereGeometry args={[35, IS_MOBILE ? 16 : 32, IS_MOBILE ? 16 : 32]} />
        <meshBasicMaterial color={cols.accent} />
      </mesh>
    </group>
  );
};

// ── Side scenery ────────────────────────────────────────────────────────────────
const SideScenery: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const speed  = useStore(s => s.speed);
  const ref    = useRef<THREE.Group>(null);
  const offset = useRef(0);
  const cols   = BIOME_COLORS[biome];
  if (IS_MOBILE) return null; // skip on mobile

  const buildings = useMemo(() => {
    const out = [];
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      out.push({
        x: side * (12 + Math.random() * 8),
        z: -i * 15,
        h: 3 + Math.random() * 10,
        w: 1.5 + Math.random() * 2,
      });
    }
    return out;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    offset.current += Math.min(delta, 0.05) * speed;
    const cycle = 20 * 15; // 20 buildings * 15 gap
    ref.current.position.z = offset.current % cycle;
  });

  return (
    <group ref={ref}>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.h/2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshBasicMaterial color={cols.ambient} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// ── Main export ────────────────────────────────────────────────────────────────
export const Environment: React.FC = () => {
  const level = useStore(s => s.level);
  const biome = BIOME_BY_LEVEL[level] ?? BiomeType.NEON_CITY;
  const cols  = BIOME_COLORS[biome];

  return (
    <>
      <color attach="background" args={[cols.bg as any]} />
      <fog attach="fog" args={[cols.fog, IS_MOBILE ? 60 : 40, IS_MOBILE ? 120 : 160]} />
      <ambientLight intensity={0.2} color={cols.ambient} />
      <directionalLight position={[0, 20, -10]} intensity={1.5} color={cols.dir} />
      {!IS_MOBILE && (
        <pointLight position={[0, 25, -150]} intensity={2} color={cols.accent} distance={200} decay={2} />
      )}
      <StarField biome={biome} />
      <MovingGrid biome={biome} />
      <LaneGuides biome={biome} />
      <RetroSun biome={biome} />
      <SideScenery biome={biome} />
    </>
  );
};
