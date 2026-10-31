import { beforeEach, describe, expect, it } from "vitest";
import { POST as postCard } from "@/app/api/cards/route";
import { DELETE as deleteLine, GET as getLines, POST as postLine } from "@/app/api/day-line/route";
import { GET as getReactions, POST as postReaction } from "@/app/api/reactions/route";
import { endOfLocalDay, liveLines, resetDayLineLimits } from "@/lib/day-line";
import { putDoc, resetDocs } from "@/lib/family-docs";
import { printNote, printWhen, printWhere } from "@/lib/print";
import { reactorsText, toggleReaction } from "@/lib/reaction-names";
import { CardSchema, CreateCardRequestSchema, type Reaction } from "@/lib/schemas";
import { listCards, listMembers, resetDemo } from "@/lib/store";
import { authedGet, authedJson, sessionCookie } from "./auth-helper";

const base = { id: "c1", familyId: "demo-family", type: "photo", caption: "Chai on the steps", lang: "en", takenAt: "2026-10-26T02:10:00.000Z" } as const;

describe("CardSchema place and note", () => {
  it("default to empty strings for old rows", () => {
    const card = CardSchema.parse(base);
    expect(card.place).toBe("");
    expect(card.note).toBe("");
  });

  it("keep place to 60 and note to 140 characters", () => {
    expect(CardSchema.safeParse({ ...base, place: "x".repeat(60), note: "y".repeat(140) }).success).toBe(true);
    expect(CardSchema.safeParse({ ...base, place: "x".repeat(61) }).success).toBe(false);
    expect(CardSchema.safeParse({ ...base, note: "y".repeat(141) }).success).toBe(false);
  });

  it("the create request trims both before checking the limit", () => {
    const parsed = CreateCardRequestSchema.parse({ type: "photo", takenAt: base.takenAt, place: "  Amritsar  ", note: `  ${"n".repeat(140)}  ` });
    expect(parsed.place).toBe("Amritsar");
    expect(parsed.note).toHaveLength(140);
    expect(CreateCardRequestSchema.parse({ type: "photo", takenAt: base.takenAt }).place).toBe("");
  });
});

describe("POST /api/cards with place and note", () => {
  beforeEach(() => resetDemo());

  it("stores them on the card", async () => {
    const res = await postCard(authedJson("http://test/api/cards", { type: "photo", caption: "Morning", takenAt: base.takenAt, place: " Amritsar ", note: "Tulsi watered, chai on." }));
    expect(res.status).toBe(201);
    const { card } = (await res.json()) as { card: { id: string } };
    const stored = listCards().find((c) => c.id === card.id);
    expect(stored?.place).toBe("Amritsar");
    expect(stored?.note).toBe("Tulsi watered, chai on.");
  });

  it("rejects a note over 140 characters", async () => {
    const res = await postCard(authedJson("http://test/api/cards", { type: "photo", takenAt: base.takenAt, note: "y".repeat(141) }));
    expect(res.status).toBe(400);
  });
});

describe("what's written on the print", () => {
  const maa = { city: "Amritsar", tz: "Asia/Kolkata" };
  it("when is in the sharer's zone, with the year only for other years", () => {
    const now = new Date("2026-10-31T06:00:00.000Z");
    expect(printWhen("2026-10-26T02:10:00.000Z", "Asia/Kolkata", now)).toBe("Mon, 26 Oct · 7:40 AM");
    expect(printWhen("2021-10-27T09:15:00.000Z", "Asia/Kolkata", now)).toBe("Wed, 27 Oct 2021 · 2:45 PM");
  });
  it("where falls back to the home city, then the zone, then nothing", () => {
    expect(printWhere({ place: "Golden lane" }, maa)).toBe("Golden lane");
    expect(printWhere({ place: "" }, maa)).toBe("Amritsar");
    expect(printWhere({ place: "" }, { city: "", tz: "UTC" })).toBe("");
    expect(printWhere({ place: "" }, null)).toBe("");
  });
  it("the note falls back to the caption", () => {
    expect(printNote({ note: "", caption: "Diyas lit" })).toBe("Diyas lit");
    expect(printNote({ note: "For Anika", caption: "Diyas lit" })).toBe("For Anika");
  });
});

