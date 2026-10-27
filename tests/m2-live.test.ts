import { describe, expect, it } from "vitest";
import { suggestQuestions, translateText } from "@/lib/llm";

// Live M2 verification. Skipped by default and never in CI.
// Run: RUN_M2_LIVE=1 META_API_KEY=... npx vitest run tests/m2-live.test.ts
// (reads the key from the environment only; MOCK is cleared in-test).
const RUN = process.env.RUN_M2_LIVE === "1" && !!process.env.META_API_KEY;

describe.skipIf(!RUN)("m2 live verification (manual)", () => {
  it("translate + suggest via muse-spark-1.3", { timeout: 90000 }, async () => {
    process.env.MOCK = "";
    const { translation, cost: c1 } = await translateText("सुबह की दुआ — आज का दिन अच्छा हो।", "en");
    const { questions, cost: c2 } = await suggestQuestions({ memberId: "dadi", displayLang: "en" });
    const total = c1 + c2;
    console.log(`m2 live cost: $${total.toFixed(2)} (translate $${c1.toFixed(2)} + suggest $${c2.toFixed(2)})`);
    expect(translation.text.length).toBeGreaterThan(0);
    expect(/[\u0900-\u097F]/.test(translation.text)).toBe(false);
    expect(questions.length).toBeGreaterThanOrEqual(1);
  });
});
