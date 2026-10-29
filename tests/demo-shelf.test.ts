import { describe, expect, it } from "vitest";
import { DEMO_SHELF_CARDS } from "@/lib/demo";
import { CardSchema } from "@/lib/schemas";

describe("demo shelf cards", () => {
  it("are valid Cards without runtime parsing on the client", () => {
    for (const c of DEMO_SHELF_CARDS) expect(CardSchema.parse(c)).toEqual(c);
  });
});
