// Bundle budget: the JavaScript every page downloads must stay small.
//
//   node scripts/perf-budget.mjs [--dir .next] [--max-kb 220]
//
// "Shared" = what every route loads: the build's root main files (framework)
// plus the chunks of the root layout (app/layout, which holds the Shell).
// Read from the build output of `next build` (Turbopack or --webpack), each
// file gzipped with zlib at the default level, as a server would send it.
// Fails (exit 1) when the total is over the budget, and when the manifests do
// not say where the shared chunks are (a silent pass would be worse).
//
// Page weight and Core Web Vitals are checked by scripts/perf-vitals.py.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dir = opt("dir", process.env.NEXT_DIST_DIR || ".next");
const maxKb = Number(opt("max-kb", "220"));

function fail(msg) {
  console.error(`perf-budget: ${msg}`);
  process.exit(1);
}
if (!existsSync(join(dir, "build-manifest.json"))) fail(`no ${dir}/build-manifest.json: run \`next build\` first`);

const build = JSON.parse(readFileSync(join(dir, "build-manifest.json"), "utf8"));
const shared = new Set((build.rootMainFiles ?? []).filter((f) => f.endsWith(".js")));
if (shared.size === 0) fail("build-manifest.json lists no rootMainFiles");

// A route's client-reference manifest is a JS file assigning one JSON object.
function manifestFor(route) {
  const file = join(dir, "server", "app", route, "page_client-reference-manifest.js");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const start = text.indexOf("=", text.indexOf("__RSC_MANIFEST[")) + 1;
  return JSON.parse(text.slice(start).replace(/;\s*$/, ""));
}
const home = manifestFor("");
if (!home) fail(`no ${dir}/server/app/page_client-reference-manifest.js`);

const clean = (f) => f.replace(/^\/?_next\//, "");
let layoutChunks = null;
// Turbopack lists each entry's chunks; the layout's are the ones every page shares.
const entry = home.entryJSFiles && Object.keys(home.entryJSFiles).find((k) => /\/app\/layout$/.test(k));
if (entry) layoutChunks = home.entryJSFiles[entry];
// Webpack lists chunks per client module; the Shell is mounted by the root layout.
if (!layoutChunks) {
  const shell = Object.entries(home.clientModules ?? {}).find(([k]) => k.endsWith("/components/shell.tsx"));
  if (shell) layoutChunks = shell[1].chunks;
}
if (!layoutChunks) fail("cannot find the root layout's chunks in the client reference manifest");
for (const f of layoutChunks.map(clean)) if (f.endsWith(".js")) shared.add(f);

let total = 0;
const rows = [];
for (const f of shared) {
  const path = join(dir, f);
  if (!existsSync(path)) fail(`${f} is listed in the manifest but not on disk`);
  const gz = gzipSync(readFileSync(path)).length;
  total += gz;
  rows.push([gz, f]);
}
rows.sort((a, b) => b[0] - a[0]);
for (const [gz, f] of rows.slice(0, 8)) console.log(`  ${(gz / 1024).toFixed(1).padStart(6)} KB  ${f}`);
const kb = total / 1024;
console.log(`shared client JS: ${kb.toFixed(1)} KB gzipped in ${shared.size} files (budget ${maxKb} KB)`);
if (kb > maxKb) fail(`over budget by ${(kb - maxKb).toFixed(1)} KB. Load something later (next/dynamic, a lazy import) instead of raising the number.`);
