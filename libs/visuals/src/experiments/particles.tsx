'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sampleGlyphPoints } from '../lib/glyph';
import { useReducedMotion } from '../lib/hooks';
import type { ExperimentProps } from '../lib/types';

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSpeed;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uSpan;
  varying float vMix;
  varying float vSpeed;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (1.0 + aSpeed * 3.0);
    vMix = clamp(position.x / uSpan * 0.5 + 0.5 + (aSeed - 0.5) * 0.3, 0.0, 1.0);
    vSpeed = aSpeed;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  varying float vMix;
  varying float vSpeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = vMix < 0.5 ? mix(uC0, uC1, vMix * 2.0) : mix(uC1, uC2, vMix * 2.0 - 1.0);
    col = col * 1.35 + 0.06 + vSpeed * 1.5;
    gl_FragColor = vec4(col, a);
  }
`;

function Swarm({
  glyph,
  palette,
  fontFamily,
  count,
  pointSize,
  frozen,
}: ExperimentProps & { count: number; pointSize?: number; frozen: boolean }) {
  const { viewport, gl } = useThree();
  const geom = useRef<THREE.BufferGeometry>(null);

  const sim = useMemo(() => {
    const { points, aspect } = sampleGlyphPoints(glyph, count, {
      fontFamily,
      resolution: 320,
    });
    const n = points.length / 2;
    const pos = new Float32Array(n * 3);
    const target = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      target[i * 3] = points[i * 2];
      target[i * 3 + 1] = points[i * 2 + 1];
      target[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
      // start scattered on a sphere so the glyph assembles on load
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = frozen ? 0 : 3 + Math.random() * 2;
      pos[i * 3] = frozen ? target[i * 3] : r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = frozen
        ? target[i * 3 + 1]
        : r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = frozen ? target[i * 3 + 2] : r * Math.cos(ph);
      seed[i] = Math.random();
    }
    return { n, pos, target, vel, seed, speed, aspect };
  }, [glyph, fontFamily, count, frozen]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uSize: { value: 3 },
          uPixelRatio: { value: Math.min(2, gl.getPixelRatio()) },
          uSpan: { value: sim.aspect },
          uC0: { value: new THREE.Color(palette.colors[0]) },
          uC1: { value: new THREE.Color(palette.colors[1]) },
          uC2: { value: new THREE.Color(palette.colors[2]) },
        },
      }),
    [gl, sim.aspect, palette],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Fit glyph into the viewport.
  const scale = Math.min(
    (viewport.height * 0.72) / 2,
    (viewport.width * 0.88) / (2 * sim.aspect),
  );
  material.uniforms.uSize.value =
    pointSize ?? Math.max(2, Math.min(4, scale * 1.4));

  useFrame((state, delta) => {
    if (frozen) return;
    const { pos, target, vel, speed, n, seed } = sim;
    const dt = Math.min(delta, 1 / 30) * 60;
    const px = (state.pointer.x * viewport.width) / 2 / scale;
    const py = (state.pointer.y * viewport.height) / 2 / scale;
    const t = state.clock.elapsedTime;
    const radius = 0.35;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      let fx = (target[ix] - pos[ix]) * 0.02;
      let fy = (target[ix + 1] - pos[ix + 1]) * 0.02;
      let fz = (target[ix + 2] - pos[ix + 2]) * 0.02;
      const dx = pos[ix] - px;
      const dy = pos[ix + 1] - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2) + 1e-4;
        const f = (1 - d / radius) * 0.06;
        fx += (dx / d) * f;
        fy += (dy / d) * f;
        fz += f * (seed[i] - 0.5) * 2;
      }
      // idle shimmer
      fz += Math.sin(t * 1.5 + seed[i] * 40) * 0.0004;
      vel[ix] = (vel[ix] + fx * dt) * 0.9;
      vel[ix + 1] = (vel[ix + 1] + fy * dt) * 0.9;
      vel[ix + 2] = (vel[ix + 2] + fz * dt) * 0.9;
      pos[ix] += vel[ix] * dt;
      pos[ix + 1] += vel[ix + 1] * dt;
      pos[ix + 2] += vel[ix + 2] * dt;
      speed[i] = Math.min(
        1,
        Math.hypot(vel[ix], vel[ix + 1], vel[ix + 2]) * 12,
      );
    }
    const g = geom.current;
    if (g) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aSpeed.needsUpdate = true;
    }
  });

  return (
    <points scale={scale} material={material}>
      <bufferGeometry ref={geom} key={sim.n + glyph}>
        <bufferAttribute attach="attributes-position" args={[sim.pos, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[sim.seed, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[sim.speed, 1]} />
      </bufferGeometry>
    </points>
  );
}

/** Glyph made of GPU-rendered particles that scatter around the cursor and spring back. */
export default function Particles(
  props: ExperimentProps & { count?: number; pointSize?: number },
) {
  const frozen = useReducedMotion();
  return (
    <div
      className={props.className}
      style={{ background: props.palette.background, touchAction: 'none' }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: false }}
      >
        <Swarm {...props} count={props.count ?? 7000} frozen={frozen} />
      </Canvas>
    </div>
  );
}
