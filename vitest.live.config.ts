import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

// Live-only config: inherits the real process environment (MOCK must not be
// "true") and runs just the gated live suites. Mock runs keep using
// vitest.config.ts, which forces MOCK=true — that forced flag overrides the
// outer environment, so the default config can never go live.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["tests/golden.eval.test.ts", "tests/live-cache.test.ts"],
  },
});
