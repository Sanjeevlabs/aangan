import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Mock-only: no network, fixed test secrets (never real env).
    env: { MOCK: "true", SESSION_SECRET: "test-session-secret", CRON_SECRET: "test-cron-secret" },
  },
});
