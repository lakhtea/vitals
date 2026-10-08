// Measures what virtualising SessionsTable changes in a real browser: how many
// <tr> elements the 2,000-row story puts in the DOM, and how long the page
// takes from navigation start until the first body row has been painted. This
// is the committed method behind the README's "Sessions table render" row.
// Headless Chromium (Playwright) opens the story from a static Storybook
// build served by the tiny file server below, so the component under test is
// the one the dashboard renders, minus the GraphQL round trip.
//   npm run build-storybook && npm run measure:render
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { z } from "zod";

const STATIC_DIR = path.resolve("storybook-static");
const STORY_ID = "dashboard-sessionstable--two-thousand-rows";
const RUNS = 5;
const HOST = "127.0.0.1";
const FIRST_ROW_PAINTED_KEY = "__vitalsFirstRowPaintedAt";
// Storybook's iframe.html carries its own static <table> markup, so every
// selector is scoped to the element the story renders into.
const STORY_ROOT_SELECTOR = "#storybook-root";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const StorybookIndexSchema = z.object({ entries: z.record(z.string(), z.unknown()) });

const serveFile = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = new URL(request.url ?? "/", `http://${HOST}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.join(STATIC_DIR, requested);
  if (!file.startsWith(`${STATIC_DIR}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream" });
  response.end(body);
};

const startStaticServer = async (): Promise<{ server: Server; origin: string }> => {
  const server = createServer((request, response) => {
    void serveFile(request, response);
  });
  await new Promise<void>((resolve) => server.listen(0, HOST, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, origin: `http://${HOST}:${port}` };
};

const assertStoryIsBuilt = async (): Promise<void> => {
  let index: z.infer<typeof StorybookIndexSchema>;
  try {
    index = StorybookIndexSchema.parse(JSON.parse(await readFile(path.join(STATIC_DIR, "index.json"), "utf8")));
  } catch (error) {
    throw new Error("storybook-static/index.json is missing; run `npm run build-storybook` first", { cause: error });
  }
  if (!(STORY_ID in index.entries)) {
    throw new Error(`story ${STORY_ID} is not in the Storybook build; known ids: ${Object.keys(index.entries).join(", ")}`);
  }
};

const RunResultSchema = z.object({
  /** <tr> elements inside the story root at the moment the first body row was painted. */
  rowElements: z.number().int(),
  /** Milliseconds from navigation start to that paint. */
  firstRowPaintedMs: z.number(),
});

type RunResult = z.infer<typeof RunResultSchema>;

/**
 * Installed before any page script runs. Watches the DOM for the first <tbody>
 * row inside the story root, waits two animation frames so the frame containing
 * it has been painted, then records performance.now() (milliseconds since
 * navigation start) and the row count in that same frame, before any play
 * function or user scroll can change the window.
 */
const recordFirstRowPaint = ({ key, rootSelector }: { key: string; rootSelector: string }): void => {
  const observer = new MutationObserver(() => {
    if (document.querySelector(`${rootSelector} tbody tr`) === null) {
      return;
    }
    observer.disconnect();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        (window as unknown as Record<string, unknown>)[key] = {
          rowElements: document.querySelectorAll(`${rootSelector} tr`).length,
          firstRowPaintedMs: performance.now(),
        };
      });
    });
  });
  observer.observe(document, { childList: true, subtree: true });
};

const measureOnce = async ({ browser, storyUrl }: { browser: Awaited<ReturnType<typeof chromium.launch>>; storyUrl: string }): Promise<RunResult> => {
  // A fresh context per run: no HTTP cache or compiled-script cache carried over.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(recordFirstRowPaint, { key: FIRST_ROW_PAINTED_KEY, rootSelector: STORY_ROOT_SELECTOR });
  await page.goto(storyUrl);
  const handle = await page.waitForFunction((key) => (window as unknown as Record<string, unknown>)[key], FIRST_ROW_PAINTED_KEY);
  const result = RunResultSchema.parse(await handle.jsonValue());
  await context.close();
  return result;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const main = async (): Promise<void> => {
  await assertStoryIsBuilt();
  const { server, origin } = await startStaticServer();
  const browser = await chromium.launch();
  try {
    const storyUrl = `${origin}/iframe.html?id=${STORY_ID}&viewMode=story`;
    const results: RunResult[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      results.push(await measureOnce({ browser, storyUrl }));
    }
    const rowCounts = new Set(results.map((result) => result.rowElements));
    const paintTimes = results.map((result) => result.firstRowPaintedMs);
    console.log(`Story ${STORY_ID}, ${RUNS} runs in headless Chromium ${browser.version()}:`);
    console.log(`  <tr> elements in the DOM:         ${[...rowCounts].join(" / ")}`);
    console.log(
      `  first body row painted after:     ${median(paintTimes).toFixed(0)} ms median` +
        ` (runs: ${paintTimes.map((ms) => ms.toFixed(0)).join(", ")})`,
    );
  } finally {
    await browser.close();
    server.close();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
