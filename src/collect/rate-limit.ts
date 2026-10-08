// A fixed-window request limiter for the public demo, where /api/collect is
// open to the world. Pure and clock-injected so the test can step time; the
// route decides when to apply it (demo mode only) and how to answer a refusal.

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  /** Injected clock; defaults to Date.now so tests can step time deterministically. */
  now?: () => number;
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface RateLimiter {
  /** Counts one request against `key` and reports whether it fits in the current window. */
  tryAcquire: (key: string) => RateLimitDecision;
}

interface FixedWindow {
  startedAt: number;
  count: number;
}

/** What the demo deployment allows per site: generous for a real browser, cheap to exhaust for a script. */
export const DEMO_COLLECT_RATE_LIMIT = { maxRequests: 120, windowMs: 60_000 } as const;

export const createRateLimiter = ({ maxRequests, windowMs, now = Date.now }: RateLimitOptions): RateLimiter => {
  const windows = new Map<string, FixedWindow>();

  const hasExpired = (fixedWindow: FixedWindow, currentTime: number): boolean =>
    currentTime - fixedWindow.startedAt >= windowMs;

  // Unknown site ids each open a window, so drop stale ones whenever a new key
  // arrives; the map then never holds more than one window per recently seen key.
  const evictExpired = (currentTime: number): void => {
    for (const [key, fixedWindow] of windows) {
      if (hasExpired(fixedWindow, currentTime)) {
        windows.delete(key);
      }
    }
  };

  const tryAcquire = (key: string): RateLimitDecision => {
    const currentTime = now();
    const existing = windows.get(key);

    if (existing === undefined || hasExpired(existing, currentTime)) {
      evictExpired(currentTime);
      windows.set(key, { startedAt: currentTime, count: 1 });
      return { allowed: true };
    }

    if (existing.count >= maxRequests) {
      return { allowed: false, retryAfterMs: existing.startedAt + windowMs - currentTime };
    }

    windows.set(key, { ...existing, count: existing.count + 1 });
    return { allowed: true };
  };

  return { tryAcquire };
};
