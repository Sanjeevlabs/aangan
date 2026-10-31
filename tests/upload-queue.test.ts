import { describe, expect, it } from "vitest";
import { POST as postCard } from "@/app/api/cards/route";
import { resetDemo, listCards } from "@/lib/store";
import { BACKOFF_MS, MAX_TRIES, createUploadQueue, makeSender, memoryStore, type QueueItem, type Send } from "@/lib/upload-queue";
import { sessionCookie } from "./auth-helper";

const ID = "7b0d1c52-3a55-4a5e-9d0a-2f4e5b6c7d8e";
const item = (id = ID): Omit<QueueItem, "tries" | "nextAt"> => ({ id, json: { type: "audio", takenAt: "2026-10-27T10:00:00.000Z" } });

function rig(send: Send, store = memoryStore()) {
  const clock = { t: 1_000_000 };
  const q = createUploadQueue({ store, send, now: () => clock.t, setTimer: () => 0, clearTimer: () => undefined });
  return { q, store, clock };
}

describe("upload queue", () => {
  it("sends once and clears the store", async () => {
    const { q, store } = rig(async () => "ok");
    expect(await q.enqueue(item())).toBe("sent");
    expect(await store.all()).toHaveLength(0);
    expect(q.status(ID)).toBe("sent");
  });

  it("keeps a failed item, backs off 1s/3s/9s/27s, and stops after 5 tries", async () => {
    let calls = 0;
    const { q, store, clock } = rig(async () => (++calls, "retry"));
    expect(await q.enqueue(item())).toBe("queued");
    expect(calls).toBe(1);
    expect((await store.all())[0].nextAt - clock.t).toBe(BACKOFF_MS[0]);
    await q.flush(); // not due yet
    expect(calls).toBe(1);
    const waits: number[] = [];
    for (let i = 1; i < MAX_TRIES; i++) {
      clock.t += 100_000;
      await q.flush();
      waits.push((await store.all())[0].nextAt - clock.t);
    }
    expect(calls).toBe(MAX_TRIES);
    expect(waits.slice(0, 3)).toEqual([3000, 9000, 27000]);
    expect(q.status(ID)).toBe("failed");
    clock.t += 1_000_000;
    await q.flush();
    expect(calls).toBe(MAX_TRIES); // no more automatic tries
    expect(await store.all()).toHaveLength(1); // but nothing is lost
  });

  it("resume() sends leftovers from an earlier session, even ones that used up their tries", async () => {
    const store = memoryStore();
    await store.put({ ...item(), tries: MAX_TRIES, nextAt: 0 });
    const sent: string[] = [];
    const { q } = rig(async (i) => (sent.push(i.id), "ok"), store);
    await q.resume();
    expect(sent).toEqual([ID]);
    expect(await store.all()).toHaveLength(0);
  });

  it("dedupes the same id and drops items the server refuses", async () => {
    let calls = 0;
    const { q, store } = rig(async () => (++calls, "retry"));
    await q.enqueue(item());
    await q.enqueue(item());
    expect(await store.all()).toHaveLength(1);
    const drop = rig(async () => "drop");
    expect(await drop.q.enqueue(item())).toBe("dropped");
    expect(await drop.store.all()).toHaveLength(0);
  });

  it("sender: network error retries, 400 drops, same id every try, follow-ups only on a retry", async () => {
    const bodies: string[] = [];
    const hits: string[] = [];
    let fail = true;
    const f = (async (url: string, init?: RequestInit) => {
      hits.push(url);
      if (url === "/api/cards") {
        bodies.push(String(init?.body));
        if (fail) throw new TypeError("offline");
        return new Response("{}", { status: 201 });
      }
      return new Response("{}");
    }) as unknown as typeof fetch;
    const send = makeSender(f);
    const base: QueueItem = { ...item(), tries: 0, nextAt: 0, after: [{ url: "/api/wishes", body: {} }] };
    const save = async () => undefined;
    expect(await send(base, save)).toBe("retry");
    fail = false;
    expect(await send({ ...base, tries: 0 }, save)).toBe("ok");
    expect(hits).not.toContain("/api/wishes");
    expect(await send({ ...base, tries: 1 }, save)).toBe("ok");
    expect(hits).toContain("/api/wishes");
    expect(bodies.every((b) => JSON.parse(b).id === ID)).toBe(true);
    const bad = makeSender((async () => new Response("{}", { status: 400 })) as unknown as typeof fetch);
    expect(await bad(base, save)).toBe("drop");
    const down = makeSender((async () => new Response("{}", { status: 503 })) as unknown as typeof fetch);
    expect(await down(base, save)).toBe("retry");
  });
});

describe("POST /api/cards with a client id", () => {
  it("a retry after a lost response does not duplicate the card (JSON and multipart)", async () => {
    resetDemo();
    const json = () =>
      new Request("http://test/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie() },
        body: JSON.stringify({ id: ID, type: "audio", caption: "hi", takenAt: "2026-10-27T10:00:00.000Z" }),
      });
    expect((await postCard(json())).status).toBe(201);
    expect((await postCard(json())).status).toBe(200);
    expect(listCards().filter((c) => c.id === ID)).toHaveLength(1);

    const id2 = "8b0d1c52-3a55-4a5e-9d0a-2f4e5b6c7d8e";
    const multi = () => {
      const form = new FormData();
      form.append("id", id2);
      form.append("type", "audio");
      form.append("caption", "again");
      form.append("takenAt", "2026-10-27T10:00:00.000Z");
      return new Request("http://test/api/cards", { method: "POST", headers: { cookie: sessionCookie() }, body: form });
    };
    expect((await postCard(multi())).status).toBe(201);
    expect((await postCard(multi())).status).toBe(200);
    expect(listCards().filter((c) => c.id === id2)).toHaveLength(1);
    const badId = await postCard(new Request("http://test/api/cards", { method: "POST", headers: { "content-type": "application/json", cookie: sessionCookie() }, body: JSON.stringify({ id: "x", type: "audio", takenAt: "2026-10-27T10:00:00.000Z" }) }));
    expect(badId.status).toBe(400);
  });
});
