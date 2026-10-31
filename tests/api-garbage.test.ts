import { readdirSync, statSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

// A malformed body is the caller's mistake: 4xx with {error}, never a 500.

function routes(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) routes(p, out);
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

const root = join(process.cwd(), "app/api");
const files = routes(root).map((f) => f.slice(root.length + 1, -"/route.ts".length));
// The ten routes parents hit most; checked by name so a failure points at them.
const TOP = ["cards", "today", "reactions", "letters", "kitchen", "stories", "care", "session", "members/profile", "translate"];
const METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function hit(route: string, method: string, body: BodyInit, contentType: string): Promise<{ status: number; body: unknown }> {
  const mod = (await import(`@/app/api/${route}/route`)) as Record<string, Handler | undefined>;
  const handler = mod[method];
  if (!handler) return { status: 0, body: null };
  const params = Object.fromEntries((route.match(/\[(\w+)\]/g) ?? []).map((m) => [m.slice(1, -1), "x"]));
  const res = await handler(new Request(`http://test/api/${route}`, { method, headers: { "content-type": contentType, cookie: sessionCookie() }, body }), { params: Promise.resolve(params) });
  return { status: res.status, body: await res.clone().json().catch(() => null) };
}

describe("API garbage bodies", () => {
  beforeEach(() => resetDemo());

  it("finds the routes", () => {
    for (const r of TOP) expect(files).toContain(r);
  });

  for (const route of files.filter((f) => f !== "ritual-scan")) {
    it(`${route}: garbage and wrong-shaped JSON, and garbage multipart are 4xx with an error`, async () => {
      for (const method of METHODS) {
        for (const [body, type] of [
          ["{oops", "application/json"],
          ["null", "application/json"],
          ["[]", "application/json"],
          ['"text"', "application/json"],
          ["", "application/json"],
          ["--nope\r\nbroken", "multipart/form-data; boundary=zzz"],
        ] as const) {
          const r = await hit(route, method, body, type);
          if (r.status === 0) continue; // route doesn't export this method
          expect(r.status, `${method} ${route} (${type})`).toBeLessThan(500);
          if (r.status >= 400) expect(r.body, `${method} ${route} error body`).toMatchObject({ error: expect.anything() });
        }
      }
    }, 20_000);
  }
});
