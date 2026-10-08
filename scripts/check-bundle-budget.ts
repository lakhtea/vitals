// Measures the dashboard route's First Load JS from the artefacts `next build`
// leaves in .next/ and fails when it exceeds the committed baseline plus the
// tolerance in bundle-budget.json. This is the committed method behind the
// README's "First-load JS" row and the CI job `bundle`.
//   npm run build && npm run check:bundle    compare against the baseline
//   npm run build && npm run measure:bundle  re-measure and rewrite the baseline
//
// What is summed (the same union Next.js itself uses for its route-bundle
// diagnostics, which the script cross-checks against when present):
//   1. every JS chunk in `entryJSFiles` of the route's client reference
//      manifest (.next/server/app/<route>/page_client-reference-manifest.js),
//      across all of its segments: root layout, page, and the built-in
//      global-error boundary;
//   2. `rootMainFiles` from .next/build-manifest.json: the React and Next.js
//      runtime every App Router page loads before any route code.
// Deduplicated, then the size of each file on disk is summed. Raw bytes, not
// gzip or brotli: what the server stores, not what the wire carries. CSS is
// not counted. The number is about 3-4x what a visitor downloads compressed,
// which is why the gzip size is printed alongside for orientation only.
import { createRequire } from "node:module";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { z } from "zod";

const DIST_DIR = path.resolve(".next");
const BUDGET_FILE = path.resolve("bundle-budget.json");
const MEASURED_WITH = "npm run build && npm run measure:bundle";
const DEFAULT_TOLERANCE_PERCENT = 10;
const PERCENT = 100;

const BudgetSchema = z.object({
  route: z.string(),
  firstLoadJsBytes: z.number().int().nonnegative(),
  tolerancePercent: z.number().nonnegative(),
  measuredWith: z.string(),
});

type Budget = z.infer<typeof BudgetSchema>;

const BuildManifestSchema = z.object({ rootMainFiles: z.array(z.string()) });

const ClientReferenceManifestSchema = z.object({
  entryJSFiles: z.record(z.string(), z.array(z.string())),
});

const RouteBundleStatsSchema = z.array(
  z.object({ route: z.string(), firstLoadUncompressedJsBytes: z.number() }),
);

interface ChunkSize {
  file: string;
  bytes: number;
  gzipBytes: number;
}

interface Measurement {
  route: string;
  chunks: ChunkSize[];
  totalBytes: number;
}

const isJavaScript = (file: string): boolean => file.endsWith(".js");

/** "/" -> "/page", "/sites/[id]" -> "/sites/[id]/page": the app path of a route's page entry. */
const toPageEntry = (route: string): string => (route === "/" ? "/page" : `${route}/page`);

/**
 * The client reference manifest is a JS file that assigns into the global
 * `__RSC_MANIFEST`, so it is loaded with require() and the global is restored.
 */
const readEntryJsFiles = (route: string): string[] => {
  const manifestFile = path.join(DIST_DIR, "server", "app", `${toPageEntry(route)}_client-reference-manifest.js`);
  const require = createRequire(import.meta.url);
  const globalScope = globalThis as { __RSC_MANIFEST?: unknown };
  const previous = globalScope.__RSC_MANIFEST;
  globalScope.__RSC_MANIFEST = undefined;
  require(manifestFile);
  const manifests = z.record(z.string(), ClientReferenceManifestSchema).parse(globalScope.__RSC_MANIFEST);
  globalScope.__RSC_MANIFEST = previous;

  const manifest = manifests[toPageEntry(route)];
  if (manifest === undefined) {
    throw new Error(`${manifestFile} has no entry for ${toPageEntry(route)}`);
  }
  return Object.values(manifest.entryJSFiles).flat().filter(isJavaScript);
};

const readRootMainFiles = (): string[] => {
  const manifest = BuildManifestSchema.parse(JSON.parse(readFileSync(path.join(DIST_DIR, "build-manifest.json"), "utf8")));
  return manifest.rootMainFiles.filter(isJavaScript);
};

const measureChunk = (file: string): ChunkSize => {
  const absolute = path.join(DIST_DIR, file);
  const bytes = statSync(absolute).size;
  const gzipBytes = gzipSync(readFileSync(absolute)).length;
  return { file, bytes, gzipBytes };
};

const measureFirstLoadJs = (route: string): Measurement => {
  const files = [...new Set([...readEntryJsFiles(route), ...readRootMainFiles()])];
  const chunks = files.map(measureChunk).sort((a, b) => b.bytes - a.bytes);
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  return { route, chunks, totalBytes };
};

