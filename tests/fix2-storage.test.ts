import { beforeEach, describe, expect, it } from "vitest";
import { POST as uploadUrl } from "@/app/api/media/upload-url/route";
import { PUT as mockUpload } from "@/app/api/media/mock-upload/route";
import { GET as mockBytes } from "@/app/api/media/mock-bytes/route";
import { GET as mediaProxy } from "@/app/api/media/[...path]/route";
import { sessionCookie } from "./auth-helper";
import { mockClearBlobs, storagePath } from "@/lib/storage";
import { resolveMediaUrl } from "@/lib/media-session";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie() },
    body: JSON.stringify(body),
  });
}

function authed(url: string, init?: RequestInit): Request {
  return new Request(url, { ...init, headers: { ...(init?.headers ?? {}), cookie: sessionCookie() } });
}

describe("signed-URL storage (mock backend)", () => {
  beforeEach(() => mockClearBlobs());

  it("issues an upload URL, stores bytes, and serves them back", async () => {
    const issued = await uploadUrl(jsonRequest("http://test/api/media/upload-url", { filename: "photo.jpg", mime: "image/jpeg" }));
    expect(issued.status).toBe(200);
    const { path, uploadUrl: putUrl, ref } = (await issued.json()) as { path: string; uploadUrl: string; ref: string };
    expect(path.startsWith("demo-family/uploads/")).toBe(true);
    expect(ref).toBe(`storage:${path}`);

    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const put = await mockUpload(authed(`http://test${putUrl}`, { method: "PUT", body: bytes as unknown as BodyInit }));
    expect(put.status).toBe(200);

    const got = await mockBytes(authed(`http://test/api/media/mock-bytes?path=${encodeURIComponent(path)}`));
    expect(got.status).toBe(200);
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes);
  });

  it("rejects empty uploads and unknown paths", async () => {
    const empty = await mockUpload(authed("http://test/api/media/mock-upload?path=demo-family%2Fx&mime=image/jpeg", { method: "PUT", body: new Uint8Array(0) as unknown as BodyInit }));
    expect(empty.status).toBe(400);
    const missing = await mockBytes(authed("http://test/api/media/mock-bytes?path=demo-family%2Fnope"));
    expect(missing.status).toBe(404);
    const foreign = await mockBytes(authed("http://test/api/media/mock-bytes?path=other-family%2Fx"));
    expect(foreign.status).toBe(403);
  });

  it("storage refs resolve through the signed-URL proxy", async () => {
    const { ref } = (await (
      await uploadUrl(jsonRequest("http://test/api/media/upload-url", { filename: "v.webm", mime: "audio/webm" }))
    ).json()) as { ref: string; path: string; uploadUrl: string };
    // Before any bytes exist the proxy 404s; the mapping itself is stable.
    expect(resolveMediaUrl(ref)).toMatch(/^\/api\/media\/demo-family\/uploads\//);
    const proxied = await mediaProxy(authed("http://test/api/media/x"), { params: Promise.resolve({ path: ["..", "x"] }) });
    expect(proxied.status).toBe(400);
    const unknown = await mediaProxy(authed("http://test/api/media/nope"), { params: Promise.resolve({ path: ["demo-family", "nope"] }) });
    expect(unknown.status).toBe(404);
  });

  it("storagePath sanitizes filenames", () => {
    const evil = storagePath("demo-family", "../../etc/passwd");
    expect(evil).not.toContain("../");
    expect(evil.split("/").pop()).not.toContain("/");
    expect(storagePath("demo-family", "a b.jpg")).toContain("a_b.jpg");
  });
});
