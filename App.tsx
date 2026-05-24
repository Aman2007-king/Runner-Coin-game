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
import { SpaceShooter } from './components/Space/SpaceShooter';
import { useStore } from './store';
import { GameStatus } from './types';
import { audio } from './components/System/Audio';
import ErrorBoundary from './components/System/ErrorBoundary';

const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

const CameraController: React.FC = () => {
  const { camera, size } = useThree();
  const { laneCount, screenShake, decayScreenShake } = useStore();
  const shakeOffset = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const isMobile = size.width / size.height < 1.2;
    const extra    = Math.max(0, laneCount - 3);
    const targetY  = 5.5 + extra * (isMobile ? 2.0 : 0.5);
    const targetZ  = 8.0 + extra * (isMobile ? 4.5 : 1.0);
    const dt       = Math.min(delta, 0.05);
    camera.position.lerp(new THREE.Vector3(0, targetY, targetZ), dt * 2.0);
    camera.lookAt(0, 0, -30);
    if (screenShake > 0) {
      const mag = screenShake * screenShake * 0.4;
      shakeOffset.current.set((Math.random()-.5)*mag, (Math.random()-.5)*mag, 0);
      camera.position.add(shakeOffset.current);
      decayScreenShake(delta);
    }
  });
  return null;
};

const RunnerScene: React.FC = () => (
  <>
    <Environment />
    <group name="PlayerGroup" userData={{ isPlayer: true }}>
      <Player />
    </group>
    <LevelManager />
  </>
);

export default function App() {
  const { status, gamePhase, togglePause } = useStore();

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

  const dpr: [number, number] = IS_MOBILE ? [1, 1] : [1, 1.5];

  // Which mode to render
  const isAircraftShop  = (status as string) === 'AIRCRAFT_SHOP';
  const isSpaceTransition = (status as string) === 'SPACE_TRANSITION';
  const isShooterPhase  = gamePhase === 3 && !isAircraftShop && !isSpaceTransition;
  const isRunnerPhase   = !isShooterPhase && !isAircraftShop && !isSpaceTransition;

  return (
    <ErrorBoundary>
      <div className="relative w-full h-screen bg-black overflow-hidden select-none">
        {/* Space shooter canvas — visible in phases 6-10 */}
        {isShooterPhase && <SpaceShooter />}

        {/* HUD overlay on all screens (handles aircraft shop, transition, game over etc.) */}
        <HUD />

        {/* Runner 3D scene — only during runner phase (levels 1-5) */}
        {isRunnerPhase && (
          <Canvas
            dpr={dpr}
            gl={{ antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' }}
            camera={{ position: [0, 5.5, 8], fov: 60 }}
            frameloop="always"
            style={{ position: 'absolute', inset: 0 }}
          >
            <CameraController />
            <Suspense fallback={null}>
              <RunnerScene />
            </Suspense>
          </Canvas>
        )}
      </div>
    </ErrorBoundary>
  );
}
