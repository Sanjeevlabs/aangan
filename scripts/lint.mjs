// Cheap lint: secret scan + no hard-coded festivals in app logic.
// Run: npm run lint
import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Only quoted literal assignments count (e.g. KEY="value"). Test code that
// shuffles process.env around is not a secret.
const SECRET_PATTERNS = [/sk-[A-Za-z0-9]{8,}/, /AKIA[0-9A-Z]{16}/, /META_API_KEY\s*=\s*["'][A-Za-z0-9_\-]{8,}["']/];
const FESTIVALS = ["diwali", "christmas", "eid", "hanukkah", "thanksgiving", "lunar new year"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".hg", ".sl", ".eden"]);

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|js|mjs|json|sql|yml|md)$/.test(name)) out.push(p);
  }
  return out;
}

let failures = 0;
for (const f of files(ROOT)) {
  const rel = f.replace(ROOT, "");
  if (rel.includes(".env.local") || rel.includes("session.jsonl")) continue;
  const text = readFileSync(f, "utf8");
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(text) && !rel.endsWith(".example") && !rel.endsWith("lint.mjs") && !rel.endsWith("AGENTS.md")) {
      console.error(`secret pattern in ${rel}: ${pat}`);
      failures++;
    }
  }
  // Festival names belong in rituals/ configs, docs, or tests — never in lib/ or app/ logic.
  // Seed data may reference a config slug via ritualSlug; that is data, not logic.
  if (/^(lib|app)\//.test(rel.replace(/\\/g, "/"))) {
    const lines = text.split("\n").filter((l) => !/ritualSlug/.test(l));
    const code = lines.join("\n").toLowerCase();
    for (const fest of FESTIVALS) {
      if (code.includes(fest)) {
        console.error(`hard-coded festival "${fest}" in ${rel}`);
        failures++;
      }
    }
  }
}

// Public repo: no business strategy, money plans or competitor talk in tracked files.
// (The private spec lives outside the repo; docs/private/ is gitignored.)
const PRIVATE_TOPICS = /\b(commission|revenue|monetis|monetiz|competitor|investor|paywall|unit economics|go-to-market|family plus)\b|[₹$]\s?\d[\d,.]*\s?(\/|per |a )(month|year|mo|yr)\b/i;
for (const f of files(ROOT)) {
  const rel = f.replace(ROOT, "").replace(/^[\\/]/, "");
  if (/^(docs[\\/]private|android|ios)[\\/]/.test(rel) || rel === "scripts/lint.mjs" || rel.includes(".env.local")) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (PRIVATE_TOPICS.test(line)) {
      console.error(`${rel}:${i + 1}: private topic in a public repo (strategy, money plans, competitors): ${line.trim().slice(0, 100)}`);
      failures++;
    }
  });
}

// Dependency allowlist: a new package is a decision, not a side effect.
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const allow = JSON.parse(readFileSync(join(ROOT, "scripts/deps-allowlist.json"), "utf8"));
for (const sec of ["dependencies", "devDependencies"]) {
  for (const name of Object.keys(pkg[sec] ?? {})) {
    if (!allow[sec]?.[name]) {
      console.error(`package.json ${sec}: "${name}" is not in scripts/deps-allowlist.json (add it with the reason, or remove it)`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`${failures} lint failure(s)`);
  process.exit(1);
}
console.log("lint ok: no secrets, no hard-coded festivals in app logic, dependencies on the allowlist, no private topics");
