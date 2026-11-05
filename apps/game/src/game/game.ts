import * as THREE from 'three';
import { createAudio } from './audio';
import {
  createBursts,
  createOrb,
  createPools,
  createTrail,
  type Entity,
} from './entities';
import { createInput } from './input';
import {
  applyScore,
  BOUNDS,
  hitsShard,
  hitsSphere,
  nextPattern,
  ORB_RADIUS,
  patternGap,
  rng,
  SPAWN_Z,
  speedAt,
  throughGate,
  type ScoreState,
} from './logic';
import { createPost } from './post';
import { PALETTE } from './shaders';
import { bakeEnvironment, createDust, createSky, createTerrain } from './world';

export type Phase = 'title' | 'playing' | 'over';

export interface GameEvents {
  onPhase(phase: Phase, score: ScoreState, best: number): void;
  onScore(score: ScoreState): void;
}

const ATTRACT_SPEED = 9;

export function createGame(canvas: HTMLCanvasElement, events: GameEvents) {
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  camera.position.set(0, 4, 8);

  const env = bakeEnvironment(renderer);
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(PALETTE.horizon, PALETTE.duneLow, 0.6));
  const sunLight = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sunLight.position.set(0, 3, -20);
  scene.add(sunLight);

  const sky = createSky();
  const terrain = createTerrain();
  const dust = createDust();
  const orb = createOrb();
  const trail = createTrail();
  const bursts = createBursts();
  scene.add(sky, terrain, dust.points, orb.mesh, trail.mesh, bursts.points);
  const { gates, motes, shards } = createPools(scene, env);

  const post = createPost(renderer, scene, camera);
  const input = createInput(canvas);
  const audio = createAudio();

  let phase: Phase = 'title';
  let best = 0;
  try {
    best = Number(localStorage.getItem('lumen:best') ?? 0) || 0;
  } catch {
    /* ignore */
  }
  let score: ScoreState = { score: 0, multiplier: 1, gates: 0 };
  let rand = rng(Date.now());
  let playTime = 0;
  let distance = 0;
  let nextPatternAt = 0;
  let combo = 0;
  let shake = 0;
  let danger = 0;
  let flash = 0;
  let speed = ATTRACT_SPEED;
  let paused = false;
  let crashTimer = 0;

  const orbPos = new THREE.Vector3(0, 2.6, 0);
  const orbVel = new THREE.Vector2();
  const lookAt = new THREE.Vector3();
  const timer = new THREE.Timer();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the corridor framed on portrait phones
    camera.fov = w < h ? 78 : 62;
    camera.updateProjectionMatrix();
    post.setSize(w, h, dpr);
    dust.material.uniforms.uPixelRatio.value = dpr;
    bursts.material.uniforms.uPixelRatio.value = dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  function clearWorld() {
    gates.clear();
    motes.clear();
    shards.clear();
  }

  function setPhase(p: Phase) {
    phase = p;
    events.onPhase(p, score, best);
  }

  function start() {
    audio.unlock();
    clearWorld();
    score = { score: 0, multiplier: 1, gates: 0 };
    rand = rng(Date.now());
    playTime = 0;
    nextPatternAt = distance + 12;
    combo = 0;
    danger = 0;
    crashTimer = 0;
    orbPos.set(0, 2.6, 0);
    input.target.x = 0;
    input.target.y = 2.6;
    trail.reset(orbPos);
    orb.mesh.visible = true;
    events.onScore(score);
    setPhase('playing');
  }

  function crash() {
    audio.crash();
    bursts.emit(orbPos, PALETTE.orbRimB, 120, 11);
    bursts.emit(orbPos, PALETTE.orbRimA, 80, 7);
    orb.mesh.visible = false;
    shake = reducedMotion ? 0 : 1;
    danger = 1;
    crashTimer = 1.1;
    if (score.score > best) {
      best = score.score;
      try {
        localStorage.setItem('lumen:best', String(best));
      } catch {
        /* ignore */
      }
    }
  }

  function spawnPattern() {
    for (const s of nextPattern(rand, playTime)) {
      const z = SPAWN_Z - s.dz;
      if (s.kind === 'gate') gates.spawn(s.x, s.y, z);
      else if (s.kind === 'mote') motes.spawn(s.x, s.y, z);
      else {
        const e = shards.spawn(s.x, s.y, z);
        if (e) {
          e.scale = 0.8 + Math.random() * 0.6;
          e.obj.scale.setScalar(e.scale);
          e.obj.rotation.set(
            Math.random() * 0.4,
            Math.random() * Math.PI,
            Math.random() * 0.4,
          );
        }
      }
    }
  }

  function step(dt: number, t: number) {
    const playing = phase === 'playing' && crashTimer <= 0;
    if (phase === 'playing') playTime += dt;
    const targetSpeed = playing
      ? speedAt(playTime)
      : phase === 'over' || crashTimer > 0
        ? 4
        : ATTRACT_SPEED;
    speed += (targetSpeed - speed) * Math.min(1, dt * 1.5);
    const dz = speed * dt;
    distance += dz;

    // steering
    if (playing) input.update(dt);
    else {
      // attract mode: lazy figure-eight
      input.target.x = Math.sin(t * 0.35) * 3.2;
      input.target.y = 2.6 + Math.sin(t * 0.7) * 1.1;
    }
    const prevX = orbPos.x;
    const prevY = orbPos.y;
    const ease = 1 - Math.exp(-dt * (playing ? 7 : 2.5));
    orbPos.x += (input.target.x - orbPos.x) * ease;
    orbPos.y += (input.target.y - orbPos.y) * ease;
    orbPos.x = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, orbPos.x));
    orbPos.y = Math.max(BOUNDS.yMin, Math.min(BOUNDS.yMax, orbPos.y));
    orbVel.set(
      (orbPos.x - prevX) / Math.max(dt, 1e-4),
      (orbPos.y - prevY) / Math.max(dt, 1e-4),
    );
    orb.mesh.position.copy(orbPos);
    orb.mesh.rotation.x -= dz * 0.6;
    orb.mesh.rotation.z = -orbVel.x * 0.03;

    // spawning
    if (playing && distance >= nextPatternAt) {
      spawnPattern();
      nextPatternAt = distance + patternGap(speed);
    }

    // move & collide
    const advance = (e: Entity) => {
      const prevZ = e.z;
      e.z += dz;
      e.obj.position.z = e.z;
      return prevZ;
    };

    for (const g of gates.items) {
      if (!g.active) continue;
      const prevZ = advance(g);
      g.obj.rotation.z = t * 0.4 + g.seed * 6;
      if (g.fade > 0) {
        g.fade += dt * 2.2;
        const s = 1 + g.fade * 0.8;
        g.obj.scale.setScalar(s);
        g.obj.children.forEach(
          (c) =>
            (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
              Math.max(0, 1 - g.fade)),
        );
      } else if (playing && prevZ < 0 && g.z >= 0) {
        if (throughGate(orbPos.x, orbPos.y, g.x, g.y)) {
          score = applyScore(score, 'gate');
          audio.gate(score.multiplier);
          bursts.emit(new THREE.Vector3(g.x, g.y, 0), PALETTE.gate, 60, 5);
          flash = 1;
          g.fade = 0.001;
        } else {
          if (score.multiplier > 1) audio.miss();
          score = applyScore(score, 'miss');
        }
        events.onScore(score);
      }
      if (g.z > 12 || g.fade >= 1) {
        g.obj.children.forEach(
          (c) =>
            (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
              1),
        );
        gates.release(g);
      }
    }

    for (const m of motes.items) {
      if (!m.active) continue;
      advance(m);
      m.obj.position.y = m.y + Math.sin(t * 3 + m.seed * 10) * 0.12;
      m.obj.rotation.set(t * 1.3 + m.seed, t * 1.7, 0);
      if (
        playing &&
        hitsSphere(
          orbPos.x,
          orbPos.y,
          0,
          m.x,
          m.obj.position.y,
          m.z,
          ORB_RADIUS + 0.45,
        )
      ) {
        score = applyScore(score, 'mote');
        audio.mote(combo++);
        bursts.emit(m.obj.position, PALETTE.mote, 22, 4);
        events.onScore(score);
        motes.release(m);
        continue;
      }
      if (m.z > 12) motes.release(m);
    }

    for (const s of shards.items) {
      if (!s.active) continue;
      advance(s);
      s.obj.rotation.y += dt * (0.4 + s.seed);
      if (
        playing &&
        Math.abs(s.z) < 2 &&
        hitsShard(orbPos.x, orbPos.y, 0, s.x, s.y, s.z, s.scale)
      ) {
        crash();
      }
      if (s.z > 12) shards.release(s);
    }

    if (crashTimer > 0) {
      crashTimer -= dt;
      if (crashTimer <= 0) setPhase('over');
    }

    // world
    trail.mesh.visible = orb.mesh.visible;
    trail.update(orbPos, dz);
    dust.update(dz);
    bursts.update(dt, dz);
    const tu = (terrain.material as THREE.ShaderMaterial).uniforms;
    tu.uScroll.value = distance;
    tu.uOrb.value.copy(orbPos);
    (sky.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    dust.material.uniforms.uTime.value = t;
    orb.material.uniforms.uTime.value = t;
    flash = Math.max(0, flash - dt * 3);
    orb.material.uniforms.uFlash.value = flash;

    // camera: chase, bank into turns, widen FOV with speed
    shake = Math.max(0, shake - dt * 1.6);
    danger = Math.max(0, danger - dt * 0.6);
    const sx = (Math.random() - 0.5) * shake * 0.6;
    const sy = (Math.random() - 0.5) * shake * 0.6;
    const camEase = 1 - Math.exp(-dt * 4);
    camera.position.x += (orbPos.x * 0.55 + sx - camera.position.x) * camEase;
    camera.position.y +=
      (orbPos.y * 0.6 + 1.9 + sy - camera.position.y) * camEase;
    camera.position.z = 7.5;
    lookAt.set(orbPos.x * 0.7, orbPos.y * 0.75 + 0.3, -12);
    camera.lookAt(lookAt);
    if (!reducedMotion) camera.rotation.z += -orbVel.x * 0.012;
    const baseFov = window.innerWidth < window.innerHeight ? 78 : 62;
    camera.fov += (baseFov + (speed - 15) * 0.35 - camera.fov) * camEase;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);

    post.finish.uniforms.uTime.value = t;
    post.finish.uniforms.uDanger.value = danger;
    post.bloom.strength = 0.55 + flash * 0.5 + danger * 0.4;
  }

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 1 / 20);
    if (!paused) step(dt, timer.getElapsed());
    post.composer.render();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (paused) audio.suspend();
    else {
      timer.update();
      audio.resume();
    }
  });

  setPhase('title');
  requestAnimationFrame(frame);

  if (new URLSearchParams(location.search).has('debug')) {
    Object.assign(window, {
      __lumen: () => ({
        phase,
        speed,
        distance,
        playTime,
        gates: gates.items.filter((e) => e.active).length,
        motes: motes.items.filter((e) => e.active).length,
        shards: shards.items.filter((e) => e.active).length,
      }),
    });
  }

  return {
    start,
    get phase() {
      return phase;
    },
    toggleMute: () => audio.toggleMute(),
    get muted() {
      return audio.muted;
    },
  };
}
