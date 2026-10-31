// The wall around the window (SPEC §30.1): colour only, no place names.
// Real lime-wash paint colours: chalky, a little warm, never screen-bright.
// `top` is the paint in full light, `bottom` the same paint in the shade
// near the floor; the plaster texture and light falloff go on top (globals.css).
import type { Wall } from "./kinds";

export const WALL_LOOK: Record<Wall, { label: string; top: string; bottom: string; ink: "light" | "dark" }> = {
  jodhpur: { label: "Blue", top: "#6d8fac", bottom: "#56758f", ink: "light" },
  jaipur: { label: "Rose", top: "#c08b79", bottom: "#a47160", ink: "light" },
  chettinad: { label: "Ochre", top: "#d2a85f", bottom: "#b68d49", ink: "dark" },
  goa: { label: "Green", top: "#7f9a80", bottom: "#667f68", ink: "light" },
  kerala: { label: "Teak", top: "#8c6a4f", bottom: "#6f533d", ink: "light" },
  lime: { label: "White", top: "#ece5d7", bottom: "#d6ccbb", ink: "dark" },
};

/** A paint chip: the colour with its plaster, for swatches. */
export function wallChip(w: Wall): string {
  const l = WALL_LOOK[w];
  return `url("/window/plaster.svg") center / 180px, linear-gradient(180deg, ${l.top}, ${l.bottom})`;
}
