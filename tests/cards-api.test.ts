import { beforeEach, describe, expect, it } from "vitest";
import { GET as getCards, POST as postCard } from "@/app/api/cards/route";
import { GET as getMembers } from "@/app/api/members/route";
import { POST as postHomeImage } from "@/app/api/members/home-image/route";
import { getMember, listCards, resetDemo } from "@/lib/store";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cards API (mock store)", () => {
  beforeEach(() => resetDemo());

  it("POST validates, stores with defaults, and GET lists", async () => {
    const res = await postCard(
      jsonRequest("http://test/api/cards", {
        type: "photo",
        caption: "Courtyard light",
        lang: "en",
        takenAt: "2026-10-27T10:00:00.000Z",
        source: "today",
        mediaRef: "media-1",
        peaks: [],
        palette: ["#ff0000"],
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as { card: { id: string; source: string } };
    expect(created.card.id).toBeTruthy();

    const listed = (await (await getCards()).json()) as { cards: { id: string }[] };
    expect(listed.cards.some((c) => c.id === created.card.id)).toBe(true);
    expect(listCards().find((c) => c.id === created.card.id)?.source).toBe("today");
  });

  it("POST rejects invalid payloads and malformed JSON", async () => {
    const bad = await postCard(jsonRequest("http://test/api/cards", { type: "photo", takenAt: "soon" }));
    expect(bad.status).toBe(400);
    const malformed = await postCard(
      new Request("http://test/api/cards", { method: "POST", body: "{oops" }),
    );
    expect(malformed.status).toBe(400);
  });
});

describe("members API (mock store)", () => {
  beforeEach(() => resetDemo());

  it("GET lists the seeded demo family with Dadi as elder", async () => {
    const data = (await (await getMembers()).json()) as {
      members: { id: string; role: string }[];
      family: { id: string };
    };
    expect(data.family.id).toBe("demo-family");
    expect(data.members).toHaveLength(4);
    expect(data.members.find((m) => m.id === "dadi")?.role).toBe("elder");
  });

  it("POST home-image updates the member and rejects unknown members", async () => {
    const res = await postHomeImage(
      jsonRequest("http://test/api/members/home-image", {
        memberId: "leo",
        mediaRef: "home-1",
        palette: ["#ff0000", "#00ff00", "#0000ff"],
      }),
    );
    expect(res.status).toBe(200);
    expect(getMember("leo")?.homeImageRef).toBe("home-1");

    const missing = await postHomeImage(
      jsonRequest("http://test/api/members/home-image", { memberId: "nobody", mediaRef: "x" }),
    );
    expect(missing.status).toBe(404);
  });
});
