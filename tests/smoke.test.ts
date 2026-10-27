import { describe, expect, it } from "vitest";
import { resolveTakenAt } from "@/lib/dating";
import { captionCard, memoryStore } from "@/lib/llm";
import { addCard, clearCards, listCards } from "@/lib/store";
import { validateUpload } from "@/lib/uploads";

describe("end-to-end smoke (mock mode)", () => {
  it("an upload becomes a card visible on the timeline", async () => {
    clearCards();
    const err = validateUpload({ kind: "photo", bytes: 1024 * 1024, mime: "image/jpeg" });
    expect(err).toBeNull();

    const { caption } = await captionCard("a family dinner photo", {
      mediaId: "smoke-1",
      store: memoryStore(),
    });
    addCard({
      id: "smoke-1",
      familyId: "demo-family",
      type: "photo",
      caption: caption.caption,
      summary: "",
      lang: caption.language,
      takenAt: resolveTakenAt({ fileModifiedAt: "2026-10-27T10:00:00.000Z", modelDate: caption.takenAt }),
      ritualSlug: null,
    });

    const timeline = listCards();
    expect(timeline.some((c) => c.id === "smoke-1")).toBe(true);
  });
});
