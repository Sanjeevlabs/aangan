import { beforeEach, describe, expect, it } from "vitest";
import { GET as albumsGet, POST as albumsPost } from "@/app/api/albums/route";
import { GET as placesGet, POST as placesPost } from "@/app/api/places/route";
import { EVENT_WINDOW_MS, eventFromText, fileCard } from "@/lib/albums";
import type { Album, Place } from "@/lib/kinds";
import { coordsFromLink } from "@/components/neighbourhood";
import { suggestFromWords } from "@/lib/places";
import { CaptionSchema } from "@/lib/schemas";
import { addCard, resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (url: string, member: string, body?: unknown) =>
  new Request(`http://test${url}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;
let n = 0;
const photo = (caption: string, takenAt: string) => addCard({ id: `test-photo-${++n}`, familyId: "demo-family", type: "photo", caption, lang: "en", takenAt, authorId: "dadi" });

beforeEach(() => resetDemo());

describe("albums", () => {
  it("Muse's vision label is part of the caption JSON, and junk falls back to everyday", () => {
    expect(CaptionSchema.parse({ caption: "Kavya under the mandap", language: "en", takenAt: null, event: "wedding" }).event).toBe("wedding");
    expect(CaptionSchema.parse({ caption: "A warm family moment", language: "en", takenAt: null, event: "party-ish" }).event).toBe("everyday");
    expect(CaptionSchema.parse({ caption: "A warm family moment", language: "en", takenAt: null }).event).toBe("everyday");
  });

  it("files photos of the same moment together and starts a new album after the window", async () => {
    const a = photo("The mandap, all marigolds", "2026-02-12T10:00:00.000Z");
    const b = photo("Kavya and Rahul at the pheras", "2026-02-12T18:00:00.000Z");
    const later = photo("Another wedding", new Date(Date.parse("2026-02-12T18:00:00.000Z") + EVENT_WINDOW_MS * 3).toISOString());
    const first = await fileCard("demo-family", a, "wedding");
    const second = await fileCard("demo-family", b, "wedding");
    expect(second?.id).toBe(first?.id);
    expect(second?.cardIds).toEqual([a.id, b.id]);
    const third = await fileCard("demo-family", later, "wedding");
    expect(third?.id).not.toBe(first?.id);
    expect(await fileCard("demo-family", photo("Breakfast", "2026-02-13T08:00:00.000Z"), "everyday")).toBeNull();
    expect(eventFromText("Prayer at home with Dadi")).toBe("ritual");
    expect(eventFromText("दीये और रंगोली")).toBe("festival");
  });

  it("people fix albums: rename, cover, move, merge, remove, delete — and resort files older photos", async () => {
    const a = photo("Puja at home", "2026-03-01T09:00:00.000Z");
    const b = photo("Prayers, everyone together", "2026-03-01T09:20:00.000Z");
    const c = photo("A ceremony in the courtyard", "2026-03-20T09:00:00.000Z");
    const filed = await json<{ filed: number }>(albumsPost(req("/api/albums", "arjun", { action: "resort" })));
    expect(filed.filed).toBeGreaterThanOrEqual(3);
    let { albums } = await json<{ albums: Album[] }>(albumsGet(req("/api/albums", "arjun")));
    const march1 = albums.find((x) => x.cardIds.includes(a.id))!;
    const march20 = albums.find((x) => x.cardIds.includes(c.id))!;
    expect(march1.cardIds).toEqual(expect.arrayContaining([a.id, b.id]));
    const renamed = await json<{ album: Album }>(albumsPost(req("/api/albums", "dadi", { action: "rename", albumId: march1.id, title: "Satyanarayan puja" })));
    expect(renamed.album).toMatchObject({ title: "Satyanarayan puja", madeBy: "family", fixedBy: "dadi" });
    expect((await albumsPost(req("/api/albums", "dadi", { action: "cover", albumId: march1.id, cardId: b.id }))).status).toBe(200);
    await albumsPost(req("/api/albums", "dadi", { action: "move", albumId: march1.id, cardId: b.id, toAlbumId: march20.id }));
    await albumsPost(req("/api/albums", "dadi", { action: "merge", albumId: march20.id, intoAlbumId: march1.id }));
    ({ albums } = await json<{ albums: Album[] }>(albumsGet(req("/api/albums", "arjun"))));
    const merged = albums.find((x) => x.id === march1.id)!;
    expect(merged.cardIds).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
    expect(albums.some((x) => x.id === march20.id)).toBe(false);
    await albumsPost(req("/api/albums", "dadi", { action: "remove", albumId: march1.id, cardId: c.id }));
    expect((await json<{ deleted: string }>(albumsPost(req("/api/albums", "dadi", { action: "delete", albumId: march1.id })))).deleted).toBe(march1.id);
  });
});

describe("around home", () => {
  it("reads Google Maps links and plain coordinates", () => {
    expect(coordsFromLink("https://www.google.com/maps/place/X/@26.4499,80.3319,17z")).toEqual({ lat: 26.4499, lng: 80.3319 });
    expect(coordsFromLink("https://maps.google.com/?q=26.45,80.33")).toEqual({ lat: 26.45, lng: 80.33 });
    expect(coordsFromLink("26.45, 80.33")).toEqual({ lat: 26.45, lng: 80.33 });
    expect(coordsFromLink("near the temple")).toBeNull();
  });

  it("suggests only places the family itself mentions, quoting them", () => {
    const s = suggestFromWords(["Imran bhai knows the way to the temple and the clinic.", "मैं सात साल की थी, गाँव में मेला लगा था।"], ["The temple at the corner"]);
    expect(s.map((x) => x.name)).toEqual(expect.arrayContaining(["The clinic", "The mela ground"]));
    expect(s.some((x) => x.kind === "temple")).toBe(false);
    for (const x of s) expect(x.quote.length).toBeGreaterThan(5);
  });

  it("add → attach a memory → edit → delete; children can't change places", async () => {
    const d = await json<{ places: Place[]; suggestions: { name: string }[] }>(placesGet(req("/api/places?near=dadi", "arjun")));
    expect(d.places.map((p) => p.id)).toEqual(expect.arrayContaining(["place-temple", "place-kirana", "place-courtyard"]));
    expect(d.places.every((p) => p.nearMemberId === "dadi")).toBe(true);
    expect(d.suggestions.length).toBeGreaterThan(0);
    const added = await json<{ place: Place }>(placesPost(req("/api/places", "priya", { action: "add", nearMemberId: "dada", name: "The tea stall", kind: "tea-stall", lat: 26.45, lng: 80.33 })));
    expect(added.place).toMatchObject({ nearMemberId: "dada", lat: 26.45, addedBy: "priya" });
    const att = await json<{ place: Place }>(placesPost(req("/api/places", "dadi", { action: "attach", placeId: added.place.id, cardId: "demo-years-2" })));
    expect(att.place.cardIds).toEqual(["demo-years-2"]);
    expect((await placesPost(req("/api/places", "aria", { action: "edit", placeId: added.place.id, name: "Mine", kind: "other" }))).status).toBe(403);
    expect((await placesPost(req("/api/places", "kavya", { action: "delete", placeId: added.place.id }))).status).toBe(403);
    expect((await placesPost(req("/api/places", "priya", { action: "delete", placeId: added.place.id }))).status).toBe(200);
    expect((await placesPost(req("/api/places", "arjun", { action: "add", nearMemberId: "dadi", name: "X", kind: "other", lat: 200, lng: 0 }))).status).toBe(400);
  });
});
