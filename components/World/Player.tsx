/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus, SkinType, AircraftModel, AIRCRAFT_SPECS } from '../../types';
import { audio } from '../System/Audio';

// ── IS_MOBILE must be declared FIRST before any usage ─────────────────────────
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

const GRAVITY    = 50;
const JUMP_FORCE = 16;
const MAX_DELTA  = 0.05;
const SLIDE_H    = 0.4;

// ── Static geometries (declared AFTER IS_MOBILE) ──────────────────────────────
const TORSO_GEO  = new THREE.CylinderGeometry(0.25, 0.15, 0.6, 4);
const HEAD_GEO   = new THREE.BoxGeometry(0.25, 0.3, 0.3);
const ARM_GEO    = new THREE.BoxGeometry(0.12, 0.6, 0.12);
const JOINT_GEO  = new THREE.SphereGeometry(0.07);
const HIPS_GEO   = new THREE.CylinderGeometry(0.16, 0.16, 0.2);
const LEG_GEO    = new THREE.BoxGeometry(0.15, 0.7, 0.15);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, IS_MOBILE ? 16 : 32);
const SHIELD_GEO = new THREE.SphereGeometry(1, IS_MOBILE ? 12 : 20, IS_MOBILE ? 12 : 20);

// ── NEW: Spacecraft geometries ─────────────────────────────────────────────────
const SHIP_BODY_GEO   = new THREE.ConeGeometry(0.5, 1.8, IS_MOBILE ? 5 : 8);
const SHIP_WING_GEO   = new THREE.BoxGeometry(1.6, 0.12, 0.7);
const SHIP_ENGINE_GEO = new THREE.CylinderGeometry(0.18, 0.1, 0.5, 6);
const SHIP_GLOW_GEO   = new THREE.SphereGeometry(0.22, IS_MOBILE ? 6 : 10, IS_MOBILE ? 6 : 10);
const ROCKET_TRAIL_GEO = new THREE.ConeGeometry(0.18, 0.9, 6);

function buildMaterials(skin: SkinType, immortal: boolean) {
  let armor = '#00aaff', glow = '#00ffff';
  if (immortal)                         { armor = '#ffd700'; glow = '#ffffff'; }
  else if (skin === SkinType.NEON_BLUE) { armor = '#0066ff'; glow = '#00ffff'; }
  else if (skin === SkinType.NEON_GOLD) { armor = '#ffaa00'; glow = '#ffff00'; }
  else if (skin === SkinType.PHANTOM)   { armor = '#333333'; glow = '#ff00ff'; }
  return {
    arm:    new THREE.MeshStandardMaterial({ color: armor, roughness: 0.3, metalness: 0.8 }),
    joint:  new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.7, metalness: 0.5 }),
    glow:   new THREE.MeshBasicMaterial({ color: glow }),
    shadow: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true }),
    shield: new THREE.MeshStandardMaterial({
      color: '#4488ff', transparent: true, opacity: 0.15,
      wireframe: true, emissive: '#00aaff', emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
    }),
  };
}

// ── NEW: build ship materials based on aircraft model ─────────────────────────
function buildShipMaterials(model: AircraftModel) {
  const spec  = AIRCRAFT_SPECS[model];
  const col   = spec.color;
  return {
    body:   new THREE.MeshStandardMaterial({ color: '#0a0a1a', roughness: 0.3, metalness: 0.9 }),
    accent: new THREE.MeshStandardMaterial({ color: col, roughness: 0.1, metalness: 1.0, emissive: col, emissiveIntensity: 0.6 }),
    engine: new THREE.MeshStandardMaterial({ color: '#222244', roughness: 0.5, metalness: 0.7 }),
    glow:   new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }),
    trail:  new THREE.MeshBasicMaterial({ color: '#ff8800', transparent: true, opacity: 0.5 }),
    shield: new THREE.MeshStandardMaterial({
      color: '#00ff88', transparent: true, opacity: 0.12,
      wireframe: true, emissive: '#00ff88', emissiveIntensity: 2.0, side: THREE.DoubleSide,
    }),
  };
}

