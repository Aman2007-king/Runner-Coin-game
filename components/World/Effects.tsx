/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { IS_MOBILE } from '../../utils/device';

export const Effects: React.FC = () => {
  return (
    <EffectComposer multisampling={0}>
      {/* Tighter bloom to avoid fog: High threshold, moderate radius.
          Cheaper on mobile: no mipmapBlur, fewer levels. */}
      <Bloom
        luminanceThreshold={0.75}
        mipmapBlur={!IS_MOBILE}
        intensity={IS_MOBILE ? 0.8 : 1.0}
        radius={0.6}
        levels={IS_MOBILE ? 4 : 8}
      />
      {/* Film grain is a full extra pass — skip it on weaker mobile GPUs */}
      {!IS_MOBILE && <Noise opacity={0.05} blendFunction={BlendFunction.OVERLAY} />}
      <Vignette eskil={false} offset={0.1} darkness={0.5} />
    </EffectComposer>
  );
};
