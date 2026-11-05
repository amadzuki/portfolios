import * as THREE from 'three';
import { GATE_RADIUS, ORB_RADIUS } from './logic';
import { PALETTE } from './shaders';

const col = (hex: string, boost = 1) =>
  new THREE.Color(hex).multiplyScalar(boost);

/** Iridescent orb: fresnel rim that shifts hue, swirling hot core, and a light that touches nearby shards. */
export function createOrb() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: col(PALETTE.orbCore, 1.7) },
      uA: { value: col(PALETTE.orbRimA, 1.8) },
      uB: { value: col(PALETTE.orbRimB, 1.8) },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCore; uniform vec3 uA; uniform vec3 uB; uniform float uFlash;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.2);
        float swirl = sin(vP.x * 9.0 + uTime * 3.0) * sin(vP.y * 7.0 - uTime * 2.3) * sin(vP.z * 8.0 + uTime * 1.7);
        vec3 rim = mix(uA, uB, 0.5 + 0.5 * sin(uTime * 0.8 + vP.y * 4.0));
        vec3 c = mix(uCore * (0.75 + 0.25 * swirl), rim, f);
        c += vec3(uFlash * 3.0);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(ORB_RADIUS, 5),
    mat,
  );

  // faint outer halo shell
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(ORB_RADIUS * 1.6, 32, 16),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: col(PALETTE.orbRimA, 0.8) } },
      vertexShader: /* glsl */ `varying float vF; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vec3 n = normalize(normalMatrix*normal); vF = pow(max(dot(n, normalize(-mv.xyz)),0.0), 3.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uC; varying float vF; void main(){ gl_FragColor = vec4(uC, vF * 0.3); }`,
    }),
  );
  mesh.add(halo);
  const light = new THREE.PointLight(PALETTE.orbRimA, 40, 14, 2);
  mesh.add(light);
  return { mesh, material: mat };
}

/**
 * Crossed ribbons following the orb's recent path. History is sampled at a fixed
 * spacing in world units, so the trail length is independent of frame rate.
 */