export const Player: React.FC = () => {
  const groupRef  = useRef<THREE.Group>(null);
  const bodyRef   = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);
  const lArmRef   = useRef<THREE.Group>(null);
  const rArmRef   = useRef<THREE.Group>(null);
  const lLegRef   = useRef<THREE.Group>(null);
  const rLegRef   = useRef<THREE.Group>(null);

  const {
    status, laneCount, takeDamage, hasDoubleJump, activateImmortality,
    isImmortalityActive, currentSkin, shieldActive, speedBoostActive,
    startSlide, isSliding,
    // ── NEW ─────────────────────────────────────────────────────────────────
    gamePhase, selectedAircraft, takeDamageSpace, shipShieldConsumed,
    rocketsRemaining, fireRocket,
  } = useStore();

  const [lane, setLane] = React.useState(0);
  const targetX         = useRef(0);
  const isJumping       = useRef(false);
  const velocityY       = useRef(0);
  const jumpsDone       = useRef(0);
  const spinRot         = useRef(0);
  const touchX          = useRef(0);
  const touchY          = useRef(0);
  const isInvincible    = useRef(false);
  const lastHitTime     = useRef(0);

  // ── NEW: ship mouse target in Phase 3 ────────────────────────────────────
  const shipTargetX = useRef(0);
  const shipTargetY = useRef(0);

  const mats = useMemo(
    () => buildMaterials(currentSkin, isImmortalityActive),
    [currentSkin, isImmortalityActive],
  );
  useEffect(() => () => { Object.values(mats).forEach((m: any) => m.dispose()); }, [mats]);

  // ── NEW: ship materials ───────────────────────────────────────────────────
  const shipModel = selectedAircraft ?? AircraftModel.ALPHA;
  const shipMats  = useMemo(() => buildShipMaterials(shipModel), [shipModel]);
  useEffect(() => () => { Object.values(shipMats).forEach((m: any) => m.dispose()); }, [shipMats]);

  // Reset on new game
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      isJumping.current = false; jumpsDone.current = 0;
      velocityY.current = 0;    spinRot.current   = 0;
      setLane(0);
      if (groupRef.current) groupRef.current.position.set(0, 0, 0);
      if (bodyRef.current)  bodyRef.current.rotation.x = 0;
    }
  }, [status]);

  // Clamp lane when laneCount changes
  useEffect(() => {
    const max = Math.floor(laneCount / 2);
    setLane(l => Math.max(Math.min(l, max), -max));
  }, [laneCount]);

  const doJump = () => {
    const maxJ = hasDoubleJump ? 2 : 1;
    if (!isJumping.current) {
      audio.playJump(false);
      isJumping.current = true; jumpsDone.current = 1; velocityY.current = JUMP_FORCE;
    } else if (jumpsDone.current < maxJ) {
      audio.playJump(true);
      jumpsDone.current++; velocityY.current = JUMP_FORCE; spinRot.current = 0;
    }
  };

  const doSlide = () => {
    if (!isJumping.current) { startSlide(); audio.playSlide(); }
  };

  // ── Keyboard (Phase 1 — original + NEW Phase 3 controls) ──────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;

      // ── NEW: Phase 3 keyboard ──────────────────────────────────────────────
      if (gamePhase === 3) {
        const max = Math.floor(laneCount / 2);
        if (e.key === 'ArrowLeft'  || e.key === 'a') setLane(l => Math.max(l - 1, -max));
        if (e.key === 'ArrowRight' || e.key === 'd') setLane(l => Math.min(l + 1,  max));
        if (e.key === 'r' || e.key === 'R') {
          if (rocketsRemaining > 0) {
            fireRocket();
            window.dispatchEvent(new CustomEvent('player-fire-rocket', { detail: { lane } }));
          }
        }
        return;
      }

      // Phase 1 original controls
      const max = Math.floor(laneCount / 2);
      if (e.key === 'ArrowLeft'  || e.key === 'a') setLane(l => Math.max(l - 1, -max));
      if (e.key === 'ArrowRight' || e.key === 'd') setLane(l => Math.min(l + 1,  max));
      if (e.key === 'ArrowUp'    || e.key === 'w') doJump();
      if (e.key === 'ArrowDown'  || e.key === 's') doSlide();
      if (e.key === ' ')                            activateImmortality();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [status, laneCount, hasDoubleJump, activateImmortality, gamePhase, rocketsRemaining, fireRocket, lane]);

  // Touch (original Phase 1 logic + NEW Phase 3 swipe)
  useEffect(() => {
    const start = (e: TouchEvent) => {
      touchX.current = e.touches[0].clientX;
      touchY.current = e.touches[0].clientY;
    };
    const end = (e: TouchEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const dx  = e.changedTouches[0].clientX - touchX.current;
      const dy  = e.changedTouches[0].clientY - touchY.current;
      const max = Math.floor(laneCount / 2);
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
        if (dx > 0) setLane(l => Math.min(l + 1, max));
        else        setLane(l => Math.max(l - 1, -max));
      } else if (gamePhase === 1) {
        // Phase 1 only: up/down swipe = jump/slide
        if      (dy < -25 && Math.abs(dy) > Math.abs(dx)) doJump();
        else if (dy >  25 && Math.abs(dy) > Math.abs(dx)) doSlide();
        else if (Math.abs(dx) < 10 && Math.abs(dy) < 10)  activateImmortality();
      }
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchend', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchend', end);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality, gamePhase]);

  // Damage handler — routes to correct takeDamage depending on phase
  useEffect(() => {
    const hit = () => {
      if (isInvincible.current || isImmortalityActive) return;
      audio.playDamage();
      if (gamePhase === 3) takeDamageSpace();
      else                 takeDamage();
      isInvincible.current = true;
      lastHitTime.current  = Date.now();
    };
    window.addEventListener('player-hit', hit);
    return () => window.removeEventListener('player-hit', hit);
  }, [takeDamage, takeDamageSpace, isImmortalityActive, gamePhase]);

  // Boost ramp launch (Phase 1 only)
  useEffect(() => {
    const launch = () => {
      isJumping.current = true;
      jumpsDone.current = 1;
      velocityY.current = JUMP_FORCE * 1.4;
      audio.playBoost();
    };
    window.addEventListener('boost-launch', launch);
    return () => window.removeEventListener('boost-launch', launch);
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status === GameStatus.PAUSED) return;
    if (status !== GameStatus.PLAYING) return;
    const dt = Math.min(delta, MAX_DELTA);

    // ── NEW: Phase 3 ship movement ───────────────────────────────────────────
    if (gamePhase === 3) {
      const spec        = AIRCRAFT_SPECS[shipModel];
      const agilityMult = spec.enhancedAgility ? 1.5 : 1.0;
      targetX.current   = lane * LANE_WIDTH;
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, targetX.current, dt * 14 * agilityMult,
      );
      // Gentle hover bob
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2.5) * 0.12;
      // Bank into turns
      const xDiff = targetX.current - groupRef.current.position.x;
      groupRef.current.rotation.z = -xDiff * 0.15;
      // Engine glow pulse via bodyRef
      if (bodyRef.current) {
        bodyRef.current.children.forEach((child, i) => {
          if (child instanceof THREE.Mesh && i > 3) {
            const mat = child.material as THREE.MeshBasicMaterial;
            if (mat.transparent) mat.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 8 + i) * 0.3;
          }
        });
      }
      // Invincibility flicker
      if (isInvincible.current) {
        if (Date.now() - lastHitTime.current > 1500) {
          isInvincible.current = false; groupRef.current.visible = true;
        } else {
          groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
        }
      } else {
        groupRef.current.visible = true;
      }
      return;
    }

    // ── Phase 1: original runner movement (unchanged) ────────────────────────
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x, targetX.current, dt * 15,
    );

    if (bodyRef.current) {
      const targetScaleY = isSliding ? SLIDE_H : 1;
      bodyRef.current.scale.y = THREE.MathUtils.lerp(bodyRef.current.scale.y, targetScaleY, dt * 12);
    }

    if (isJumping.current) {
      groupRef.current.position.y += velocityY.current * dt;
      velocityY.current -= GRAVITY * dt;
      if (groupRef.current.position.y <= 0) {
        groupRef.current.position.y = 0;
        isJumping.current = false; jumpsDone.current = 0; velocityY.current = 0;
        if (bodyRef.current) bodyRef.current.rotation.x = 0;
      }
      if (jumpsDone.current === 2 && bodyRef.current) {
        spinRot.current = Math.max(-Math.PI * 2, spinRot.current - dt * 15);
        bodyRef.current.rotation.x = spinRot.current;
      }
    }

    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2;

    const t = state.clock.elapsedTime * 25;
    if (!isJumping.current && !isSliding) {
      if (lArmRef.current) lArmRef.current.rotation.x = Math.sin(t) * 0.7;
      if (rArmRef.current) rArmRef.current.rotation.x = Math.sin(t + Math.PI) * 0.7;
      if (lLegRef.current) lLegRef.current.rotation.x = Math.sin(t + Math.PI) * 1.0;
      if (rLegRef.current) rLegRef.current.rotation.x = Math.sin(t) * 1.0;
      if (bodyRef.current) bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(t)) * 0.1;
    }

    if (shadowRef.current) {
      const h = groupRef.current.position.y;
      const s = Math.max(0.2, 1 - h / 5);
      shadowRef.current.scale.set(s, s, s);
      (shadowRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.3 - h * 0.04);
    }

    if (shieldRef.current && shieldActive) {
      const p = 1.2 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
      shieldRef.current.scale.set(p, p, p);
      shieldRef.current.rotation.y += dt * 0.5;
    }

    if (isInvincible.current) {
      if (Date.now() - lastHitTime.current > 1500) {
        isInvincible.current = false; groupRef.current.visible = true;
      } else {
        groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
      }
    } else {
      groupRef.current.visible = true;
    }
  });

  // ── NEW: Phase 3 — spacecraft render ──────────────────────────────────────
  if (gamePhase === 3) {
    const spec = AIRCRAFT_SPECS[shipModel];
    return (
      <group ref={groupRef}>
        <group ref={bodyRef}>
          {/* Main hull */}
          <mesh rotation={[Math.PI, 0, 0]} geometry={SHIP_BODY_GEO} material={shipMats.body} />
          {/* Accent stripe */}
          <mesh rotation={[Math.PI, 0, 0]} scale={[0.62, 1.02, 0.62]} geometry={SHIP_BODY_GEO} material={shipMats.accent} />
          {/* Wings */}
          <mesh position={[0, -0.1, 0.1]} geometry={SHIP_WING_GEO} material={shipMats.body} />
          <mesh position={[0, -0.1, 0.1]} scale={[1.01, 2.5, 1.01]} geometry={SHIP_WING_GEO} material={shipMats.accent} />
          {/* Engines */}
          <mesh position={[-0.55, -0.3, 0.1]} geometry={SHIP_ENGINE_GEO} material={shipMats.engine} />
          <mesh position={[ 0.55, -0.3, 0.1]} geometry={SHIP_ENGINE_GEO} material={shipMats.engine} />
          {/* Engine glows */}
          <mesh position={[-0.55, -0.6, 0.1]} geometry={SHIP_GLOW_GEO} material={shipMats.glow} />
          <mesh position={[ 0.55, -0.6, 0.1]} geometry={SHIP_GLOW_GEO} material={shipMats.glow} />
          {/* Thrust trails */}
          <mesh position={[-0.55, -1.0, 0.1]} rotation={[Math.PI, 0, 0]} geometry={ROCKET_TRAIL_GEO} material={shipMats.trail} />
          <mesh position={[ 0.55, -1.0, 0.1]} rotation={[Math.PI, 0, 0]} geometry={ROCKET_TRAIL_GEO} material={shipMats.trail} />
          {/* Delta passive shield ring (visible until consumed) */}
          {spec.shieldGenerator && !shipShieldConsumed && (
            <mesh geometry={SHIELD_GEO} material={shipMats.shield} scale={[1.8, 1.8, 1.8]} />
          )}
          {/* Beta magnet hull indicator */}
          {spec.magnetizedHull && (
            <mesh position={[0, 0.9, 0]}>
              <torusGeometry args={[0.6, 0.05, 6, 20]} />
              <meshBasicMaterial color={spec.color} transparent opacity={0.6} />
            </mesh>
          )}
          {/* Gamma double blaster barrels */}
          {spec.doubleBlasters && (
            <>
              <mesh position={[-0.38, 0.85, -0.15]}>
                <cylinderGeometry args={[0.05, 0.05, 0.5, 5]} />
                <meshBasicMaterial color={spec.color} />
              </mesh>
              <mesh position={[ 0.38, 0.85, -0.15]}>
                <cylinderGeometry args={[0.05, 0.05, 0.5, 5]} />
                <meshBasicMaterial color={spec.color} />
              </mesh>
            </>
          )}
        </group>
      </group>
    );
  }

  // ── Phase 1: original human runner (unchanged) ─────────────────────────────
  return (
    <group ref={groupRef}>
      <group ref={bodyRef} position={[0, 1.1, 0]}>
        {/* Torso */}
        <mesh castShadow position={[0, 0.2, 0]} geometry={TORSO_GEO} material={mats.arm} />
        {/* Head */}
        <mesh position={[0, 0.6, 0]} castShadow geometry={HEAD_GEO} material={mats.arm} />
        {/* Right arm */}
        <group position={[0.32, 0.4, 0]}><group ref={rArmRef}>
          <mesh position={[0, -0.25, 0]} geometry={ARM_GEO} material={mats.arm} />
          <mesh position={[0, -0.55, 0]} geometry={JOINT_GEO} material={mats.glow} />
        </group></group>
        {/* Left arm */}
        <group position={[-0.32, 0.4, 0]}><group ref={lArmRef}>
          <mesh position={[0, -0.25, 0]} geometry={ARM_GEO} material={mats.arm} />
          <mesh position={[0, -0.55, 0]} geometry={JOINT_GEO} material={mats.glow} />
        </group></group>
        {/* Hips */}
        <mesh position={[0, -0.15, 0]} geometry={HIPS_GEO} material={mats.joint} />
        {/* Right leg */}
        <group position={[0.12, -0.25, 0]}><group ref={rLegRef}>
          <mesh position={[0, -0.35, 0]} geometry={LEG_GEO} material={mats.arm} />
        </group></group>
        {/* Left leg */}
        <group position={[-0.12, -0.25, 0]}><group ref={lLegRef}>
          <mesh position={[0, -0.35, 0]} geometry={LEG_GEO} material={mats.arm} />
        </group></group>
        {/* Shield bubble */}
        {shieldActive && (
          <mesh ref={shieldRef} position={[0, 0.2, 0]} geometry={SHIELD_GEO} material={mats.shield} />
        )}
        {/* Speed boost trail */}
        {speedBoostActive && (
          <mesh position={[0, 0.2, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.1, 2, 6]} />
            <meshBasicMaterial color="#ffff00" transparent opacity={0.4} />
          </mesh>
        )}
      </group>
      {/* Floor shadow */}
      <mesh
        ref={shadowRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={SHADOW_GEO}
        material={mats.shadow}
      />
    </group>
  );
};
