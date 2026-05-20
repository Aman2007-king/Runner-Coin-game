/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus, SkinType } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16;
const MAX_DELTA = 0.05; // clamp so a tab-background spike doesn't launch the player

// Static Geometries — created once, shared across renders
const TORSO_GEO     = new THREE.CylinderGeometry(0.25, 0.15, 0.6, 4);
const JETPACK_GEO   = new THREE.BoxGeometry(0.3, 0.4, 0.15);
const GLOW_STRIP_GEO = new THREE.PlaneGeometry(0.05, 0.2);
const HEAD_GEO      = new THREE.BoxGeometry(0.25, 0.3, 0.3);
const ARM_GEO       = new THREE.BoxGeometry(0.12, 0.6, 0.12);
const JOINT_GEO     = new THREE.SphereGeometry(0.07);
const HIPS_GEO      = new THREE.CylinderGeometry(0.16, 0.16, 0.2);
const LEG_GEO       = new THREE.BoxGeometry(0.15, 0.7, 0.15);
const SHADOW_GEO    = new THREE.CircleGeometry(0.5, 32);

/** Build (or rebuild) the five materials the player needs and return them. */
function buildMaterials(skin: SkinType, immortal: boolean) {
  let armorColor = '#00aaff';
  let glowColor  = '#00ffff';

  if (immortal) {
    armorColor = '#ffd700';
    glowColor  = '#ffffff';
  } else {
    switch (skin) {
      case SkinType.NEON_BLUE:
        armorColor = '#0066ff'; glowColor = '#00ffff'; break;
      case SkinType.NEON_GOLD:
        armorColor = '#ffaa00'; glowColor = '#ffff00'; break;
      case SkinType.PHANTOM:
        armorColor = '#333333'; glowColor = '#ff00ff'; break;
    }
  }

  return {
    armorMat:  new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.3, metalness: 0.8 }),
    jointMat:  new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.7, metalness: 0.5 }),
    glowMat:   new THREE.MeshBasicMaterial({ color: glowColor }),
    shadowMat: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true }),
    shieldMat: new THREE.MeshStandardMaterial({
      color: '#4488ff', transparent: true, opacity: 0.15, wireframe: true,
      emissive: '#00aaff', emissiveIntensity: 1.5, side: THREE.DoubleSide,
    }),
  };
}

