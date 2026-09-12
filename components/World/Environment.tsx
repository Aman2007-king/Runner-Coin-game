/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, BiomeType, BIOME_BY_LEVEL, BIOME_COLORS } from '../../types';
import { IS_MOBILE } from '../../utils/device';

const STAR_COUNT = IS_MOBILE ? 800 : 2000;

// ── Star field (space phase only) ───────────────────────────────────────────
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

// ── Ambient particles (ground phase) — fireflies/pollen/dust/embers/snow ────
const AmbientParticles: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const speed = useStore(s => s.speed);
  const mesh  = useRef<THREE.Points>(null);
  const cols  = BIOME_COLORS[biome];
  const COUNT = IS_MOBILE ? 150 : 400;
  const fall  = biome === BiomeType.ICE_TEMPLE ? -1.2 : biome === BiomeType.CANYON_DUSK ? 0.6 : 0.15;
  const size  = biome === BiomeType.ICE_TEMPLE ? 0.18 : 0.12;

  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i*3]   = (Math.random()-0.5)*40;
      pos[i*3+1] = Math.random()*14;
      pos[i*3+2] = -5 - Math.random()*160;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const arr = mesh.current.geometry.attributes.position.array as Float32Array;
    const dt  = Math.min(delta, 0.05);
    const spd = (speed > 0 ? speed : 2) * dt;
    for (let i = 0; i < COUNT; i++) {
      arr[i*3+2] += spd;
      arr[i*3+1] += fall * dt;
      if (arr[i*3+2] > 10 || arr[i*3+1] < 0 || arr[i*3+1] > 16) {
        arr[i*3]   = (Math.random()-0.5)*40;
        arr[i*3+1] = Math.random()*14;
        arr[i*3+2] = -160 - Math.random()*20;
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={size} color={cols.accent} transparent opacity={0.7} sizeAttenuation />
    </points>
  );
};

// ── Wide ground plane — surrounding terrain beyond the lane path ───────────
const WideGround: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const speed  = useStore(s => s.speed);
  const ref    = useRef<THREE.Mesh>(null);
  const offset = useRef(0);
  const cols   = BIOME_COLORS[biome];

  useFrame((_, delta) => {
    if (!ref.current) return;
    const spd = Math.max(speed, 5);
    offset.current += spd * Math.min(delta, 0.05);
    ref.current.position.z = -100 + (offset.current % 10);
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI/2, 0, 0]} position={[0, -0.25, -100]}>
      <planeGeometry args={[300, 400]} />
      <meshStandardMaterial color={cols.ambient} roughness={1} />
    </mesh>
  );
};

// ── Lane path floor + dividers ──────────────────────────────────────────────
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
        <meshStandardMaterial color={cols.floor} roughness={0.95} />
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

