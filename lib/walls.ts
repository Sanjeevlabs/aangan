// The wall around the window (SPEC §30.1): colour only, no place names.
import type { Wall } from "./kinds";

export const WALL_LOOK: Record<Wall, { label: string; top: string; bottom: string; ink: "light" | "dark" }> = {
  jodhpur: { label: "Blue", top: "#4a7db3", bottom: "#335d8a", ink: "light" },
  jaipur: { label: "Rose", top: "#d58b7a", bottom: "#b56a5c", ink: "light" },
  chettinad: { label: "Ochre", top: "#d9a441", bottom: "#b9822a", ink: "light" },
  goa: { label: "Green", top: "#5f9a7a", bottom: "#447a5d", ink: "light" },
  kerala: { label: "Teak", top: "#7a5236", bottom: "#5a3a24", ink: "light" },
  lime: { label: "White", top: "#ece6dc", bottom: "#d6cec1", ink: "dark" },
};
