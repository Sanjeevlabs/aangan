import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Guards fix #3 of the M1 visual review: the fallback courtyard photo must
// exist, stay inside the 300 KB budget, and carry its AI-generated notice.
describe("fallback courtyard asset", () => {
  const jpg = join(process.cwd(), "public", "demo", "courtyard.jpg");
  const readme = join(process.cwd(), "public", "demo", "README.md");

  it("exists as a JPEG within the 300 KB budget", () => {
    expect(existsSync(jpg)).toBe(true);
    expect(statSync(jpg).size).toBeLessThanOrEqual(300 * 1024);
    const head = readFileSync(jpg).subarray(0, 2);
    expect(head[0]).toBe(0xff);
    expect(head[1]).toBe(0xd8);
  });

  it("ships an AI-generated notice", () => {
    expect(existsSync(readme)).toBe(true);
    expect(readFileSync(readme, "utf8")).toMatch(/AI-generated/i);
  });
});
