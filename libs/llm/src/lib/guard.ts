/**
 * Abuse guard for public AI demos: fixed-window per-key rate limit plus a global daily
 * request budget. In-memory, so per server instance; swap the store for Redis/Upstash
 * when deploying to multiple instances.
 */
export interface GuardOptions {
  /** Requests allowed per key per window. */
  limit: number;
  windowMs: number;
  /** Total requests per UTC day across all keys. */
  dailyBudget?: number;
  now?: () => number;
}

export type GuardResult =
  | { ok: true; remaining: number }
  | {
      ok: false;
      reason: 'rate_limited' | 'budget_exhausted';
      retryAfterMs: number;
    };

export function createGuard({
  limit,
  windowMs,
  dailyBudget,
  now = Date.now,
}: GuardOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let day = '';
  let dayCount = 0;

  return function check(key: string): GuardResult {
    const t = now();
    const today = new Date(t).toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      dayCount = 0;
    }
    if (dailyBudget !== undefined && dayCount >= dailyBudget) {
      const tomorrow = Date.parse(`${today}T00:00:00Z`) + 86_400_000;
      return {
        ok: false,
        reason: 'budget_exhausted',
        retryAfterMs: tomorrow - t,
      };
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    if (entry.count >= limit) {
      return {
        ok: false,
        reason: 'rate_limited',
        retryAfterMs: entry.resetAt - t,
      };
    }
    entry.count++;
    dayCount++;
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    return { ok: true, remaining: limit - entry.count };
  };
}

/** Best-effort client IP from common proxy headers. */
export function clientKey(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'anonymous'
  );
}