export const Player: React.FC = () => {
  const groupRef  = useRef<THREE.Group>(null);
  const bodyRef   = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shieldRef = useRef<THREE.Mesh>(null);

  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef  = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const {
    status,
    laneCount,
    takeDamage,
    hasDoubleJump,
    activateImmortality,
    isImmortalityActive,
    currentSkin,
    shieldActive,
    speedBoostActive,
  } = useStore();

  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);

  // Physics state — refs so updates are immediate inside useFrame
  const isJumping     = useRef(false);
  const velocityY     = useRef(0);
  const jumpsPerformed = useRef(0);
  const spinRotation  = useRef(0);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible    = useRef(false);
  const lastDamageTime  = useRef(0);

  // --- Materials ---
  // Build a fresh set whenever skin or immortality changes, then dispose the old set.
  const mats = useMemo(
    () => buildMaterials(currentSkin, isImmortalityActive),
    [currentSkin, isImmortalityActive],
  );

  // Dispose previous materials when mats reference changes or on unmount
  useEffect(() => {
    return () => {
      mats.armorMat.dispose();
      mats.jointMat.dispose();
      mats.glowMat.dispose();
      mats.shadowMat.dispose();
      mats.shieldMat.dispose();
    };
  }, [mats]);

  // --- Reset on game start ---
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      isJumping.current     = false;
      jumpsPerformed.current = 0;
      velocityY.current     = 0;
      spinRotation.current  = 0;
      setLane(0);
      if (groupRef.current) groupRef.current.position.set(0, 0, 0);
      if (bodyRef.current)  bodyRef.current.rotation.x = 0;
    }
  }, [status]);

  // Safety: clamp lane when laneCount changes
  useEffect(() => {
    const maxLane = Math.floor(laneCount / 2);
    setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
  }, [laneCount]);

  // --- Jump helper ---
  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;
    if (!isJumping.current) {
      audio.playJump(false);
      isJumping.current     = true;
      jumpsPerformed.current = 1;
      velocityY.current     = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
      audio.playJump(true);
      jumpsPerformed.current += 1;
      velocityY.current     = JUMP_FORCE;
      spinRotation.current  = 0;
    }
  };

  // --- Keyboard controls ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const maxLane = Math.floor(laneCount / 2);
      if      (e.key === 'ArrowLeft')                setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight')               setLane(l => Math.min(l + 1, maxLane));
      else if (e.key === 'ArrowUp' || e.key === 'w') triggerJump();
      else if (e.key === ' ' || e.key === 'Enter')   activateImmortality();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  // --- Touch controls ---
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      const maxLane = Math.floor(laneCount / 2);

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx > 0) setLane(l => Math.min(l + 1, maxLane));
        else        setLane(l => Math.max(l - 1, -maxLane));
      } else if (Math.abs(dy) > Math.abs(dx) && dy < -30) {
        triggerJump();
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        activateImmortality();
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend',   handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  // --- Damage handler ---
  useEffect(() => {
    const checkHit = () => {
      if (isInvincible.current || isImmortalityActive) return;
      audio.playDamage();
      takeDamage();
      isInvincible.current  = true;
      lastDamageTime.current = Date.now();
    };
    window.addEventListener('player-hit', checkHit);
    return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive]);

  // --- Animation loop ---
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status === GameStatus.PAUSED) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    // FIX: clamp delta so a backgrounded-tab spike can't fling the player
    const safeDelta = Math.min(delta, MAX_DELTA);

    // 1. Horizontal movement
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetX.current,
      safeDelta * 15,
    );

    // 2. Jump physics
    if (isJumping.current) {
      groupRef.current.position.y += velocityY.current * safeDelta;
      velocityY.current -= GRAVITY * safeDelta;

      if (groupRef.current.position.y <= 0) {
        groupRef.current.position.y = 0;
        isJumping.current     = false;
        jumpsPerformed.current = 0;
        velocityY.current     = 0;
        if (bodyRef.current) bodyRef.current.rotation.x = 0;
      }

      // Double-jump flip
      if (jumpsPerformed.current === 2 && bodyRef.current) {
        spinRotation.current -= safeDelta * 15;
        if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
        bodyRef.current.rotation.x = spinRotation.current;
      }
    }

    // 3. Banking rotation
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2;
    groupRef.current.rotation.x = isJumping.current ? 0.1 : 0.05;

    // 4. Skeletal animation
    const time = state.clock.elapsedTime * 25;

    if (!isJumping.current) {
      if (leftArmRef.current)  leftArmRef.current.rotation.x  = Math.sin(time) * 0.7;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.7;
      if (leftLegRef.current)  leftLegRef.current.rotation.x  = Math.sin(time + Math.PI) * 1.0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.0;
      if (bodyRef.current) bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(time)) * 0.1;
    } else {
      const s = safeDelta * 10;
      if (leftArmRef.current)  leftArmRef.current.rotation.x  = THREE.MathUtils.lerp(leftArmRef.current.rotation.x,  -2.5, s);
      if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -2.5, s);
      if (leftLegRef.current)  leftLegRef.current.rotation.x  = THREE.MathUtils.lerp(leftLegRef.current.rotation.x,   0.5, s);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.5, s);
      if (bodyRef.current && jumpsPerformed.current !== 2) bodyRef.current.position.y = 1.1;
    }

    // 5. Dynamic shadow
    if (shadowRef.current) {
      const height = groupRef.current.position.y;
      const scale  = Math.max(0.2, 1 - (height / 2.5) * 0.5);
      const stretch = isJumping.current ? 1 : 1 + Math.abs(Math.sin(time)) * 0.3;
      shadowRef.current.scale.set(scale, scale, scale * stretch);
      const mat = shadowRef.current.material as THREE.MeshBasicMaterial;
      if (mat && !Array.isArray(mat)) {
        mat.opacity = Math.max(0.1, 0.3 - (height / 2.5) * 0.2);
      }
    }

    // 6. Shield pulse
    if (shieldRef.current && shieldActive) {
      const pulse = 1.2 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
      shieldRef.current.scale.set(pulse, pulse, pulse);
      shieldRef.current.rotation.y += safeDelta * 0.5;
      shieldRef.current.rotation.z += safeDelta * 0.3;
    }

    // 7. Invincibility flicker
    const flicker = isInvincible.current || isImmortalityActive;
    if (flicker) {
      if (isInvincible.current) {
        if (Date.now() - lastDamageTime.current > 1500) {
          isInvincible.current = false;
          groupRef.current.visible = true;
        } else {
          groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
        }
      }
      if (isImmortalityActive) groupRef.current.visible = true;
    } else {
      groupRef.current.visible = true;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={bodyRef} position={[0, 1.1, 0]}>

        {/* Torso */}
        <mesh castShadow position={[0, 0.2, 0]} geometry={TORSO_GEO} material={mats.armorMat} />

        {/* Jetpack */}
        <mesh position={[0, 0.2, -0.2]} geometry={JETPACK_GEO} material={mats.jointMat} />
        <mesh position={[-0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={mats.glowMat} />
        <mesh position={[ 0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={mats.glowMat} />

        {/* Head */}
        <group position={[0, 0.6, 0]}>
          <mesh castShadow geometry={HEAD_GEO} material={mats.armorMat} />
        </group>

        {/* Right arm */}
        <group position={[0.32, 0.4, 0]}>
          <group ref={rightArmRef}>
            <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO}  material={mats.armorMat} />
            <mesh position={[0, -0.55, 0]} geometry={JOINT_GEO} material={mats.glowMat} />
          </group>
        </group>

        {/* Left arm */}
        <group position={[-0.32, 0.4, 0]}>
          <group ref={leftArmRef}>
            <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO}  material={mats.armorMat} />
            <mesh position={[0, -0.55, 0]} geometry={JOINT_GEO} material={mats.glowMat} />
          </group>
        </group>

        {/* Hips */}
        <mesh position={[0, -0.15, 0]} geometry={HIPS_GEO} material={mats.jointMat} />

        {/* Right leg */}
        <group position={[0.12, -0.25, 0]}>
          <group ref={rightLegRef}>
            <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={mats.armorMat} />
          </group>
        </group>

        {/* Left leg */}
        <group position={[-0.12, -0.25, 0]}>
          <group ref={leftLegRef}>
            <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={mats.armorMat} />
          </group>
        </group>

        {/* Shield bubble */}
        {shieldActive && (
          <mesh ref={shieldRef} position={[0, 0.2, 0]}>
            <sphereGeometry args={[1, 24, 24]} />
            <primitive object={mats.shieldMat} attach="material" />
          </mesh>
        )}

        {/* Speed boost trail */}
        {speedBoostActive && (
          <group position={[0, 0.2, 0.5]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.5, 0.1, 2, 8]} />
              <meshBasicMaterial color="#ffff00" transparent opacity={0.5} />
            </mesh>
          </group>
        )}
      </group>

      {/* Floor shadow */}
      <mesh
        ref={shadowRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={SHADOW_GEO}
        material={mats.shadowMat}
      />
    </group>
  );
};