// ── Sky orb — sun/moon depending on biome (skip on mobile for perf) ────────
const SkyOrb: React.FC<{ biome: BiomeType }> = ({ biome }) => {
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

// ── Ground-biome scenery props (trees, ruins, dunes, rock spires, ice) ─────
type PropKind = 'palm' | 'pine' | 'pillar_jungle' | 'pillar_desert' | 'dune' | 'rock_spire' | 'ice_spike' | 'ice_pillar';

const BIOME_PROPS: Partial<Record<BiomeType, PropKind[]>> = {
  [BiomeType.JUNGLE_RUINS]:  ['palm', 'palm', 'palm', 'pillar_jungle'],
  [BiomeType.DEEP_FOREST]:   ['pine', 'pine', 'pine', 'pine'],
  [BiomeType.DESERT_TEMPLE]: ['pillar_desert', 'dune', 'pillar_desert', 'dune'],
  [BiomeType.CANYON_DUSK]:   ['rock_spire', 'rock_spire', 'rock_spire'],
  [BiomeType.ICE_TEMPLE]:    ['ice_spike', 'ice_pillar', 'ice_spike'],
};

const Prop: React.FC<{ kind: PropKind; cols: { accent: string; dir: string; floor: string; grid: string } }> = ({ kind, cols }) => {
  switch (kind) {
    case 'palm':
      return (
        <>
          <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.15, 0.22, 3, 6]} /><meshStandardMaterial color={cols.grid} roughness={0.9} /></mesh>
          <mesh position={[0, 2.7, 0]}><coneGeometry args={[1.7, 1.3, 7]} /><meshStandardMaterial color={cols.dir} roughness={0.8} /></mesh>
          <mesh position={[0, 3.4, 0]}><coneGeometry args={[1.3, 1.6, 7]} /><meshStandardMaterial color={cols.accent} roughness={0.8} /></mesh>
        </>
      );
    case 'pine':
      return (
        <>
          <mesh position={[0, 1, 0]}><cylinderGeometry args={[0.15, 0.2, 2, 6]} /><meshStandardMaterial color={cols.grid} roughness={0.9} /></mesh>
          <mesh position={[0, 2.6, 0]}><coneGeometry args={[1.1, 2.2, 7]} /><meshStandardMaterial color={cols.accent} roughness={0.8} /></mesh>
          <mesh position={[0, 3.8, 0]}><coneGeometry args={[0.8, 1.8, 7]} /><meshStandardMaterial color={cols.dir} roughness={0.8} /></mesh>
          <mesh position={[0, 4.8, 0]}><coneGeometry args={[0.5, 1.4, 7]} /><meshStandardMaterial color={cols.accent} roughness={0.8} /></mesh>
        </>
      );
    case 'pillar_jungle':
    case 'pillar_desert':
      return (
        <>
          <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.6, 0.7, 4, 8]} /><meshStandardMaterial color={cols.grid} roughness={0.95} /></mesh>
          <mesh position={[0, 4.2, 0]}><boxGeometry args={[1.6, 0.4, 1.6]} /><meshStandardMaterial color={cols.accent} roughness={0.9} /></mesh>
        </>
      );
    case 'dune':
      return (
        <mesh scale={[1.6, 0.6, 1.6]} position={[0, 0.3, 0]}>
          <sphereGeometry args={[2, 10, 6]} />
          <meshStandardMaterial color={cols.floor} roughness={1} />
        </mesh>
      );
    case 'rock_spire':
      return (
        <>
          <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.9, 1.3, 3, 6]} /><meshStandardMaterial color={cols.grid} roughness={1} /></mesh>
          <mesh position={[0, 3.4, 0]}><cylinderGeometry args={[0.4, 0.9, 2, 6]} /><meshStandardMaterial color={cols.accent} roughness={1} /></mesh>
        </>
      );
    case 'ice_spike':
      return (
        <mesh position={[0, 2, 0]}>
          <coneGeometry args={[0.7, 4, 5]} />
          <meshStandardMaterial color={cols.accent} transparent opacity={0.75} roughness={0.1} metalness={0.2} />
        </mesh>
      );
    case 'ice_pillar':
      return (
        <>
          <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.7, 0.8, 4, 8]} /><meshStandardMaterial color={cols.floor} transparent opacity={0.85} roughness={0.2} /></mesh>
          <mesh position={[0, 4.2, 0]}><boxGeometry args={[1.5, 0.4, 1.5]} /><meshStandardMaterial color={cols.dir} roughness={0.9} /></mesh>
        </>
      );
    default:
      return null;
  }
};

const SideScenery: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const speed  = useStore(s => s.speed);
  const ref    = useRef<THREE.Group>(null);
  const offset = useRef(0);
  const cols   = BIOME_COLORS[biome];
  const kinds  = BIOME_PROPS[biome] ?? ['pine'];
  if (IS_MOBILE) return null;

  const items = useMemo(() => {
    const out: { x: number; z: number; s: number; kind: PropKind }[] = [];
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      out.push({
        x: side * (10 + Math.random() * 10),
        z: -i * 15,
        s: 0.8 + Math.random() * 0.7,
        kind: kinds[Math.floor(Math.random() * kinds.length)],
      });
    }
    return out;
  }, [biome]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    offset.current += Math.min(delta, 0.05) * speed;
    const cycle = 20 * 15;
    ref.current.position.z = offset.current % cycle;
  });

  return (
    <group ref={ref}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0, it.z]} scale={it.s}>
          <Prop kind={it.kind} cols={cols} />
        </group>
      ))}
    </group>
  );
};

