// Live database for real families; the demo always stays in memory.
// Tests run with MOCK=true, so "live" is simulated: MOCK is switched off,
// a dummy model key is set, and lib/supabase is replaced by a recording fake
// client. Nothing here touches the network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { live: true, serverCalls: 0, calls: [] as string[] };
  type Res = { data: unknown; error: null; count?: number };
  const chain = (): unknown => {
    const p: unknown = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: Res) => void) => resolve({ data: [], error: null, count: 0 });
        if (prop === "maybeSingle") return () => Promise.resolve({ data: null, error: null });
        return () => p;
      },
    });
    return p;
  };
  const fake = {
    from: (t: string) => {
      state.calls.push(`from:${t}`);
      return chain();
    },
    rpc: (name: string) => {
      state.calls.push(`rpc:${name}`);
      return Promise.resolve({ data: 0, error: null });
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => {
          state.calls.push("storage:upload");
          return { data: { signedUrl: "https://bucket.test/up" }, error: null };
        },
        createSignedUrl: async () => {
          state.calls.push("storage:download");
          return { data: { signedUrl: "https://bucket.test/get" }, error: null };
        },
      }),
    },
  };
  return { state, fake };
});

vi.mock("@/lib/supabase", () => ({
  isDbLive: () => h.state.live,
  supabaseServer: () => {
    h.state.serverCalls++;
    return h.state.live ? h.fake : null;
  },
}));

import { dbAddCard, dbAddMember, dbAddRelationship, dbCreateInvite, dbGetMember, dbListCards, dbListFamilyIds, dbListInvites, dbListMembers, dbListRelationships, dbSetReaction, dbUpdateMemberProfile } from "@/lib/db";
import { deleteDoc, listDocs, putDoc, resetDocs } from "@/lib/family-docs";
import { dismiss, listEvents } from "@/lib/gather-store";
import { getRitualSettings, setRitualSettings } from "@/lib/occasion-settings";
import { createShare, listShares, resetShares } from "@/lib/shares";
import { createDownloadUrl, createUploadUrl, mockClearBlobs, mockPutBlob, storagePath } from "@/lib/storage";
import { resetDemo } from "@/lib/store";
import { PUT as mockUpload } from "@/app/api/media/mock-upload/route";
import { GET as mockBytes } from "@/app/api/media/mock-bytes/route";
import { sessionCookie } from "./auth-helper";

const REAL = "fam-real0000001";
const now = () => new Date().toISOString();
const touched = () => h.state.serverCalls > 0 || h.state.calls.length > 0;
const card = (familyId: string) => ({ familyId, type: "photo" as const, caption: "Sunday lunch", lang: "en", takenAt: now(), source: "upload" as const });
const recipe = { title: "Kadhi", from: "Maa", course: "main" as const, prepMins: null, cookMins: null, serves: "4", memory: "", prepWork: [], outcome: "", ingredients: [], steps: [] };

beforeEach(() => {
  vi.stubEnv("MOCK", "false");
  vi.stubEnv("META_API_KEY", "test-not-a-key");
  h.state.live = true;
  h.state.serverCalls = 0;
  h.state.calls = [];
  resetDemo();
  resetDocs();
  resetShares();
  mockClearBlobs();
});
afterEach(() => vi.unstubAllEnvs());

describe("lib/db: the demo never touches the database", () => {
  it("demo reads come from the in-memory seed", async () => {
    const members = await dbListMembers("demo-family");
    expect(members.find((m) => m.id === "dadi")).toMatchObject({ displayName: "Maa", city: "Amritsar" });
    expect((await dbListRelationships("demo-family")).length).toBeGreaterThan(0);
    expect((await dbListCards("demo-family")).length).toBeGreaterThan(0);
    expect((await dbListMembers("demo-iyer")).length).toBeGreaterThan(0);
    expect(await dbGetMember("dadi")).toMatchObject({ familyId: "demo-family" });
    expect(touched()).toBe(false);
  });

  it("demo writes land in memory only", async () => {
    const c = await dbAddCard(card("demo-family"));
    await dbSetReaction({ cardId: c.id, memberId: "dadi", kind: "love", familyId: "demo-family" });
    const { member } = await dbAddRelationship({ memberId: "arjun", newMemberName: "Meera", relation: "sister", familyId: "demo-family" });
    await dbUpdateMemberProfile(member.id, { city: "Pune" });
    await dbUpdateMemberProfile("arjun", { city: "Boston" });
    await dbAddMember({ familyId: "demo-iyer", firstName: "Ravi", displayName: "Ravi", role: "adult", lang: "en", displayLang: "en", tz: "UTC" });
    expect(touched()).toBe(false);
    expect((await dbListCards("demo-family")).some((x) => x.id === c.id)).toBe(true);
    expect((await dbGetMember(member.id))?.city).toBe("Pune");
    expect((await dbGetMember("arjun"))?.city).toBe("Boston");
    expect(touched()).toBe(false);
  });

  it("a real family reads and writes the database", async () => {
    await dbListMembers(REAL);
    await dbListCards(REAL);
    await dbAddCard(card(REAL));
    await dbAddRelationship({ memberId: "m-real", newMemberName: "Meera", relation: "sister", familyId: REAL });
    expect(h.state.calls).toEqual(expect.arrayContaining(["from:members", "from:cards", "from:relationships"]));
  });

  it("member-id functions go to the database for an id memory doesn't know", async () => {
    await dbGetMember("m-real-unknown");
    await dbUpdateMemberProfile("m-real-unknown", { city: "Pune" });
    expect(h.state.calls.filter((c) => c === "from:members").length).toBeGreaterThanOrEqual(2);
  });

  it("demo invites redeem from memory; the cron scan skips the demo", async () => {
    const inv = await dbCreateInvite("demo-family");
    expect(touched()).toBe(false);
    expect((await dbListInvites()).some((i) => i.code === inv.code)).toBe(true);
    const ids = await dbListFamilyIds();
    expect(ids).not.toContain("demo-family");
    expect(ids).not.toContain("demo-iyer");
  });

  it("with the database off, everything stays in memory as before", async () => {
    h.state.live = false;
    await dbAddCard(card(REAL));
    expect((await dbListCards(REAL)).length).toBe(1);
    expect(await dbListFamilyIds()).toContain("demo-family");
    expect(h.state.calls).toEqual([]);
  });
});

