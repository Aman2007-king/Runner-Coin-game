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
  if (IS_MOBILE) return null;

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
    const cycle = 20 * 15;
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

// ── NEW: Nebula backdrop cloud spheres for Phase 3 ─────────────────────────────
const NebulaBackdrop: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const ref0 = useRef<THREE.Mesh>(null);
  const ref1 = useRef<THREE.Mesh>(null);
  const ref2 = useRef<THREE.Mesh>(null);
  const cols = BIOME_COLORS[biome];
  const refs = [ref0, ref1, ref2];

  useFrame(state => {
    refs.forEach((r, i) => {
      if (!r.current) return;
      r.current.rotation.z = state.clock.elapsedTime * 0.02 * (i % 2 === 0 ? 1 : -1);
    });
  });

  const positions: [number, number, number][] = [[-60, 20, -220], [80, -10, -260], [0, 40, -300]];

  return (
    <>
      {positions.map((pos, i) => (
        <mesh key={i} ref={refs[i]} position={pos}>
          <sphereGeometry args={[50 + i * 20, IS_MOBILE ? 8 : 16, IS_MOBILE ? 8 : 16]} />
          <meshBasicMaterial color={cols.accent} transparent opacity={0.04 + i * 0.01} side={THREE.BackSide} />
        </mesh>
      ))}
    </>
  );
};

// ── NEW: Background asteroid debris field (visual only, non-collidable) ────────
const AsteroidDebrisField: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const groupRef = useRef<THREE.Group>(null);
  const cols     = BIOME_COLORS[biome];
  const speed    = useStore(s => s.speed);
  const offset   = useRef(0);

  const debris = useMemo(() => Array.from({ length: IS_MOBILE ? 12 : 30 }, () => ({
    x:         (Math.random() - 0.5) * 120,
    y:         (Math.random() - 0.5) * 40 + 5,
    z:         -60 - Math.random() * 200,
    r:         0.4 + Math.random() * 1.2,
    rotSpeedX: (Math.random() - 0.5) * 0.4,
    rotSpeedY: (Math.random() - 0.5) * 0.4,
  })), []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    offset.current += Math.max(speed, 5) * Math.min(delta, 0.05) * 0.5;
    groupRef.current.position.z = offset.current % 200;
    groupRef.current.children.forEach((child, i) => {
      if (i < debris.length) {
        child.rotation.x += debris[i].rotSpeedX * delta;
        child.rotation.y += debris[i].rotSpeedY * delta;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {debris.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, d.z]}>
          <dodecahedronGeometry args={[d.r, 0]} />
          <meshStandardMaterial color={cols.grid} roughness={0.9} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
};

// ── NEW: Dashed lane markers for space phase (replaces solid floor) ────────────
const SpaceLaneMarkers: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const laneCount = useStore(s => s.laneCount);
  const speed     = useStore(s => s.speed);
  const cols      = BIOME_COLORS[biome];
  const offset    = useRef(0);
  const groupRef  = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    offset.current += Math.max(speed, 5) * Math.min(delta, 0.05);
    groupRef.current.position.z = offset.current % 20;
  });

  const laneXs = useMemo(() => {
    const max = Math.floor(laneCount / 2);
    return Array.from({ length: laneCount + 1 }, (_, i) => (i - max) * LANE_WIDTH);
  }, [laneCount]);

  return (
    <group ref={groupRef}>
      {laneXs.map((x, xi) =>
        Array.from({ length: 12 }, (_, i) => (
          <mesh key={`${xi}-${i}`} position={[x, -1.5, -10 - i * 15]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshBasicMaterial color={cols.dir} transparent opacity={0.5} />
          </mesh>
        ))
      )}
    </group>
  );
};

// ── Main export ────────────────────────────────────────────────────────────────
export const Environment: React.FC = () => {
  const level     = useStore(s => s.level);
  const gamePhase = useStore(s => s.gamePhase);
  const biome     = BIOME_BY_LEVEL[level] ?? BiomeType.NEON_CITY;
  const cols      = BIOME_COLORS[biome];

  // ── NEW: Phase 3 — space environment ──────────────────────────────────────
  if (gamePhase === 3) {
    return (
      <>
        <color attach="background" args={[cols.bg as any]} />
        <fog attach="fog" args={[cols.fog, IS_MOBILE ? 100 : 80, IS_MOBILE ? 250 : 320]} />
        <ambientLight intensity={0.15} color={cols.ambient} />
        <directionalLight position={[0, 30, -10]} intensity={1.2} color={cols.dir} />
        {!IS_MOBILE && (
          <pointLight position={[0, 20, -80]} intensity={3} color={cols.accent} distance={300} decay={2} />
        )}
        <StarField biome={biome} />
        <NebulaBackdrop biome={biome} />
        <AsteroidDebrisField biome={biome} />
        <SpaceLaneMarkers biome={biome} />
      </>
    );
  }

  // ── Phase 1: original runner environment (unchanged) ──────────────────────
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