describe("a line about today (/api/day-line)", () => {
  beforeEach(() => {
    resetDemo();
    resetDocs();
    resetDayLineLimits();
  });

  const del = (memberId: string, body: unknown = {}) =>
    new Request("http://test/api/day-line", { method: "DELETE", headers: { "content-type": "application/json", cookie: sessionCookie(memberId) }, body: JSON.stringify(body) });

  it("needs a session", async () => {
    expect((await getLines(new Request("http://test/api/day-line"))).status).toBe(401);
    expect((await postLine(new Request("http://test/api/day-line", { method: "POST", body: JSON.stringify({ text: "hi" }) }))).status).toBe(401);
  });

  it("writes the line as the session member and shows it to the family", async () => {
    const res = await postLine(authedJson("http://test/api/day-line", { text: "  At the temple with Papa  " }, "dadi"));
    expect(res.status).toBe(201);
    const { lines } = (await (await getLines(authedGet("http://test/api/day-line", "arjun"))).json()) as { lines: { memberId: string; text: string; until: string }[] };
    expect(lines).toEqual([expect.objectContaining({ memberId: "dadi", text: "At the temple with Papa" })]);
    expect(Date.parse(lines[0].until)).toBeGreaterThan(Date.now());
  });

  it("can't write or remove someone else's line", async () => {
    await postLine(authedJson("http://test/api/day-line", { text: "Walk by the canal" }, "dadi"));
    const forged = await postLine(authedJson("http://test/api/day-line", { text: "Not hers", memberId: "dadi" }, "arjun"));
    expect(forged.status).toBe(403);
    expect((await deleteLine(del("arjun", { memberId: "dadi" }))).status).toBe(403);
    // Arjun's own delete only takes down Arjun's line.
    expect((await deleteLine(del("arjun"))).status).toBe(200);
    const { lines } = (await (await getLines(authedGet("http://test/api/day-line", "dadi"))).json()) as { lines: { memberId: string; text: string }[] };
    expect(lines.map((l) => [l.memberId, l.text])).toEqual([["dadi", "Walk by the canal"]]);
  });

  it("replaces your line instead of keeping a history, and the author can take it down", async () => {
    await postLine(authedJson("http://test/api/day-line", { text: "First" }, "dadi"));
    await postLine(authedJson("http://test/api/day-line", { text: "Second" }, "dadi"));
    let { lines } = (await (await getLines(authedGet("http://test/api/day-line"))).json()) as { lines: { text: string }[] };
    expect(lines.map((l) => l.text)).toEqual(["Second"]);
    await deleteLine(del("dadi"));
    ({ lines } = (await (await getLines(authedGet("http://test/api/day-line"))).json()) as { lines: { text: string }[] });
    expect(lines).toEqual([]);
  });

  it("rejects empty and over-long lines", async () => {
    expect((await postLine(authedJson("http://test/api/day-line", { text: "   " }))).status).toBe(400);
    expect((await postLine(authedJson("http://test/api/day-line", { text: "x".repeat(81) }))).status).toBe(400);
  });

  it("is rate-limited", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await postLine(authedJson("http://test/api/day-line", { text: `Line ${i}` }))).status;
    expect(last).toBe(429);
  });

  it("stops showing after the author's local midnight", async () => {
    const noonIst = new Date("2026-10-31T06:30:00.000Z"); // 12:00 in Kolkata
    expect(endOfLocalDay("Asia/Kolkata", noonIst)).toBe("2026-10-31T18:30:00.000Z");
    await putDoc("demo-family", "day_line", { id: "dada", memberId: "dada", text: "Old line", until: "2026-10-01T18:30:00.000Z", createdAt: "2026-10-01T06:30:00.000Z" });
    const { lines } = (await (await getLines(authedGet("http://test/api/day-line"))).json()) as { lines: unknown[] };
    expect(lines).toEqual([]);
    expect(liveLines([{ until: "2026-10-31T18:30:00.000Z" }], Date.parse("2026-10-31T18:29:00.000Z"))).toHaveLength(1);
  });
});

describe("reactions show who", () => {
  beforeEach(() => resetDemo());

  it("a reaction (a child's too) comes back with who and which, and reads as names", async () => {
    const cardId = "demo-maa-morning";
    expect((await postReaction(authedJson("http://test/api/reactions", { cardId, memberId: "dada", kind: "bless" }, "dada"))).status).toBe(201);
    expect((await postReaction(authedJson("http://test/api/reactions", { cardId, memberId: "leo", kind: "love" }, "leo"))).status).toBe(201);
    const { reactions } = (await (await getReactions(authedGet(`http://test/api/reactions?cardId=${cardId}`, "arjun"))).json()) as { reactions: Reaction[] };
    expect(reactions.map((r) => [r.memberId, r.kind]).sort()).toEqual([
      ["dada", "bless"],
      ["leo", "love"],
    ]);
    const text = reactorsText(reactions, listMembers(), "arjun");
    expect(text).toContain("Papa 🙏");
    expect(text).toContain("Vihaan ❤️");
    expect(text).not.toMatch(/\d/);
  });

  it("tapping toggles: on shows you, same again takes it back, another replaces it", () => {
    const members = listMembers();
    let list: Reaction[] = [{ id: "r1", familyId: "demo-family", cardId: "c", memberId: "dadi", kind: "love", createdAt: "2026-10-30T03:00:00.000Z" }];
    list = toggleReaction(list, "arjun", "c", "bless", new Date("2026-10-30T04:00:00.000Z"));
    expect(reactorsText(list, members, "arjun")).toBe("Maa ❤️ · You 🙏");
    list = toggleReaction(list, "arjun", "c", "laugh");
    expect(reactorsText(list, members, "arjun")).toBe("Maa ❤️ · You 😊");
    list = toggleReaction(list, "arjun", "c", "laugh");
    expect(reactorsText(list, members, "arjun")).toBe("Maa ❤️");
  });
});
