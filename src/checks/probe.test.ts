// The probe is how Vitals watches an application that pushes nothing. What
// matters: a healthy endpoint reads ok, a slow one degraded, an error status
// or no answer at all failing, against a real local HTTP server.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classifyProbe, probeOnce } from "./probe";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/healthz") {
      response.writeHead(200).end("ok");
      return;
    }
    if (request.url === "/slow") {
      setTimeout(() => response.writeHead(200).end("ok"), 120);
      return;
    }
    response.writeHead(503).end("down");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const probe = async ({ path, degradedAfterMs = 1_000, timeoutMs = 2_000 }: { path: string; degradedAfterMs?: number; timeoutMs?: number }) => {
  const url = `${baseUrl}${path}`;
  return classifyProbe({ outcome: await probeOnce({ url, timeoutMs }), url, degradedAfterMs });
};

describe("HTTP health probe", () => {
  it("reads a fast 2xx as ok, with the round trip as its value", async () => {
    const verdict = await probe({ path: "/healthz" });
    expect(verdict).toMatchObject({ status: "ok", unit: "ms", detail: null });
    expect(verdict.value).toBeGreaterThanOrEqual(0);
  });

  it("reads a 2xx over the latency budget as degraded, and says by how much", async () => {
    const verdict = await probe({ path: "/slow", degradedAfterMs: 50 });
    expect(verdict.status).toBe("degraded");
    expect(verdict.detail).toMatch(/^Slow: \d+ ms against a budget of 50 ms$/);
  });

  it("reads an error status as failing, naming the status and the URL", async () => {
    const verdict = await probe({ path: "/broken" });
    expect(verdict).toMatchObject({ status: "failing", detail: `HTTP 503 from ${baseUrl}/broken` });
  });

  it("reads no answer within the timeout as failing instead of throwing", async () => {
    const verdict = await probe({ path: "/slow", timeoutMs: 20 });
    expect(verdict.status).toBe("failing");
    expect(verdict.detail).toMatch(new RegExp(`^No response from ${baseUrl}/slow: `));
  });
});
