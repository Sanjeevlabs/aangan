import { readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { RITUAL_FILES } from "@/rituals";

// Workers has no filesystem: rituals/index.ts bundles the configs. Keep it in
// step with the folder.
describe("rituals/index.ts", () => {
  it("lists every rituals/*.json", () => {
    const onDisk = readdirSync(join(process.cwd(), "rituals")).filter((n) => n.endsWith(".json")).sort();
    expect(RITUAL_FILES.map((f) => f.name).sort()).toEqual(onDisk);
  });
});