/** Next.js writes its own per-route total; a disagreement means this script's method has drifted. */
const assertMatchesNextDiagnostics = (measurement: Measurement): void => {
  const statsFile = path.join(DIST_DIR, "diagnostics", "route-bundle-stats.json");
  let rows: z.infer<typeof RouteBundleStatsSchema>;
  try {
    rows = RouteBundleStatsSchema.parse(JSON.parse(readFileSync(statsFile, "utf8")));
  } catch {
    console.warn(`note: ${path.relative(process.cwd(), statsFile)} not found or unreadable; skipping the cross-check`);
    return;
  }
  const row = rows.find((candidate) => candidate.route === measurement.route);
  if (row !== undefined && row.firstLoadUncompressedJsBytes !== measurement.totalBytes) {
    throw new Error(
      `measured ${measurement.totalBytes} bytes but Next.js reports ${row.firstLoadUncompressedJsBytes} for ${measurement.route}; ` +
        "the summing method in this script no longer matches next build",
    );
  }
};

const readBudget = (): Budget => BudgetSchema.parse(JSON.parse(readFileSync(BUDGET_FILE, "utf8")));

const readBudgetIfPresent = (): Budget | null => {
  try {
    return readBudget();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const formatBytes = (bytes: number): string => `${bytes.toLocaleString("en-US")} B`;

const printMeasurement = (measurement: Measurement): void => {
  console.log(`First Load JS for route ${measurement.route} (raw bytes on disk, gzip for orientation):`);
  for (const chunk of measurement.chunks) {
    console.log(`  ${formatBytes(chunk.bytes).padStart(12)}  gzip ${formatBytes(chunk.gzipBytes).padStart(10)}  ${chunk.file}`);
  }
  console.log(`  ${formatBytes(measurement.totalBytes).padStart(12)}  total across ${measurement.chunks.length} chunks`);
};

const writeBaseline = (measurement: Measurement, existing: Budget | null): void => {
  const budget: Budget = {
    route: measurement.route,
    firstLoadJsBytes: measurement.totalBytes,
    tolerancePercent: existing?.tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT,
    measuredWith: MEASURED_WITH,
  };
  writeFileSync(BUDGET_FILE, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`\nBaseline written to ${path.relative(process.cwd(), BUDGET_FILE)}: ${formatBytes(budget.firstLoadJsBytes)}`);
};

const compareToBaseline = (measurement: Measurement, budget: Budget): void => {
  const limit = Math.floor(budget.firstLoadJsBytes * (1 + budget.tolerancePercent / PERCENT));
  const delta = measurement.totalBytes - budget.firstLoadJsBytes;
  const deltaPercent = (delta / budget.firstLoadJsBytes) * PERCENT;
  const sign = delta >= 0 ? "+" : "-";
  console.log(`\nBudget for ${budget.route}:`);
  console.log(`  current  ${formatBytes(measurement.totalBytes).padStart(12)}`);
  console.log(`  baseline ${formatBytes(budget.firstLoadJsBytes).padStart(12)}  (${budget.measuredWith})`);
  console.log(`  delta    ${`${sign}${formatBytes(Math.abs(delta))}`.padStart(12)}  (${sign}${Math.abs(deltaPercent).toFixed(2)}%)`);
  console.log(`  limit    ${formatBytes(limit).padStart(12)}  (baseline + ${budget.tolerancePercent}%)`);

  if (measurement.totalBytes > limit) {
    throw new Error(
      `First Load JS for ${budget.route} is ${formatBytes(measurement.totalBytes)}, over the budget of ${formatBytes(limit)}. ` +
        "Find the cause in the chunk list above (a new client dependency, or a module that moved into a client bundle). " +
        `If the growth is intended, re-measure with \`${MEASURED_WITH}\` and commit the new baseline with the reason.`,
    );
  }
  console.log("  within budget");
};

const main = (): void => {
  const shouldWrite = process.argv.includes("--write");
  const existing = readBudgetIfPresent();
  const route = existing?.route ?? "/";

  const measurement = measureFirstLoadJs(route);
  assertMatchesNextDiagnostics(measurement);
  printMeasurement(measurement);

  if (shouldWrite) {
    writeBaseline(measurement, existing);
    return;
  }
  if (existing === null) {
    throw new Error(`${path.relative(process.cwd(), BUDGET_FILE)} is missing; create it with \`${MEASURED_WITH}\``);
  }
  compareToBaseline(measurement, existing);
};

try {
  main();
} catch (error: unknown) {
  console.error(`\nbundle budget: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
