// The HTTP face of POST /api/checks, separated from the Next.js route file so
// tests can call it with a real Request and an in-memory database. Unlike
// /api/collect it answers servers, not browsers: every call must carry the
// site's write key, and there are no CORS headers because a page could never
// hold that key honestly. Every failure is a typed JSON error with a stable code.
import { timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import type { Db } from "@/db";
import { findSiteCredential, ingestChecks } from "./ingest";
import { MAX_BODY_BYTES, makeChecksPayloadSchema } from "./payload";

type ChecksErrorCode =
  | "payload_too_large"
  | "invalid_json"
  | "invalid_payload"
  | "batch_too_large"
  | "unknown_site"
  | "invalid_write_key";

interface ChecksIssue {
  path: string;
  message: string;
}

const errorResponse = ({
  status,
  code,
  message,
  issues,
  headers,
}: {
  status: number;
  code: ChecksErrorCode;
  message: string;
  issues?: ChecksIssue[];
  headers?: HeadersInit;
}): Response => Response.json({ error: { code, message, ...(issues ? { issues } : {}) } }, { status, headers });

const toIssues = (error: z.ZodError): ChecksIssue[] =>
  error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

const isBatchTooLarge = (error: z.ZodError): boolean =>
  error.issues.some((issue) => issue.code === "too_big" && issue.path.join(".") === "checks");

type ParsedJson = { ok: true; value: unknown } | { ok: false };

const parseJson = (text: string): ParsedJson => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/** The token from `Authorization: Bearer <token>`, or null when the header is missing or malformed. */
const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (header === null) {
    return null;
  }
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme === undefined || scheme.toLowerCase() !== "bearer" || token === undefined || rest.length > 0) {
    return null;
  }
  return token;
};

// Constant-time, so how long the comparison takes cannot tell a guesser how
// much of the key was right. The length check leaks only the key's length.
const isSameKey = ({ presented, expected }: { presented: string; expected: string }): boolean => {
  const presentedBytes = Buffer.from(presented);
  const expectedBytes = Buffer.from(expected);
  return presentedBytes.length === expectedBytes.length && timingSafeEqual(presentedBytes, expectedBytes);
};

export const handleChecks = async ({
  request,
  db,
  now = Date.now(),
}: {
  request: Request;
  db: Db;
  now?: number;
}): Promise<Response> => {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return errorResponse({
      status: 413,
      code: "payload_too_large",
      message: `Body exceeds ${MAX_BODY_BYTES} bytes`,
    });
  }

  const json = parseJson(text);
  if (!json.ok) {
    return errorResponse({ status: 400, code: "invalid_json", message: "Body is not valid JSON" });
  }

  const parsed = makeChecksPayloadSchema(now).safeParse(json.value);
  if (!parsed.success) {
    if (isBatchTooLarge(parsed.error)) {
      return errorResponse({
        status: 413,
        code: "batch_too_large",
        message: "Too many checks in one batch; split the delivery",
        issues: toIssues(parsed.error),
      });
    }
    return errorResponse({
      status: 422,
      code: "invalid_payload",
      message: "Payload failed validation",
      issues: toIssues(parsed.error),
    });
  }

  // Site ids are public (browsers post them to /api/collect), so telling an
  // unknown site apart from a bad key gives nothing away and keeps the codes honest.
  const site = findSiteCredential({ db, siteId: parsed.data.siteId });
  if (site === undefined) {
    return errorResponse({ status: 404, code: "unknown_site", message: `No site with id "${parsed.data.siteId}"` });
  }

  const presented = bearerToken(request);
  if (site.writeKey === null || presented === null || !isSameKey({ presented, expected: site.writeKey })) {
    return errorResponse({
      status: 401,
      code: "invalid_write_key",
      message: `Missing or wrong write key for site "${site.id}"; send it as "Authorization: Bearer <key>"`,
      headers: { "www-authenticate": "Bearer" },
    });
  }

  return Response.json(ingestChecks({ db, payload: parsed.data }), { status: 202 });
};
