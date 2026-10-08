// The limiter is the one demo-mode piece whose failure would silently refuse
// all ingestion, so one scenario walks the whole window: fill it, get refused,
// confirm other sites are unaffected, and recover once the window rolls over.
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows maxRequests per key per window, refuses the rest with a retry delay, then resets", () => {
    let clock = 1_000;
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000, now: () => clock });

    expect(limiter.tryAcquire("demo")).toEqual({ allowed: true });
    expect(limiter.tryAcquire("demo")).toEqual({ allowed: true });
    expect(limiter.tryAcquire("demo")).toEqual({ allowed: true });

    clock += 15_000;
    expect(limiter.tryAcquire("demo")).toEqual({ allowed: false, retryAfterMs: 45_000 });
    expect(limiter.tryAcquire("other-site")).toEqual({ allowed: true });

    clock += 45_000;
    expect(limiter.tryAcquire("demo")).toEqual({ allowed: true });
  });
});
