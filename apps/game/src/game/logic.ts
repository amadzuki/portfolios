/** Pure game rules: no three.js, no DOM. Unit-tested. */

export const BOUNDS = { x: 6, yMin: 0.9, yMax: 5.2 } as const;
export const ORB_RADIUS = 0.42;
export const GATE_RADIUS = 1.7;
export const SPAWN_Z = -150;
export const MAX_MULTIPLIER = 8;

/** Deterministic PRNG (mulberry32) so runs are reproducible from a seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Forward speed in units/s, ramping with elapsed play time. */
export const speedAt = (t: number) => Math.min(42, 15 + t * 0.32);

/** Distance between spawned patterns; tighter as speed grows. */
export const patternGap = (speed: number) => Math.max(26, 46 - speed * 0.4);

export type SpawnKind = 'gate' | 'mote' | 'shard';
export interface Spawn {
  kind: SpawnKind;
  x: number;
  y: number;
  /** Offset along -z from the pattern origin (positive = further away). */
  dz: number;
}

const clampX = (x: number) => Math.max(-BOUNDS.x, Math.min(BOUNDS.x, x));
const clampY = (y: number) => Math.max(BOUNDS.yMin, Math.min(BOUNDS.yMax, y));

/** Generates the next obstacle/collectible pattern. `t` is elapsed play time (difficulty). */
export function nextPattern(rand: () => number, t: number): Spawn[] {
  const r = rand();
  const out: Spawn[] = [];
  const cx = clampX((rand() * 2 - 1) * (BOUNDS.x - 1.5));
  const cy = clampY(
    BOUNDS.yMin + 0.6 + rand() * (BOUNDS.yMax - BOUNDS.yMin - 1.2),
  );
  const shardCount = Math.min(7, 2 + Math.floor(t / 15));

  if (r < 0.4) {
    // gate with a breadcrumb of motes leading in
    out.push({ kind: 'gate', x: cx, y: cy, dz: 0 });
    for (let i = 1; i <= 5; i++)
      out.push({ kind: 'mote', x: cx, y: cy, dz: -i * 2.2 });
    if (t > 20) {
      for (let i = 0; i < Math.min(4, shardCount - 2); i++) {
        const a = rand() * Math.PI * 2;
        out.push({
          kind: 'shard',
          x: clampX(cx + Math.cos(a) * (GATE_RADIUS + 1.4)),
          y: clampY(cy + Math.sin(a) * (GATE_RADIUS + 1.4)),
          dz: (rand() - 0.5) * 4,
        });
      }
    }
  } else if (r < 0.7) {
    // shard field with a guaranteed clear lane at (cx, cy)
    for (let i = 0; i < shardCount; i++) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 8; tries++) {
        x = (rand() * 2 - 1) * BOUNDS.x;
        y = BOUNDS.yMin + rand() * (BOUNDS.yMax - BOUNDS.yMin);
        if (Math.hypot(x - cx, y - cy) > 2.4) break;
      }
      out.push({ kind: 'shard', x, y, dz: rand() * 10 });
    }
    out.push({ kind: 'mote', x: cx, y: cy, dz: 5 });
  } else {
    // sweeping arc of motes
    const sweep = (rand() < 0.5 ? -1 : 1) * (2 + rand() * 3);
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      out.push({
        kind: 'mote',
        x: clampX(cx + Math.sin(k * Math.PI) * sweep),
        y: clampY(cy + Math.cos(k * Math.PI * 2) * 0.8),
        dz: i * 2,
      });
    }
  }
  return out;
}

export const hitsSphere = (
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  r: number,
) => (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2 < r * r;

/** Shards are tall, so test against an ellipsoid (rx horizontally, ry vertically). */
export const hitsShard = (
  px: number,
  py: number,
  pz: number,
  sx: number,
  sy: number,
  sz: number,
  scale = 1,
) => {
  const rx = (0.55 * scale + ORB_RADIUS * 0.8) ** 2;
  const ry = (1.2 * scale + ORB_RADIUS * 0.8) ** 2;
  return (px - sx) ** 2 / rx + (py - sy) ** 2 / ry + (pz - sz) ** 2 / rx < 1;
};

/** True if the orb passes through the gate opening when the gate crosses the orb's plane. */
export const throughGate = (px: number, py: number, gx: number, gy: number) =>
  Math.hypot(px - gx, py - gy) < GATE_RADIUS - ORB_RADIUS * 0.5;

export interface ScoreState {
  score: number;
  multiplier: number;
  gates: number;
}

export type ScoreEvent = 'mote' | 'gate' | 'miss';

export function applyScore(s: ScoreState, e: ScoreEvent): ScoreState {
  switch (e) {
    case 'mote':
      return { ...s, score: s.score + 10 * s.multiplier };
    case 'gate':
      return {
        score: s.score + 50 * s.multiplier,
        multiplier: Math.min(MAX_MULTIPLIER, s.multiplier + 1),
        gates: s.gates + 1,
      };
    case 'miss':
      return { ...s, multiplier: 1 };
  }
}
