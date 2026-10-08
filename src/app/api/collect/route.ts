// The ingest endpoint the browser library posts to. Thin on purpose: the
// handler in src/collect does the work and is tested without a server. The
// only logic here is the demo-mode guard, which refuses floods before the
// handler ever touches the database.
import { z } from "zod";
import { corsPreflightResponse, handleCollect } from "@/collect/handle";
import { createRateLimiter, DEMO_COLLECT_RATE_LIMIT, type RateLimitDecision } from "@/collect/rate-limit";
import { isDemoMode } from "@/config/demo-mode";
import { getDb } from "@/db";

const MILLISECONDS_PER_SECOND = 1000;
// Bodies that are not JSON with a string siteId share one bucket: they are
// rejected by the handler anyway, so a 429 instead of a 400 costs nothing.
const UNIDENTIFIED_SITE_KEY = "<unidentified>";

const demoLimiter = createRateLimiter(DEMO_COLLECT_RATE_LIMIT);

const siteIdPeekSchema = z.object({ siteId: z.string() });

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

// Mirrors the handler's error shape and CORS headers (borrowed from its
// preflight response, which owns the policy) so clients see one consistent API.
const rateLimitedResponse = (decision: Extract<RateLimitDecision, { allowed: false }>): Response => {
  const retryAfterSeconds = Math.ceil(decision.retryAfterMs / MILLISECONDS_PER_SECOND);
  const headers = new Headers(corsPreflightResponse().headers);
  headers.set("retry-after", String(retryAfterSeconds));
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message:
          `Demo mode accepts at most ${DEMO_COLLECT_RATE_LIMIT.maxRequests} batches per minute per site; ` +
          `retry in ${retryAfterSeconds}s`,
      },
    },
    { status: 429, headers },
  );
};

export const POST = async (request: Request): Promise<Response> => {
  if (isDemoMode()) {
    const decision = demoLimiter.tryAcquire(await rateLimitKeyFor(request));
    if (!decision.allowed) {
      return rateLimitedResponse(decision);
    }
  }
  return handleCollect({ request, db: getDb() });
};

export const OPTIONS = (): Response => corsPreflightResponse();
