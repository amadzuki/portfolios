'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { glyphGrid } from '../lib/glyph';
import { useReducedMotion } from '../lib/hooks';
import type { ExperimentProps } from '../lib/types';

const COLS = 36;
const ROWS = 36;

function Blocks({
  glyph,
  palette,
  fontFamily,
  frozen,
}: ExperimentProps & { frozen: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();

  const cells = useMemo(() => {
    const grid = glyphGrid(glyph, COLS, ROWS, { fontFamily, resolution: 256 });
    const out: Array<{ x: number; y: number; seed: number }> = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (grid[y * COLS + x] > 0.5)
          out.push({
            x: x - COLS / 2 + 0.5,
            y: ROWS / 2 - y - 0.5,
            seed: Math.random(),
          });
    return out;
  }, [glyph, fontFamily]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c0 = new THREE.Color(palette.colors[0]);
    const c1 = new THREE.Color(palette.colors[1]);
    const c2 = new THREE.Color(palette.colors[2]);
    const tmp = new THREE.Color();
    cells.forEach((c, i) => {
      const t = (c.x / COLS + 0.5) * 0.7 + c.seed * 0.3;
      tmp
        .copy(t < 0.5 ? c0 : c1)
        .lerp(t < 0.5 ? c1 : c2, t < 0.5 ? t * 2 : t * 2 - 1);
      m.setColorAt(i, tmp);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cells, palette]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scale = Math.min(viewport.width, viewport.height) / (COLS * 1.25);

  useFrame((state) => {
    const m = mesh.current;
    const g = group.current;
    if (!m || !g) return;
    const t = frozen ? 0 : state.clock.elapsedTime;
    const px = (state.pointer.x * viewport.width) / 2 / scale;
    const py = (state.pointer.y * viewport.height) / 2 / scale;
    cells.forEach((c, i) => {
      const dist = Math.hypot(c.x - px, c.y - py);
      const lift = Math.max(0, 1 - dist / 8) * 6;
      const wave = Math.sin(t * 1.8 + c.x * 0.35 + c.y * 0.25) * 1.2;
      const z = frozen ? 0 : wave + lift;
      dummy.position.set(c.x, c.y, z / 2);
      dummy.scale.set(0.92, 0.92, 1 + Math.max(0, z));
      dummy.rotation.z = frozen ? 0 : lift * 0.05 * (c.seed - 0.5);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (!frozen) {
      g.rotation.y += (state.pointer.x * 0.5 - g.rotation.y) * 0.05;
      g.rotation.x += (-state.pointer.y * 0.4 - 0.25 - g.rotation.x) * 0.05;
    }
  });

  return (
    <group ref={group} scale={scale}>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, cells.length]}
        key={cells.length + glyph}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.2} />
      </instancedMesh>
    </group>
  );
}

/** Glyph extruded into instanced voxels that ripple and lift toward the cursor. */
export default function Voxels(props: ExperimentProps) {
  const frozen = useReducedMotion();
  return (
    <div
      className={props.className}
      style={{ background: props.palette.background, touchAction: 'none' }}
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 45 }}>
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[4, 5, 6]}
          intensity={1.6}
          color={props.palette.colors[2]}
        />
        <directionalLight
          position={[-5, -3, 4]}
          intensity={1.1}
          color={props.palette.colors[0]}
        />
        <pointLight
          position={[0, 0, 4]}
          intensity={8}
          distance={12}
          color="#ffffff"
        />
        <Blocks {...props} frozen={frozen} />
      </Canvas>
    </div>
  );
}
