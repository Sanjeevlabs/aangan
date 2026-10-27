// Manual live eval runner. Never run in CI.
// Usage: npm run eval:golden   (requires META_API_KEY in the environment)
import { spawnSync } from "child_process";

if (!process.env.META_API_KEY) {
  console.error("eval:golden needs META_API_KEY in the environment. Nothing was called.");
  process.exit(2);
}
const r = spawnSync("npx", ["vitest", "run", "tests/golden.eval.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, RUN_GOLDEN: "1", MOCK: "" },
});
process.exit(r.status ?? 1);
