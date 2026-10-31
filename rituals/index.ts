// Every ritual config in this folder, bundled at build time. Cloudflare
// Workers has no filesystem at runtime, so configs are imported, not read.
// Adding a config: drop the JSON here and add it below (tests/rituals-index
// fails if a file is missing from this list).
import birthday from "./birthday.json";
import diwali from "./diwali.json";

export const RITUAL_FILES: ReadonlyArray<{ name: string; json: unknown }> = [
  { name: "birthday.json", json: birthday },
  { name: "diwali.json", json: diwali },
];
