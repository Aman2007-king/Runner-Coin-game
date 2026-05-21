/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './components/World/Environment';
import { Player } from './components/World/Player';
import { LevelManager } from './components/World/LevelManager';
import { HUD } from './components/UI/HUD';
import { useStore } from './store';
import { GameStatus } from './types';
import { audio } from './components/System/Audio';
import ErrorBoundary from './components/System/ErrorBoundary';

// ── Detect mobile once ────────────────────────────────────────────────────────
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  || window.innerWidth < 768;

// ── Camera controller with screen shake ────────────────────────────────────────
const CameraController: React.FC = () => {
  const { camera, size } = useThree();
  const { laneCount, screenShake, decayScreenShake } = useStore();
  const shakeOffset = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const aspect    = size.width / size.height;
    const isMobile  = aspect < 1.2;
    const extra     = Math.max(0, laneCount - 3);
    const targetY   = 5.5  + extra * (isMobile ? 2.0 : 0.5);
    const targetZ   = 8.0  + extra * (isMobile ? 4.5 : 1.0);
    const safeDelta = Math.min(delta, 0.05);

    camera.position.lerp(new THREE.Vector3(0, targetY, targetZ), safeDelta * 2.0);
    camera.lookAt(0, 0, -30);

    // Screen shake — perlin-like random offset scaled by trauma²
    if (screenShake > 0) {
      const mag = screenShake * screenShake * 0.4;
      shakeOffset.current.set(
        (Math.random() - 0.5) * mag,
        (Math.random() - 0.5) * mag,
        0,
      );
      camera.position.add(shakeOffset.current);
      decayScreenShake(delta);
    }
  });
  return null;
};

// ── Lightweight bloom replacement — no postprocessing lib on mobile ───────────
// We just use a slightly adjusted fog + higher emissive intensities
const Scene: React.FC = () => (
  <>
    <Environment />
    <group name="PlayerGroup" userData={{ isPlayer: true }}>
      <Player />
    </group>
    <LevelManager />
  </>
);

export default function App() {
  const { status, togglePause, isMuted } = useStore();

  React.useEffect(() => {
    if (status === GameStatus.PLAYING) audio.startMusic();
    else audio.stopMusic();
  }, [status]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [togglePause]);

  // Pixel ratio: cap at 1 on mobile for big perf win
  const dpr: [number, number] = IS_MOBILE ? [1, 1] : [1, 1.5];

  return (
    <ErrorBoundary>
      <div className="relative w-full h-screen bg-black overflow-hidden select-none">
        <HUD />
        <Canvas
          dpr={dpr}
          gl={{
            antialias: false,
            stencil: false,
            depth: true,
            powerPreference: 'high-performance',
            // Disable logarithmic depth buffer (expensive on mobile)
          }}
          camera={{ position: [0, 5.5, 8], fov: 60 }}
          frameloop="always"
        >
          <CameraController />
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>
    </ErrorBoundary>
  );
}
