// One-off Muse Image generation for the fallback courtyard photo.
// Precursor of the M6 seed script. Generates ONCE into public/demo/.
// Usage: node scripts/gen-courtyard.mjs
// The key comes from META_API_KEY in the environment (or .env.local); it is
// never printed, logged, or written anywhere by this script.
import { mkdirSync, readFileSync, writeFileSync } from "fs";

function loadDotEnvLocal() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — environment only.
  }
  return env;
}

const env = loadDotEnvLocal();
const key = env.META_API_KEY;
if (!key) {
  console.error("META_API_KEY is missing. Nothing was called.");
  process.exit(2);
}

const MODEL = "muse-image-1.0"; // mirrors PROVIDERS.meta.imageModel in lib/config.ts
const PROMPT =
  "Photorealistic warm sunlit traditional courtyard at morning: an arched wooden doorway, " +
  "weathered plaster walls, potted plants, soft golden light and gentle shadows. " +
  "No people, no animals, no text, no house numbers, no street signs. Cozy, quiet, timeless.";

const startedAt = new Date().toISOString();
const res = await fetch("https://api.meta.ai/v1/images/generations", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
  body: JSON.stringify({ model: MODEL, prompt: PROMPT, size: "1024x1024", n: 1 }),
});
if (!res.ok) {
  console.error(`image request failed: provider-http-${res.status}`);
  process.exit(1);
}

const data = await res.json();
const first = data?.data?.[0];
let bytes;
if (typeof first?.b64_json === "string") {
  bytes = Buffer.from(first.b64_json, "base64");
} else if (typeof first?.url === "string") {
  const dl = await fetch(first.url);
  if (!dl.ok) {
    console.error(`image download failed: provider-http-${dl.status}`);
    process.exit(1);
  }
  bytes = Buffer.from(await dl.arrayBuffer());
} else {
  console.error(`unexpected image payload keys: ${Object.keys(data).join(",")}`);
  process.exit(1);
}

mkdirSync("public/demo", { recursive: true });
writeFileSync("public/demo/courtyard.jpg", bytes);

// llm_calls record: only metadata + cost/usage as returned by the provider.
const usage = data.usage ?? null;
const record = {
  at: startedAt,
  model: MODEL,
  purpose: "fallback-courtyard",
  bytes: bytes.length,
  usage,
  cost_usd: typeof data.cost_usd === "number" ? data.cost_usd : null,
};
console.log(`llm_calls ${JSON.stringify(record)}`);
console.log(`saved public/demo/courtyard.jpg (${bytes.length} bytes)`);
