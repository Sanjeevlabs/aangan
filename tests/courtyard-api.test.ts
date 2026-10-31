import { describe, expect, it } from "vitest";
import { GET as courtyard } from "@/app/api/courtyard/route";
import { GET as sit } from "@/app/api/sit/route";
import { GET as presence } from "@/app/api/presence/route";
import { GET as suggestions } from "@/app/api/suggestions/route";
import { authedGet } from "./auth-helper";

const url = "http://localhost/api/courtyard";

describe("GET /api/courtyard", () => {
  it("is closed to anyone not signed in", async () => {
    const res = await courtyard(new Request(url));
    expect(res.status).toBe(401);
  });

  it("returns the same payloads the individual routes serve", async () => {
    const res = await courtyard(authedGet(url, "arjun"));
    expect(res.status).toBe(200);
    const all = (await res.json()) as Record<string, unknown>;
    for (const key of ["sides", "safety", "events", "today", "suggestions", "letters", "presence", "together", "sit"]) expect(all).toHaveProperty(key);
    expect(all.sit).toEqual(await (await sit(authedGet("http://localhost/api/sit", "arjun"))).json());
    expect(all.presence).toEqual(await (await presence(authedGet("http://localhost/api/presence", "arjun"))).json());
    expect(all.suggestions).toEqual(await (await suggestions(authedGet("http://localhost/api/suggestions?status=pending", "arjun"))).json());
  });

  it("adds the elder and child slices only for those viewers", async () => {
    const adult = (await (await courtyard(authedGet(url, "arjun"))).json()) as Record<string, unknown>;
    expect(adult).not.toHaveProperty("gifts");
    expect(adult).not.toHaveProperty("stories");
    const elder = (await (await courtyard(authedGet(url, "dadi"))).json()) as Record<string, unknown>;
    expect(elder).toHaveProperty("gifts");
    const child = (await (await courtyard(authedGet(url, "aria"))).json()) as Record<string, unknown>;
    expect(child).toHaveProperty("stories");
  });
});
