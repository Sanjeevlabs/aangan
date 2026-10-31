// The Add sheet's photo/video path: bytes go to the bucket first, then the
// card arrives as multipart with the bucket ref. The card must keep that ref
// (otherwise the photo is gone on reload) and the photo's own date.
import { beforeEach, describe, expect, it } from "vitest";
import { POST as postCard } from "@/app/api/cards/route";
import { listCards, resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

// 1x1 PNG.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

function photoForm(fields: Record<string, string>): Request {
  const form = new FormData();
  form.append("type", "photo");
  form.append("caption", "Chai on the steps");
  form.append("lang", "en");
  form.append("takenAt", "2021-10-27T09:15:00.000Z");
  form.append("source", "upload");
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("media", new Blob([PNG], { type: "image/png" }), "media");
  return new Request("http://test/api/cards", { method: "POST", headers: { cookie: sessionCookie("arjun") }, body: form });
}

describe("POST /api/cards (multipart photo)", () => {
  beforeEach(() => resetDemo());

  it("keeps the uploaded media ref and the photo's EXIF date", async () => {
    const ref = "storage:demo-family/uploads/abc/chai.jpg";
    const res = await postCard(photoForm({ mediaRef: ref, takenAtSource: "exif" }));
    expect(res.status).toBe(201);
    const { card } = (await res.json()) as { card: { id: string } };
    const stored = listCards().find((c) => c.id === card.id);
    expect(stored?.mediaRef).toBe(ref);
    expect(stored?.takenAt).toBe("2021-10-27T09:15:00.000Z");
  });

  it("drops a ref outside the family's own uploads", async () => {
    for (const bad of ["storage:demo-iyer/uploads/abc/x.jpg", "storage:demo-family/../demo-iyer/uploads/x.jpg", "https://evil.test/x.jpg", "session-ref-123"]) {
      const res = await postCard(photoForm({ mediaRef: bad, takenAtSource: "exif" }));
      expect(res.status).toBe(201);
      const { card } = (await res.json()) as { card: { id: string } };
      expect(listCards().find((c) => c.id === card.id)?.mediaRef).toBeNull();
    }
  });

  it("without a camera date, the model's date may fill in (never the future)", async () => {
    const res = await postCard(photoForm({ mediaRef: "storage:demo-family/uploads/abc/chai.jpg", takenAtSource: "now" }));
    expect(res.status).toBe(201);
    const { card } = (await res.json()) as { card: { id: string } };
    const stored = listCards().find((c) => c.id === card.id);
    expect(Date.parse(stored?.takenAt ?? "")).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
