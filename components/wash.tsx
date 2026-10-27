import type { CSSProperties } from "react";

// Adaptive light wash: 3 large blurred glows, still under reduced motion
// (see globals.css). Palette seeds from the home image / artwork.
export function Wash({ palette }: { palette?: string[] }) {
  const style =
    palette && palette.length >= 3
      ? ({
          "--wash-1": palette[0],
          "--wash-2": palette[1],
          "--wash-3": palette[2],
        } as CSSProperties)
      : undefined;
  return (
    <div className="wash" style={style} aria-hidden="true">
      <div className="wash-glow" />
      <div className="wash-glow" />
      <div className="wash-glow" />
    </div>
  );
}
