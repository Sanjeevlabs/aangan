import { describe, expect, it } from "vitest";
import { dateSourceUsed, resolveTakenAt } from "@/lib/dating";
import { groundedNames } from "@/lib/grounding";
import { captionCard, memoryStore } from "@/lib/llm";
import { GOLDEN } from "./fixtures/golden";

// Manual live eval. Skipped by default and never in CI.
// Run: npm run eval:golden   (requires META_API_KEY)
const RUN = process.env.RUN_GOLDEN === "1" && !!process.env.META_API_KEY;

describe.skipIf(!RUN)("golden eval (live)", () => {
  it("prints a pass/fail table plus cost", { timeout: 180000 }, async () => {
    let totalCost = 0;
    const rows: string[] = [];
    for (const g of GOLDEN) {
      const store = memoryStore();
      const { caption, cost } = await captionCard(g.prompt, { mediaId: g.id, store });
      totalCost += cost;
      const takenAt = resolveTakenAt({
        exifDate: g.exifDate,
        fileModifiedAt: g.fileModifiedAt,
        modelDate: caption.takenAt,
      });
      const checks = {
        schema: caption.caption.length >= 10 && caption.caption.length <= 280,
        lang: caption.language.startsWith(g.expectLang),
        names: groundedNames(caption.names, g.taggedMembers),
        date: dateSourceUsed({ exifDate: g.exifDate, fileModifiedAt: g.fileModifiedAt, modelDate: caption.takenAt }) === g.expectDateSource || !!takenAt,
      };
      const pass = Object.values(checks).every(Boolean);
      rows.push(`${pass ? "PASS" : "FAIL"}  ${g.id}  ${JSON.stringify(checks)}`);
      expect(pass, `${g.id} failed: ${JSON.stringify(checks)}`).toBe(true);
    }
    console.log(["case result checks", ...rows, `total cost: $${totalCost.toFixed(2)}`].join("\n"));
  });
});
