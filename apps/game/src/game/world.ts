import * as THREE from 'three';
import { NOISE, PALETTE, SUN_DIR } from './shaders';

const sunDir = new THREE.Vector3(...SUN_DIR).normalize();
const col = (hex: string) => new THREE.Color(hex);

function skyMaterial(starIntensity: number) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: sunDir },
      uStars: { value: starIntensity },
      uZenith: { value: col(PALETTE.zenith) },
      uHigh: { value: col(PALETTE.high) },
      uFog: { value: col(PALETTE.fog) },
      uHorizon: { value: col(PALETTE.horizon) },
      uSunCol: { value: col(PALETTE.sun) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSun; uniform float uStars;
      uniform vec3 uZenith; uniform vec3 uHigh; uniform vec3 uFog; uniform vec3 uHorizon; uniform vec3 uSunCol;
      varying vec3 vDir;
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        float s = max(dot(d, uSun), 0.0);
        // warm band hugging the horizon, strongest toward the sun
        vec3 horizon = mix(uFog, uHorizon, pow(s, 3.0) * 0.85 + 0.15);
        vec3 c = mix(horizon, uHigh, smoothstep(0.0, 0.32, y));
        c = mix(c, uZenith, smoothstep(0.3, 0.95, y));
        if (y < 0.0) c = mix(horizon, uFog, smoothstep(0.0, -0.08, y));
        // sun: disc + layered glow (HDR so it blooms)
        c += uSunCol * smoothstep(0.9992, 0.9997, s) * 6.0;
        c += uSunCol * pow(s, 180.0) * 1.4 + uHorizon * pow(s, 10.0) * 0.35;
        // stars
        vec3 cell = floor(d * 260.0);
        float st = step(0.9975, h3(cell)) * smoothstep(0.12, 0.5, y);
        st *= 0.6 + 0.4 * sin(uTime * 2.0 + h3(cell + 3.0) * 40.0);
        c += vec3(st) * uStars * 1.6;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
}

/** Environment map baked from the sky, so metallic shards reflect the sunset. */
export function bakeEnvironment(renderer: THREE.WebGLRenderer) {
  const envScene = new THREE.Scene();
  envScene.add(
    new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), skyMaterial(0)),
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  return target.texture;
}

export function createSky() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(400, 48, 24),
    skyMaterial(1),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

export function createTerrain() {
  const geo = new THREE.PlaneGeometry(260, 360, 200, 260);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -150);
  const mat = new THREE.ShaderMaterial({
    extensions: { derivatives: true } as never,
    uniforms: {
      uScroll: { value: 0 },
      uTime: { value: 0 },
      uOrb: { value: new THREE.Vector3() },
      uSun: { value: sunDir },
      uLow: { value: col(PALETTE.duneLow) },
      uHigh: { value: col(PALETTE.duneHigh) },
      uLine: { value: col(PALETTE.contour) },
      uFog: { value: col(PALETTE.fog) },
      uHorizon: { value: col(PALETTE.horizon) },
      uOrbCol: { value: col(PALETTE.orbRimA) },
    },
    vertexShader: /* glsl */ `
      uniform float uScroll;
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vDepth;
      ${NOISE}
      float height(vec2 p) {
        vec2 q = vec2(p.x, p.y - uScroll);
        float dunes = fbm(q * 0.035) * 9.0 + fbm(q * 0.11 + 4.0) * 1.6;
        // carve a flight valley down the middle
        float valley = smoothstep(5.0, 30.0, abs(p.x));
        return dunes * (0.12 + valley) - 2.2;
      }
      void main() {
        vec3 p = position;
        float h = height(p.xz);
        float e = 0.6;
        vec3 n = normalize(vec3(height(p.xz - vec2(e, 0.0)) - height(p.xz + vec2(e, 0.0)), 2.0 * e,
                                height(p.xz - vec2(0.0, e)) - height(p.xz + vec2(0.0, e))));
        p.y = h;
        vH = h; vNormal = n;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vec4 mv = viewMatrix * world;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uOrb; uniform vec3 uSun;
      uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uLine; uniform vec3 uFog; uniform vec3 uHorizon; uniform vec3 uOrbCol;
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vDepth;
      void main() {
        vec3 n = normalize(vNormal);
        float k = clamp((vH + 2.2) / 8.0, 0.0, 1.0);
        vec3 base = mix(uLow, uHigh, pow(k, 1.4));
        // backlit sun: slopes facing the camera stay dark, crests catch a warm rim
        float facingSun = clamp(dot(n, normalize(vec3(uSun.x, 0.0, uSun.z))) * 0.5 + 0.5, 0.0, 1.0);
        float rim = pow(clamp(1.0 - n.y, 0.0, 1.0), 1.5) * facingSun;
        vec3 c = base * (0.3 + 0.5 * n.y) + uHorizon * rim * 0.4;
        // luminous contour lines, anti-aliased with derivatives
        float lv = vH * 1.6;
        float w = fwidth(lv);
        float dist = abs(fract(lv - 0.5) - 0.5);
        float line = 1.0 - smoothstep(0.0, w * 1.5, dist);
        float near = exp(-vDepth * 0.012);
        c += uLine * line * (0.25 + 1.1 * k) * near;
        // orb light pool
        float d = distance(vWorld.xz, uOrb.xz);
        c += uOrbCol * exp(-d * d / 3.5) * 0.28 * exp(-max(uOrb.y - vH, 0.0) * 0.35);
        // fog toward the horizon colour
        float f = 1.0 - exp(-pow(vDepth * 0.0085, 1.7));
        vec3 fogC = mix(uFog, uHorizon, 0.18);
        gl_FragColor = vec4(mix(c, fogC, clamp(f, 0.0, 1.0)), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** Floating dust motes that stream past to sell the speed. */
export function createDust(count = 1800) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = -1 + Math.random() * 18;
    pos[i * 3 + 2] = -160 + Math.random() * 175;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uA: { value: col(PALETTE.horizon) },
      uB: { value: col(PALETTE.orbRimA) },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uPixelRatio; varying float vSeed; varying float vFade;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.6 + aSeed * 30.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSeed * 3.0) * uPixelRatio * (12.0 / -mv.z);
        vSeed = aSeed;
        vFade = smoothstep(150.0, 40.0, -mv.z) * smoothstep(0.5, 4.0, -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; varying float vSeed; varying float vFade;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(mix(uA, uB, step(0.7, vSeed)) * 1.4, a * vFade * 0.7);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    material: mat,
    update(dz: number) {
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 2] += dz * (0.6 + seed[i] * 0.6);
        if (pos[i * 3 + 2] > 15) pos[i * 3 + 2] -= 175;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