// ── Space phase: spiral galaxy backdrop (canvas-generated texture) ────────
const GalaxyDisc: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const cols = BIOME_COLORS[biome];

  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const cx = size / 2, cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    grad.addColorStop(0,    '#ffffff');
    grad.addColorStop(0.15, cols.accent);
    grad.addColorStop(0.5,  cols.dir);
    grad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = cols.accent;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.25;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let t = 0; t < 40; t++) {
        const a = t * 0.35 + arm * Math.PI;
        const r = t * 2.6;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.5;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }, [biome]);

  if (!texture) return null;

  return (
    <mesh position={[0, -5, -420]} rotation={[Math.PI / 2.6, 0, 0.3]}>
      <planeGeometry args={[520, 520]} />
      <meshBasicMaterial map={texture} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ── Space phase: distant background planets ─────────────────────────────────
const Planets: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const cols = BIOME_COLORS[biome];
  const defs = useMemo(() => [
    { pos: [-90, 25, -350] as [number, number, number], r: 14, color: cols.accent, ring: false },
    { pos: [110, -20, -420] as [number, number, number], r: 22, color: cols.dir, ring: true },
  ], [biome]);

  return (
    <>
      {defs.map((p, i) => (
        <group key={i} position={p.pos}>
          <mesh>
            <sphereGeometry args={[p.r, IS_MOBILE ? 12 : 24, IS_MOBILE ? 12 : 24]} />
            <meshStandardMaterial color={p.color} roughness={0.8} emissive={p.color} emissiveIntensity={0.15} />
          </mesh>
          {p.ring && !IS_MOBILE && (
            <mesh rotation={[Math.PI / 2.4, 0, 0]}>
              <ringGeometry args={[p.r * 1.4, p.r * 2, 32]} />
              <meshBasicMaterial color={p.color} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
};

// ── Space phase: nebula cloud spheres (two-tone blend) ──────────────────────
const NebulaBackdrop: React.FC<{ biome: BiomeType }> = ({ biome }) => {
  const ref0 = useRef<THREE.Mesh>(null);
  const ref1 = useRef<THREE.Mesh>(null);
  const ref2 = useRef<THREE.Mesh>(null);
  const cols = BIOME_COLORS[biome];
  const refs = [ref0, ref1, ref2];
  const colors = [cols.accent, cols.dir, cols.accent];

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
          <meshBasicMaterial color={colors[i]} transparent opacity={0.05 + i * 0.012} side={THREE.BackSide} />
        </mesh>
      ))}
    </>
  );
};

// ── Space phase: background asteroid debris field (visual only) ────────────
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

// ── Space phase: dashed lane markers (replaces solid floor) ────────────────
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
  const biome     = BIOME_BY_LEVEL[level] ?? BiomeType.JUNGLE_RUINS;
  const cols      = BIOME_COLORS[biome];

  // ── Phase 3: real-galaxy space environment ─────────────────────────────────
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
        <GalaxyDisc biome={biome} />
        <Planets biome={biome} />
        <NebulaBackdrop biome={biome} />
        <AsteroidDebrisField biome={biome} />
        <SpaceLaneMarkers biome={biome} />
      </>
    );
  }

  // ── Phase 1: Temple-Run-style ground biomes (jungle/forest/desert/canyon/ice) ─
  return (
    <>
      <color attach="background" args={[cols.bg as any]} />
      <fog attach="fog" args={[cols.fog, IS_MOBILE ? 60 : 40, IS_MOBILE ? 120 : 160]} />
      <ambientLight intensity={0.55} color={cols.ambient} />
      <directionalLight position={[0, 20, -10]} intensity={1.3} color={cols.dir} />
      {!IS_MOBILE && (
        <pointLight position={[0, 25, -150]} intensity={1.2} color={cols.accent} distance={200} decay={2} />
      )}
      <WideGround biome={biome} />
      <LaneGuides biome={biome} />
      <SkyOrb biome={biome} />
      <SideScenery biome={biome} />
      <AmbientParticles biome={biome} />
    </>
  );
};
