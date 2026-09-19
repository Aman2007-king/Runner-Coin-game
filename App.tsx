/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './components/World/Environment';
import { Player } from './components/World/Player';
import { LevelManager } from './components/World/LevelManager';
import { Effects } from './components/World/Effects';
import { HUD } from './components/UI/HUD';
import { useStore } from './store';
import { GameStatus } from './types';
import { audio } from './components/System/Audio';
import ErrorBoundary from './components/System/ErrorBoundary';
import { IS_MOBILE } from './utils/device';



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
    <Effects />
  </>
);

export default function App() {
  const { status, togglePause } = useStore();

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

  // The 3D scene renders for both Phase 1 (runner) and Phase 3 (space shooter) —
  // Environment/Player/LevelManager each branch internally on gamePhase.
  // It's only skipped for the two full-screen HUD-only overlay statuses.
  const isAircraftShop    = (status as string) === 'AIRCRAFT_SHOP';
  const isSpaceTransition = (status as string) === 'SPACE_TRANSITION';
  const showScene         = !isAircraftShop && !isSpaceTransition;

  return (
    <ErrorBoundary>
      <div className="relative w-full h-screen bg-black overflow-hidden select-none">
        {/* HUD overlay on all screens (handles aircraft shop, transition, game over etc.) */}
        <HUD />

        {/* 3D scene — runner (levels 1-5) and space shooter (levels 6-10) */}
        {showScene && (
          <Canvas
            dpr={dpr}
            shadows={!IS_MOBILE ? 'soft' : false}
            gl={{ antialias: !IS_MOBILE, stencil: false, depth: true, powerPreference: 'high-performance' }}
            camera={{ position: [0, 5.5, 8], fov: 60 }}
            frameloop="always"
            style={{ position: 'absolute', inset: 0 }}
            onCreated={({ gl }) => {
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault(); // required — allows the browser to attempt automatic restoration
                // eslint-disable-next-line no-console
                console.error('[webgl] context lost — attempting automatic recovery');
              });
              canvas.addEventListener('webglcontextrestored', () => {
                // eslint-disable-next-line no-console
                console.warn('[webgl] context restored');
              });
            }}
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
