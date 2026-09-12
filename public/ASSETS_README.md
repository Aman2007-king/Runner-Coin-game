# Dropping in real art assets (textures + character model)

Everything in the game right now is procedural: geometry built from primitives
(boxes/cones/cylinders) and colors, plus a couple of textures drawn on the fly
with the 2D Canvas API. That's why it looks stylized/low-poly rather than
photoreal like Temple Run — there are no image or 3D-model files in the
project at all yet.

This folder structure plus the `ASSET_CONFIG` flags in `types.ts` let you drop
in real files and the game will use them automatically once you flip the
matching flag to `true` and rebuild. No files here yet = nothing to load yet.

## 1. Ground / path textures → `/public/textures/`

Free, commercial-use-OK (CC0) sources:
- **Poly Haven** (https://polyhaven.com/textures) — search "cobblestone",
  "brick floor", "bark", "moss". Download the 1K or 2K JPG.
- **ambientCG** (https://ambientcg.com) — same idea, huge CC0 texture library.

Files to add (exact names, JPG or PNG):
```
/public/textures/path_diffuse.jpg   ← the color/albedo map for the ground
/public/textures/path_normal.jpg    ← optional, adds surface bump detail
/public/textures/bark_diffuse.jpg   ← optional, used on tree trunks/pillars
```

Then in `types.ts` set:
```ts
export const ASSET_CONFIG = {
  useRealGroundTextures: true,   // ← flip this
  useRealCharacterModel: false,
};
```

## 2. Character model → `/public/models/runner.glb`

This needs an actual rigged, animated 3D model — that's not something that
can be generated from code. Two realistic free routes:

- **Mixamo** (https://www.mixamo.com, free with an Adobe account): pick a
  character, apply a "Running" animation, download as FBX. FBX isn't usable
  directly in a browser Three.js app — convert it to `.glb` first, either:
  - In Blender (free): File → Import → FBX, then File → Export → glTF 2.0 (.glb)
  - Or an online FBX→GLB converter (e.g. products.aspose.app/3d/conversion/fbx-to-glb)
- **Sketchfab** (https://sketchfab.com, filter by "Downloadable" + CC license):
  many rigged, animated low-poly characters are already in `.glb`/`.gltf`
  format, no conversion needed. Check the license on whatever you pick.

Put the exported file at:
```
/public/models/runner.glb
```

Then in `types.ts` set:
```ts
export const ASSET_CONFIG = {
  useRealGroundTextures: true,
  useRealCharacterModel: true,   // ← flip this
};
```

The game looks for an animation clip named something like `Run`, `Running`,
or `run` inside the file (standard Mixamo naming) and plays it on loop. If it
can't find a matching clip, or the file is missing/fails to load, it falls
back to the current primitive stick-figure automatically — it will never
crash the game, just silently fall back.

## Why I (Claude) can't just make these for you

I can write the code that loads and uses real texture/model files, and I did
— that part's done. But I have no tool that outputs a photographic texture
image or a sculpted, rigged 3D character file; those are art assets, not
code. The links above are real, currently-free sources for exactly that kind
of asset.
