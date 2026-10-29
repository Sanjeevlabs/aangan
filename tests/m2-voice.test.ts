import { beforeEach, describe, expect, it } from "vitest";
import { sessionCookie } from "./auth-helper";
import { GET as getPlays, POST as postPlay } from "@/app/api/plays/route";
import { GET as getReactions, POST as postReaction } from "@/app/api/reactions/route";
import { POST as postTranscribe } from "@/app/api/transcribe/route";
import { POST as postTranslate } from "@/app/api/translate/route";
import { GET as getSuggest } from "@/app/api/suggest/route";
import {
  addPlay,
  clearPlays,
  clearReactions,
  listPlays,
  listReactions,
  reactionKinds,
  resetDemo,
  setReaction,
} from "@/lib/store";
import {
  estimateSegments,
  formatHeardTime,
  heardLine,
  needsDisplayText,
  reactionLine,
} from "@/lib/voice";

const HAS_DEVANAGARI = /[\u0900-\u097F]/;

function jsonRequest(url: string, body: unknown, memberId = "dadi"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie(memberId) },
    body: JSON.stringify(body),
  });
}

function authedForm(url: string, form: FormData, memberId = "dadi"): Request {
  return new Request(url, { method: "POST", headers: { cookie: sessionCookie(memberId) }, body: form });
}

function authedGet(url: string, memberId = "dadi"): Request {
  return new Request(url, { headers: { cookie: sessionCookie(memberId) } });
}

describe("M2 Heard loop (plays)", () => {
  beforeEach(() => {
    resetDemo();
    clearPlays();
  });

  it("records a play and lists it newest-first per card", () => {
    addPlay({
      id: "p1",
      familyId: "demo-family",
      cardId: "demo-bday-1",
      memberId: "dadi",
      playedAt: "2026-10-28T09:14:00.000Z",
    });
    addPlay({
      id: "p2",
      familyId: "demo-family",
      cardId: "demo-bday-1",
      memberId: "leo",
      playedAt: "2026-10-28T09:15:00.000Z",
    });
    const plays = listPlays("demo-bday-1");
    expect(plays).toHaveLength(2);
    expect(plays[0].id).toBe("p2");
  });

  it("POST validates card + member and 404s unknowns", async () => {
    const ok = await postPlay(jsonRequest("http://test/api/plays", { cardId: "demo-bday-1", memberId: "dadi" }));
    expect(ok.status).toBe(201);
    const badCard = await postPlay(jsonRequest("http://test/api/plays", { cardId: "nope", memberId: "dadi" }));
    expect(badCard.status).toBe(404);
    const badMember = await postPlay(
      jsonRequest("http://test/api/plays", { cardId: "demo-bday-1", memberId: "nope" }, "nope"),
    );
    expect(badMember.status).toBe(401); // a session for someone not in the family is refused outright
    const crossMember = await postPlay(
      jsonRequest("http://test/api/plays", { cardId: "demo-bday-1", memberId: "leo" }, "dadi"),
    );
    expect(crossMember.status).toBe(403);
  });

  it("GET filters by card", async () => {
    await postPlay(jsonRequest("http://test/api/plays", { cardId: "demo-bday-1", memberId: "dadi" }));
    const data = (await (await getPlays(authedGet("http://test/api/plays?cardId=demo-bday-1"))).json()) as {
      plays: { cardId: string }[];
    };
    expect(data.plays.length).toBeGreaterThanOrEqual(1);
    expect(data.plays.every((p) => p.cardId === "demo-bday-1")).toBe(true);
  });

  it("formats the Heard chip deterministically per display_lang", () => {
    expect(formatHeardTime("2026-10-28T09:14:00.000Z")).toBe("09:14");
    const en = heardLine("Grandma", "2026-10-28T09:14:00.000Z", "en");
    expect(en).toBe("Grandma heard this · 09:14");
    const latn = heardLine("Dadi", "2026-10-28T09:14:00.000Z", "hi-latn");
    expect(HAS_DEVANAGARI.test(latn)).toBe(false);
    expect(latn).toContain("Dadi");
    const deva = heardLine("दादी", "2026-10-28T09:14:00.000Z", "hi-deva");
    expect(HAS_DEVANAGARI.test(deva)).toBe(true);
  });
});

