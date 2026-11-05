import { describe, expect, it } from 'vitest';
import { createGuard } from './guard';
import { topK } from './similarity';

describe('createGuard', () => {
  it('rate limits per key and resets after the window', () => {
    let t = Date.parse('2026-01-01T10:00:00Z');
    const check = createGuard({ limit: 2, windowMs: 1000, now: () => t });
    expect(check('a').ok).toBe(true);
    expect(check('a').ok).toBe(true);
    expect(check('a')).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(check('b').ok).toBe(true);
    t += 1001;
    expect(check('a').ok).toBe(true);
  });

  it('enforces a global daily budget', () => {
    const t = Date.parse('2026-01-01T10:00:00Z');
    const check = createGuard({
      limit: 100,
      windowMs: 1000,
      dailyBudget: 1,
      now: () => t,
    });
    expect(check('a').ok).toBe(true);
    expect(check('b')).toMatchObject({ ok: false, reason: 'budget_exhausted' });
  });
});

describe('topK', () => {
  it('ranks by cosine similarity', () => {
    const items = [
      { id: 'x', embedding: [1, 0] },
      { id: 'y', embedding: [0, 1] },
      { id: 'z', embedding: [0.7, 0.7] },
    ];
    expect(topK([1, 0.1], items, 2).map((i) => i.id)).toEqual(['x', 'z']);
  });
});
