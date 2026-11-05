'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '../lib/hooks';
import type { ExperimentProps } from '../lib/types';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uGlyph;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform vec3 uC0;
  uniform vec3 uC1;
  uniform vec3 uC2;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / uRes.y;
    // glitch: shift horizontal bands now and then
    float band = floor(uv.y * 24.0);
    float glitch = step(0.93, hash(vec2(band, floor(uTime * 6.0)))) * (hash(vec2(band, uTime)) - 0.5) * 0.06;
    uv.x += glitch;

    // pixel size grows near the cursor
    vec2 m = uMouse;
    float md = distance(vec2(uv.x * aspect, uv.y), vec2(m.x * aspect, m.y));
    float cell = mix(90.0, 22.0, smoothstep(0.45, 0.0, md));
    vec2 grid = vec2(cell * aspect, cell);
    vec2 cuv = (floor(uv * grid) + 0.5) / grid;

    float mask = texture2D(uGlyph, cuv).r;
    // soft glow: a few taps around the cell
    float glow = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785;
      glow += texture2D(uGlyph, cuv + vec2(cos(a), sin(a)) * 0.025).r;
    }
    glow /= 8.0;

    float n = fbm(cuv * vec2(aspect, 1.0) * 3.0 + vec2(uTime * 0.15, -uTime * 0.1));
    float spark = step(0.985, hash(cuv * 91.0 + floor(uTime * 8.0)));
    vec3 col = n < 0.5 ? mix(uC0, uC1, n * 2.0) : mix(uC1, uC2, n * 2.0 - 1.0);
    col *= 0.6 + 0.8 * hash(cuv * 17.0 + floor(uTime * 2.0));
    vec3 outCol = col * mask + spark * mask + col * glow * 0.35;
    // scanlines
    outCol *= 0.9 + 0.1 * sin(vUv.y * uRes.y * 1.5);
    gl_FragColor = vec4(outCol, 1.0);
  }
`;

function Plane({
  glyph,
  palette,
  fontFamily,
  frozen,
}: ExperimentProps & { frozen: boolean }) {
  const { size, pointer } = useThree();

  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    const h = 512;
    c.height = h;
    c.width = Math.round(h * (size.width / Math.max(1, size.height)));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${h * 0.7}px ${fontFamily ?? 'system-ui, sans-serif'}`;
    ctx.fillText(glyph, c.width / 2, h / 2 + h * 0.03);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [glyph, fontFamily, size.width, size.height]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uGlyph: { value: null },
          uRes: { value: new THREE.Vector2() },
          uMouse: { value: new THREE.Vector2(-1, -1) },
          uTime: { value: 0 },
          uC0: { value: new THREE.Color(palette.colors[0]) },
          uC1: { value: new THREE.Color(palette.colors[1]) },
          uC2: { value: new THREE.Color(palette.colors[2]) },
        },
      }),
    [palette],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => texture.dispose(), [texture]);

  material.uniforms.uGlyph.value = texture;
  material.uniforms.uRes.value.set(size.width, size.height);

  useFrame((state) => {
    if (!frozen) material.uniforms.uTime.value = state.clock.elapsedTime;
    const target = new THREE.Vector2(
      pointer.x * 0.5 + 0.5,
      pointer.y * 0.5 + 0.5,
    );
    material.uniforms.uMouse.value.lerp(target, 0.15);
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Fragment shader: pixelated, glitching glyph whose resolution sharpens under the cursor. */
export default function PixelShader(props: ExperimentProps) {
  const frozen = useReducedMotion();
  return (
    <div
      className={props.className}
      style={{ background: props.palette.background, touchAction: 'none' }}
    >
      <Canvas dpr={[1, 2]} gl={{ antialias: false }}>
        <Plane {...props} frozen={frozen} />
      </Canvas>
    </div>
  );
}
