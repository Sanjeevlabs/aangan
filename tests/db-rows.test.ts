import { describe, expect, it } from "vitest";
import { cardFromRow, iso } from "@/lib/db";

describe("live Postgres rows", () => {
  it("normalises Postgres timestamp formats to canonical UTC", () => {
    expect(iso("2026-10-27T08:10:00+00:00")).toBe("2026-10-27T08:10:00.000Z");
    expect(iso("2026-10-27 08:10:00+00")).toBe("2026-10-27T08:10:00.000Z");
    expect(iso("2026-10-27T13:40:00+05:30")).toBe("2026-10-27T08:10:00.000Z");
    expect(iso(new Date("2026-10-27T08:10:00Z"))).toBe("2026-10-27T08:10:00.000Z");
  });

  it("parses a card row exactly as Supabase returns it", () => {
    const card = cardFromRow({ id: "c1", family_id: "f1", type: "audio", caption: "Hello there, family", taken_at: "2026-10-27T08:10:00.123456+00:00" });
    expect(card.takenAt).toBe("2026-10-27T08:10:00.123Z");
  });
});
