// The HTTP face of ingestion, separated from the Next.js route file so tests
// can call it with a real Request and an in-memory database. Every failure
// becomes a typed JSON error with a stable `code`; nothing throws to the caller.
import type { z } from "zod";
import type { Db } from "@/db";
import { ingestBatch, siteExists } from "./ingest";
import { MAX_BODY_BYTES, makeCollectPayloadSchema } from "./payload";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

type CollectErrorCode = "payload_too_large" | "invalid_json" | "invalid_payload" | "batch_too_large" | "unknown_site";

interface CollectIssue {
  path: string;
  message: string;
}

const jsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status, headers: CORS_HEADERS });

const errorResponse = ({
  status,
  code,
  message,
  issues,
}: {
  status: number;
  code: CollectErrorCode;
  message: string;
  issues?: CollectIssue[];
}): Response => jsonResponse({ error: { code, message, ...(issues ? { issues } : {}) } }, status);

const toIssues = (error: z.ZodError): CollectIssue[] =>
  error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

const isBatchTooLarge = (error: z.ZodError): boolean =>
  error.issues.some((issue) => issue.code === "too_big" && issue.path.join(".") === "events");

type ParsedJson = { ok: true; value: unknown } | { ok: false };

const parseJson = (text: string): ParsedJson => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

export const corsPreflightResponse = (): Response => new Response(null, { status: 204, headers: CORS_HEADERS });

export const handleCollect = async ({
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

  const parsed = makeCollectPayloadSchema(now).safeParse(json.value);
  if (!parsed.success) {
    if (isBatchTooLarge(parsed.error)) {
      return errorResponse({
        status: 413,
        code: "batch_too_large",
        message: "Too many events in one batch; split the delivery",
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

  if (!siteExists({ db, siteId: parsed.data.siteId })) {
    return errorResponse({ status: 404, code: "unknown_site", message: `No site with id "${parsed.data.siteId}"` });
  }

  return jsonResponse(ingestBatch({ db, payload: parsed.data }), 202);
};