export function createTrail(length = 34, spacing = 0.11) {
  const history = Array.from({ length }, () => new THREE.Vector3(0, 2, 0));
  const verts = new Float32Array(length * 4 * 3);
  const t = new Float32Array(length * 4);
  const index: number[] = [];
  for (let i = 0; i < length; i++) {
    for (let k = 0; k < 4; k++) t[i * 4 + k] = i / (length - 1);
    if (i < length - 1) {
      const a = i * 4;
      const b = (i + 1) * 4;
      index.push(a, b, a + 1, a + 1, b, b + 1); // horizontal ribbon
      index.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3); // vertical ribbon
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  geo.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uA: { value: col(PALETTE.orbRimA, 1.6) },
      uB: { value: col(PALETTE.orbRimB, 1.4) },
    },
    vertexShader: /* glsl */ `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uA; uniform vec3 uB; varying float vT; void main(){ gl_FragColor = vec4(mix(uA, uB, vT), pow(1.0 - vT, 2.2) * 0.8); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  let carry = 0;

  return {
    mesh,
    reset(p: THREE.Vector3) {
      history.forEach((h) => h.copy(p));
    },
    update(head: THREE.Vector3, dz: number) {
      // advance the sampled path by however many spacing steps the world moved
      carry += dz;
      while (carry >= spacing) {
        carry -= spacing;
        for (let i = length - 1; i > 0; i--) history[i].copy(history[i - 1]);
        history[0].copy(head);
      }
      history[0].copy(head);
      for (let i = 1; i < length; i++)
        history[i].z = head.z + (i - 1) * spacing + carry;
      for (let i = 0; i < length; i++) {
        const p = history[i];
        const w = ORB_RADIUS * 0.85 * (1 - i / length);
        const o = i * 12;
        verts.set(
          [
            p.x - w,
            p.y,
            p.z,
            p.x + w,
            p.y,
            p.z,
            p.x,
            p.y - w,
            p.z,
            p.x,
            p.y + w,
            p.z,
          ],
          o,
        );
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export interface Entity {
  obj: THREE.Object3D;
  active: boolean;
  x: number;
  y: number;
  z: number;
  /** animation phase / random seed */
  seed: number;
  /** used by gates to fade out after being passed */
  fade: number;
  scale: number;
}

function pool(make: () => THREE.Object3D, size: number, scene: THREE.Scene) {
  const items: Entity[] = Array.from({ length: size }, () => {
    const obj = make();
    obj.visible = false;
    scene.add(obj);
    return { obj, active: false, x: 0, y: 0, z: 0, seed: 0, fade: 0, scale: 1 };
  });
  return {
    items,
    spawn(x: number, y: number, z: number) {
      const e = items.find((i) => !i.active);
      if (!e) return null;
      Object.assign(e, {
        active: true,
        x,
        y,
        z,
        seed: Math.random(),
        fade: 0,
        scale: 1,
      });
      e.obj.visible = true;
      e.obj.position.set(x, y, z);
      e.obj.scale.setScalar(1);
      return e;
    },
    release(e: Entity) {
      e.active = false;
      e.obj.visible = false;
    },
    clear() {
      items.forEach((e) => this.release(e));
    },
  };
}

export function createPools(scene: THREE.Scene, env: THREE.Texture) {
  const gateGeo = new THREE.TorusGeometry(GATE_RADIUS, 0.055, 16, 120);
  const gateInnerGeo = new THREE.TorusGeometry(
    GATE_RADIUS * 0.86,
    0.012,
    8,
    120,
  );
  const gates = pool(
    () => {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: col(PALETTE.gate, 3.2),
        transparent: true,
      });
      const inner = new THREE.MeshBasicMaterial({
        color: col(PALETTE.orbRimB, 2.2),
        transparent: true,
      });
      g.add(new THREE.Mesh(gateGeo, mat), new THREE.Mesh(gateInnerGeo, inner));
      return g;
    },
    12,
    scene,
  );

  const moteGeo = new THREE.IcosahedronGeometry(0.17, 1);
  const moteRing = new THREE.TorusGeometry(0.34, 0.01, 6, 48);
  const moteMat = new THREE.MeshBasicMaterial({ color: col(PALETTE.mote, 3) });
  const moteRingMat = new THREE.MeshBasicMaterial({
    color: col(PALETTE.mote, 1.4),
    transparent: true,
    opacity: 0.7,
  });
  const motes = pool(
    () => {
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(moteGeo, moteMat),
        new THREE.Mesh(moteRing, moteRingMat),
      );
      return g;
    },
    80,
    scene,
  );

  const shardGeo = new THREE.OctahedronGeometry(0.75, 0);
  shardGeo.scale(0.75, 1.65, 0.75);
  const shardMat = new THREE.MeshPhysicalMaterial({
    color: '#1a1030',
    metalness: 0.85,
    roughness: 0.12,
    iridescence: 1,
    iridescenceIOR: 1.7,
    iridescenceThicknessMinimum: 200,
    iridescenceThicknessMaximum: 900,
    clearcoat: 1,
    envMap: env,
    envMapIntensity: 1.6,
    flatShading: true,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: col(PALETTE.orbRimB, 1.6),
    transparent: true,
    opacity: 0.55,
  });
  const edges = new THREE.EdgesGeometry(shardGeo);
  const shards = pool(
    () => {
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(shardGeo, shardMat),
        new THREE.LineSegments(edges, edgeMat),
      );
      return g;
    },
    60,
    scene,
  );

  return { gates, motes, shards };
}

/** Pooled spark bursts for pickups and crashes. */
export function createBursts(capacity = 900) {
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const color = new Float32Array(capacity * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `attribute float aLife; attribute vec3 aColor; uniform float uPixelRatio; varying float vL; varying vec3 vC;
      void main(){ vL = aLife; vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = aLife * 9.0 * uPixelRatio * (8.0 / -mv.z); }`,
    fragmentShader: /* glsl */ `varying float vL; varying vec3 vC; void main(){ float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5)); gl_FragColor = vec4(vC * 2.5, a * vL); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let cursor = 0;
  const tmp = new THREE.Color();
  return {
    points,
    material: mat,
    emit(at: THREE.Vector3, hex: string, n = 28, power = 6) {
      tmp.set(hex);
      for (let k = 0; k < n; k++) {
        const i = cursor;
        cursor = (cursor + 1) % capacity;
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        const s = power * (0.4 + Math.random() * 0.8);
        pos.set([at.x, at.y, at.z], i * 3);
        vel.set([r * Math.cos(th) * s, u * s, r * Math.sin(th) * s], i * 3);
        color.set([tmp.r, tmp.g, tmp.b], i * 3);
        life[i] = 1;
      }
    },
    update(dt: number, dz: number) {
      for (let i = 0; i < capacity; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt * 1.4);
        const o = i * 3;
        vel[o] *= 0.96;
        vel[o + 1] = vel[o + 1] * 0.96 - dt * 2;
        vel[o + 2] *= 0.96;
        pos[o] += vel[o] * dt;
        pos[o + 1] += vel[o + 1] * dt;
        pos[o + 2] += vel[o + 2] * dt + dz;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
    },
  };
}