describe("M2 reactions (Love, Laugh, Bless)", () => {
  beforeEach(() => {
    resetDemo();
    clearReactions();
  });

  it("offers exactly three kinds", () => {
    expect(reactionKinds()).toEqual(["love", "laugh", "bless"]);
  });

  it("one per member per card: a second reaction replaces the first, never counts", () => {
    setReaction({
      id: "r1",
      familyId: "demo-family",
      cardId: "demo-bday-1",
      memberId: "leo",
      kind: "love",
      createdAt: "2026-10-28T09:00:00.000Z",
    });
    setReaction({
      id: "r2",
      familyId: "demo-family",
      cardId: "demo-bday-1",
      memberId: "leo",
      kind: "laugh",
      createdAt: "2026-10-28T09:01:00.000Z",
    });
    const all = listReactions("demo-bday-1");
    expect(all).toHaveLength(1);
    expect(all[0].kind).toBe("laugh");
  });

  it("POST dedupes per member and 404s unknowns", async () => {
    const first = await postReaction(
      jsonRequest("http://test/api/reactions", { cardId: "demo-bday-1", memberId: "leo", kind: "love" }, "leo"),
    );
    expect(first.status).toBe(201);
    const second = await postReaction(
      jsonRequest("http://test/api/reactions", { cardId: "demo-bday-1", memberId: "leo", kind: "bless" }, "leo"),
    );
    expect(second.status).toBe(201);
    const data = (await (
      await getReactions(authedGet("http://test/api/reactions?cardId=demo-bday-1", "leo"))
    ).json()) as { reactions: { kind: string }[] };
    expect(data.reactions).toHaveLength(1);
    expect(data.reactions[0].kind).toBe("bless");
    const badKind = await postReaction(
      jsonRequest("http://test/api/reactions", { cardId: "demo-bday-1", memberId: "leo", kind: "wow" }, "leo"),
    );
    expect(badKind.status).toBe(400);
  });

  it("renders as text per display_lang, hi-latn never Devanagari", () => {
    expect(reactionLine("Leo", "laugh", "en")).toBe("Leo laughed at this");
    expect(reactionLine("Dadi", "bless", "en")).toBe("Dadi blessed this");
    const latn = reactionLine("Dadi", "bless", "hi-latn");
    expect(HAS_DEVANAGARI.test(latn)).toBe(false);
    expect(latn).toContain("Dadi");
    expect(HAS_DEVANAGARI.test(reactionLine("दादी", "bless", "hi-deva"))).toBe(true);
  });
});

describe("M2 synced lyrics estimator", () => {
  it("splits sentences, covers the full duration in order", () => {
    const segs = estimateSegments("First line here. Second line follows along!", 12);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    expect(segs[0].start).toBe(0);
    expect(segs[segs.length - 1].end).toBe(12);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeGreaterThanOrEqual(segs[i - 1].start);
    }
  });

  it("handles empty and single-line transcripts", () => {
    expect(estimateSegments("   ", 10)).toEqual([]);
    const one = estimateSegments("One warm line.", 9);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ start: 0, end: 9 });
  });
});

describe("M2 display_lang gating", () => {
  it("en needs translation only for Devanagari; hi-latn transliterates Devanagari", () => {
    expect(needsDisplayText("सुबह की दुआ।", "hi", "en")).toBe(true);
    expect(needsDisplayText("Good morning.", "en", "en")).toBe(false);
    expect(needsDisplayText("सुबह की दुआ।", "hi", "hi-latn")).toBe(true);
    expect(needsDisplayText("Good morning.", "en", "hi-latn")).toBe(false);
    expect(needsDisplayText("Good morning.", "en", "hi-deva")).toBe(true);
    expect(needsDisplayText("सुबह की दुआ।", "hi", "hi-deva")).toBe(false);
  });
});

describe("M2 model routes (mock mode)", () => {
  it("transcribe validates and returns schema-valid segments", async () => {
    const form = new FormData();
    form.append("audio", new Blob([new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4])], { type: "audio/wav" }), "voice.wav");
    form.append("langHint", "en");
    const res = await postTranscribe(authedForm("http://test/api/transcribe", form));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      transcript: { transcript: string; segments: { start: number; end: number; text: string }[] };
    };
    expect(data.transcript.transcript.length).toBeGreaterThan(0);
    const missing = await postTranscribe(authedForm("http://test/api/transcribe", new FormData()));
    expect(missing.status).toBe(400);
  });

  it("translate validates and never leaks script", async () => {
    const res = await postTranslate(
      jsonRequest("http://test/api/translate", { text: "परिवार ने मिलकर जन्मदिन का गीत गाया।", targetLang: "en" }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { translation: { text: string; language: string } };
    expect(HAS_DEVANAGARI.test(data.translation.text)).toBe(false);
    const bad = await postTranslate(jsonRequest("http://test/api/translate", { text: "", targetLang: "en" }));
    expect(bad.status).toBe(400);
  });

  it("suggest returns localized questions per display_lang", async () => {
    for (const displayLang of ["en", "hi-latn", "hi-deva"]) {
      const res = await getSuggest(authedGet(`http://test/api/suggest?memberId=dadi&displayLang=${displayLang}`));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { questions: string[]; displayLang: string };
      expect(data.displayLang).toBe(displayLang);
      expect(data.questions.length).toBeGreaterThanOrEqual(1);
      if (displayLang === "hi-latn") {
        for (const q of data.questions) expect(HAS_DEVANAGARI.test(q)).toBe(false);
      }
    }
  });
});
