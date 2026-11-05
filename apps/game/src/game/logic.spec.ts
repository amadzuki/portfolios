import { describe, expect, it } from 'vitest';
import {
  applyScore,
  BOUNDS,
  hitsShard,
  MAX_MULTIPLIER,
  nextPattern,
  rng,
  speedAt,
  throughGate,
} from './logic';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('patterns', () => {
  it('keep everything inside the flight bounds', () => {
    const rand = rng(7);
    for (let i = 0; i < 500; i++) {
      for (const s of nextPattern(rand, i)) {
        expect(Math.abs(s.x)).toBeLessThanOrEqual(BOUNDS.x + 1e-9);
        expect(s.y).toBeGreaterThanOrEqual(BOUNDS.yMin - 1e-9);
        expect(s.y).toBeLessThanOrEqual(BOUNDS.yMax + 1e-9);
      }
    }
  });

  it('get harder over time', () => {
    const count = (t: number) => {
      const rand = rng(1);
      let shards = 0;
      for (let i = 0; i < 200; i++)
        shards += nextPattern(rand, t).filter((s) => s.kind === 'shard').length;
      return shards;
    };
    expect(count(120)).toBeGreaterThan(count(0));
    expect(speedAt(60)).toBeGreaterThan(speedAt(0));
  });
});

describe('collisions', () => {
  it('gate opening and shard hulls', () => {
    expect(throughGate(0, 2, 0.5, 2)).toBe(true);
    expect(throughGate(0, 2, 2, 2)).toBe(false);
    expect(hitsShard(0, 2, 0, 0, 2.9, 0)).toBe(true);
    expect(hitsShard(0, 2, 0, 1.6, 2, 0)).toBe(false);
  });
});

describe('scoring', () => {
  it('gates raise the multiplier up to a cap; misses reset it', () => {
    let s = { score: 0, multiplier: 1, gates: 0 };
    for (let i = 0; i < 20; i++) s = applyScore(s, 'gate');
    expect(s.multiplier).toBe(MAX_MULTIPLIER);
    s = applyScore(s, 'mote');
    s = applyScore(s, 'miss');
    expect(s.multiplier).toBe(1);
    expect(s.gates).toBe(20);
  });
});