describe("family docs, events, settings, shares", () => {
  const knock = (memberId: string) => ({ id: `knock-${memberId}`, memberId, note: "", at: now(), until: now() });

  it("family-docs: demo stays in memory, a real family uses the database", async () => {
    await putDoc("demo-family", "knock", knock("dadi"));
    expect((await listDocs("demo-family", "knock")).length).toBe(1);
    await deleteDoc("demo-family", "knock", "knock-dadi");
    expect(touched()).toBe(false);
    await putDoc(REAL, "knock", knock("m-real"));
    await listDocs(REAL, "knock");
    expect(h.state.calls.filter((c) => c === "from:family_docs").length).toBe(2);
  });

  it("gather-store and occasion settings follow the same rule", async () => {
    await dismiss("demo-family", "dadi", "birthday-2026");
    await listEvents("demo-family");
    await setRitualSettings("demo-family", { kept: ["x"] }, "dadi");
    expect((await getRitualSettings("demo-family")).kept).toEqual(["x"]);
    expect(touched()).toBe(false);
    await dismiss(REAL, "m-real", "birthday-2026");
    await getRitualSettings(REAL);
    expect(h.state.calls.filter((c) => c === "from:family_docs").length).toBe(2);
  });

  it("shares: a demo recipe link stays in memory", async () => {
    await createShare({ familyId: "demo-family", kind: "recipe", refId: "r1", snapshot: recipe, createdBy: "dadi" });
    expect((await listShares("demo-family")).length).toBe(1);
    expect(touched()).toBe(false);
    await createShare({ familyId: REAL, kind: "recipe", refId: "r1", snapshot: recipe, createdBy: "m-real" });
    expect(h.state.calls).toContain("from:public_shares");
  });
});

describe("storage: demo uploads use the in-memory store", () => {
  it("demo paths get the mock seam; real paths get signed bucket URLs", async () => {
    const demoPath = storagePath("demo-family", "a.jpg");
    expect((await createUploadUrl(demoPath, "image/jpeg")).mock).toBe(true);
    expect(await createDownloadUrl(demoPath)).toBeNull();
    mockPutBlob(demoPath, new Uint8Array([1, 2]), "image/jpeg");
    expect((await createDownloadUrl(demoPath))?.mock).toBe(true);
    expect(touched()).toBe(false);
    const realPath = storagePath(REAL, "a.jpg");
    expect(await createUploadUrl(realPath, "image/jpeg")).toEqual({ uploadUrl: "https://bucket.test/up", mock: false });
    expect((await createDownloadUrl(realPath))?.mock).toBe(false);
    expect(h.state.calls).toEqual(["storage:upload", "storage:download"]);
  });

  it("mock routes serve demo paths with the database live, and refuse real ones", async () => {
    const demoPath = storagePath("demo-family", "a.jpg");
    const put = await mockUpload(new Request(`http://test/api/media/mock-upload?path=${encodeURIComponent(demoPath)}&mime=image/jpeg`, { method: "PUT", headers: { cookie: sessionCookie() }, body: new Uint8Array([7, 8, 9]) as unknown as BodyInit }));
    expect(put.status).toBe(200);
    const got = await mockBytes(new Request(`http://test/api/media/mock-bytes?path=${encodeURIComponent(demoPath)}`, { headers: { cookie: sessionCookie() } }));
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(new Uint8Array([7, 8, 9]));
    const realPath = storagePath(REAL, "a.jpg");
    const cookie = sessionCookie("m-real", REAL);
    const refusedPut = await mockUpload(new Request(`http://test/api/media/mock-upload?path=${encodeURIComponent(realPath)}&mime=image/jpeg`, { method: "PUT", headers: { cookie }, body: new Uint8Array([1]) as unknown as BodyInit }));
    expect(refusedPut.status).toBe(404);
    const refusedGet = await mockBytes(new Request(`http://test/api/media/mock-bytes?path=${encodeURIComponent(realPath)}`, { headers: { cookie } }));
    expect(refusedGet.status).toBe(404);
    // Still family-scoped: a demo session can't write another family's path.
    const foreign = await mockUpload(new Request(`http://test/api/media/mock-upload?path=${encodeURIComponent(storagePath("demo-iyer", "a.jpg"))}&mime=image/jpeg`, { method: "PUT", headers: { cookie: sessionCookie() }, body: new Uint8Array([1]) as unknown as BodyInit }));
    expect(foreign.status).toBe(403);
  });
});
