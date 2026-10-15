// The endpoint applications push health-check results to. Thin on purpose:
// src/checks/handle.ts does the work and is tested without a server. The only
// logic here is the demo-mode guard, mirrored from /api/collect, which refuses
// floods before the handler touches the database. There is no OPTIONS handler:
// servers call this, not pages, so it never answers a CORS preflight.
import { z } from "zod";
import { handleChecks } from "@/checks/handle";
import { MAX_ID_LENGTH } from "@/collect/payload";
import { createRateLimiter, DEMO_COLLECT_RATE_LIMIT, type RateLimitDecision } from "@/collect/rate-limit";
import { isDemoMode } from "@/config/demo-mode";
import { getDb } from "@/db";

const MILLISECONDS_PER_SECOND = 1000;
// Bodies that are not JSON with a plausible siteId share one bucket: the
// handler rejects them anyway, so a 429 instead of a 400 costs nothing.
const UNIDENTIFIED_SITE_KEY = "<unidentified>";

const demoLimiter = createRateLimiter(DEMO_COLLECT_RATE_LIMIT);

const siteIdPeekSchema = z.object({ siteId: z.string().max(MAX_ID_LENGTH) });

const parseJsonOrUndefined = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// Reading a body consumes it, so peek at a clone and leave the original intact for the handler.
const rateLimitKeyFor = async (request: Request): Promise<string> => {
  const peeked = siteIdPeekSchema.safeParse(parseJsonOrUndefined(await request.clone().text()));
  return peeked.success ? peeked.data.siteId : UNIDENTIFIED_SITE_KEY;
};

// Mirrors the handler's error shape so callers see one consistent API.
const rateLimitedResponse = (decision: Extract<RateLimitDecision, { allowed: false }>): Response => {
  const retryAfterSeconds = Math.ceil(decision.retryAfterMs / MILLISECONDS_PER_SECOND);
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message:
          `Demo mode accepts at most ${DEMO_COLLECT_RATE_LIMIT.maxRequests} batches per minute per site; ` +
          `retry in ${retryAfterSeconds}s`,
      },
    },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
};

export const POST = async (request: Request): Promise<Response> => {
  if (isDemoMode()) {
    const decision = demoLimiter.tryAcquire(await rateLimitKeyFor(request));
    if (!decision.allowed) {
      return rateLimitedResponse(decision);
    }
  }
  return handleChecks({ request, db: getDb() });
};
