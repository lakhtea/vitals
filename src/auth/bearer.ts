// Bearer-token parsing and secret comparison, shared by every endpoint that
// trusts a caller because of a header: POST /api/checks (per-site write keys)
// and the GraphQL context (the agents' service token).
import { timingSafeEqual } from "node:crypto";

/** The token from `Authorization: Bearer <token>`, or null when the header is missing or malformed. */
export const bearerToken = (request: Request): string | null => {
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

/**
 * Constant-time, so how long the comparison takes cannot tell a guesser how
 * much of the secret was right. The length check leaks only the secret's length.
 */
export const isSameSecret = ({ presented, expected }: { presented: string; expected: string }): boolean => {
  const presentedBytes = Buffer.from(presented);
  const expectedBytes = Buffer.from(expected);
  return presentedBytes.length === expectedBytes.length && timingSafeEqual(presentedBytes, expectedBytes);
};
