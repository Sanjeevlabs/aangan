"use client";

import { AnimatePresence, MotionConfig, m } from "framer-motion";
import { useEffect, useState } from "react";
import { playDoorClose, playDoorOpen } from "@/lib/door-sound";
import { Icon } from "./ui/kit";

// The door into Kutumb (SPEC §29.2): a carved haveli door, the kind on old
// Rajasthani palaces and city havelis. Teak leaves, brass spikes, ring
// knockers, a sandstone arch with a marigold toran. The key turns twice, the
// bolt drops, the leaves swing in. Sound: lib/door-sound.ts. Reduced motion: a fade.

const TEAK: React.CSSProperties = {
  backgroundColor: "#5b3218",
  backgroundImage: [
    "repeating-linear-gradient(90deg, rgba(255,210,160,.045) 0 1px, transparent 1px 6px)",
    "linear-gradient(180deg, #7a4421, #4a2711 70%, #3d200e)",
  ].join(","),
};

const ARCH = "50% 50% 0 0 / 30% 30% 0 0";

/** One brass spike (the bosses on fort and haveli doors). */
function Spike({ size = 16 }: { size?: number }) {
  return (
    <span
      className="block rounded-full"
      style={{ width: size, height: size, background: "radial-gradient(circle at 38% 32%, #fff1c2 0 12%, #e2b65a 30%, #9a6a1e 68%, #3d2408 100%)", boxShadow: "0 2px 3px rgba(0,0,0,.55)" }}
    />
  );
}

/** A carved leaf: framed panels, brass spikes in a grid, a ring knocker. */
function Leaf({ side }: { side: "l" | "r" }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* carved panels */}
      {[
        [6, 30],
        [38, 30],
        [72, 22],
      ].map(([top, h]) => (
        <div
          key={top}
          className="absolute left-[9%] right-[9%] rounded-[6px]"
          style={{ top: `${top}%`, height: `${h}%`, boxShadow: "inset 0 0 0 3px rgba(0,0,0,.35), inset 0 0 0 5px rgba(255,200,140,.12), inset 0 6px 14px rgba(0,0,0,.45)" }}
        />
      ))}
      {/* brass spikes on the rails between panels and along the edges */}
      {[3.5, 35, 69, 96].map((top) =>
        [18, 50, 82].map((left) => (
          <span key={`${top}-${left}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: `${top}%`, left: `${left}%` }}>
            <Spike />
          </span>
        )),
      )}
      {/* ring knocker near the meeting edge */}
      <span className="absolute top-[50%] -translate-y-1/2" style={{ [side === "l" ? "right" : "left"]: "14%" }}>
        <span className="block h-4 w-4 rounded-full" style={{ background: "radial-gradient(circle at 40% 35%, #f6d98e, #8a5a14)" }} />
        <span className="absolute left-1/2 top-2 block h-10 w-10 -translate-x-1/2 rounded-full" style={{ border: "3.5px solid #d4a24a", boxShadow: "0 2px 4px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,240,200,.5)" }} />
      </span>
      {/* the edge where the leaves meet */}
      <span className="absolute inset-y-0 w-[6px]" style={{ [side === "l" ? "right" : "left"]: 0, background: "linear-gradient(90deg, rgba(0,0,0,.5), rgba(0,0,0,.15))" }} />
    </div>
  );
}

function Toran() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 21 }, (_, i) => (
        <span key={i} className="flex flex-col items-center" style={{ marginTop: Math.sin((i / 20) * Math.PI) * 14 }}>
          <span className="block h-[14px] w-[14px] rounded-full" style={{ background: i % 2 ? "radial-gradient(circle at 40% 35%, #ffd36a, #e88a0c)" : "radial-gradient(circle at 40% 35%, #ffb04a, #d4580c)" }} />
          {i % 3 === 1 && <span className="mt-[2px] block h-[16px] w-[8px] rounded-[50%_50%_50%_50%/70%_70%_30%_30%]" style={{ background: "#3f7a2e" }} />}
        </span>
      ))}
    </div>
  );
}

export function DoorTransition({
  state,
  onDone,
}: {
  state: "opening" | "closing" | null;
  onDone: () => void;
}) {
  // Read the OS setting directly: the door is the one animation that carries
  // meaning, so it runs unless the person has actually asked for less motion.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    try {
      setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      setReduce(false);
    }
  }, []);
  useEffect(() => {
    if (!state) return;
    if (state === "opening") playDoorOpen();
    else playDoorClose();
    const t = window.setTimeout(
      onDone,
      reduce ? 250 : state === "opening" ? 1750 : 900,
    );
    return () => window.clearTimeout(t);
  }, [state, onDone, reduce]);

  const opening = state === "opening";
  // Leaves: closed = 0deg. Opening goes 0 → 104; closing comes 104 → 0.
  const leaf = (side: "l" | "r") => {
    const open = side === "l" ? -104 : 104;
    return {
      initial: { rotateY: opening ? 0 : open },
      animate: { rotateY: opening ? open : 0 },
      transition: {
        delay: opening ? 0.78 : 0,
        duration: opening ? 0.95 : 0.5,
        ease: [0.45, 0, 0.2, 1] as const,
      },
    };
  };

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>
      <AnimatePresence>
        {state && (
          <m.div
            className="fixed inset-0 z-[70] overflow-hidden"
            style={{
              perspective: 1400,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.15 }}
            role="status"
            aria-live="polite"
            aria-label={
              opening
                ? "Opening Kutumb"
                : "Closing Kutumb"
            }
          >
            {/* Sandstone wall and the arched gateway */}
            <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 40%, #d59a63, #b0703f 60%, #8a522b)" }}>
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(90,40,10,.35) 0 1px, transparent 1px 38px)" }} />
            </div>
            <div className="absolute left-1/2 top-[7%] h-[84%] w-[88%] max-w-[440px] -translate-x-1/2">
              {/* carved stone frame */}
              <div className="absolute -inset-[14px]" style={{ borderRadius: ARCH, background: "linear-gradient(180deg,#e6b47c,#b9773f)", boxShadow: "inset 0 0 0 4px rgba(120,60,20,.35), 0 20px 50px rgba(60,25,5,.45)" }} />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ borderRadius: ARCH, perspective: 1300, background: "radial-gradient(60% 55% at 50% 60%, #fff4dc, #f5c77a 45%, #b5712f 100%)" }}
              >
                {reduce ? (
                  <div className="absolute inset-0" style={TEAK}>
                    <Leaf side="l" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex" style={{ transformStyle: "preserve-3d" }}>
                    <m.div className="relative h-full w-1/2" style={{ ...TEAK, transformOrigin: "left center" }} {...leaf("l")}>
                      <Leaf side="l" />
                    </m.div>
                    <m.div className="relative h-full w-1/2" style={{ ...TEAK, transformOrigin: "right center" }} {...leaf("r")}>
                      <Leaf side="r" />
                      {/* the brass lock plate over the seam, and the key */}
                      <div className="absolute left-0 top-[58%] -translate-x-1/2">
                        <div className="grid h-20 w-12 place-items-center rounded-[12px]" style={{ background: "linear-gradient(180deg,#e2b65a,#8a5a14)", boxShadow: "0 6px 16px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,240,200,.6)" }}>
                          <m.span
                            className="grid h-10 w-10 place-items-center rounded-full text-[#3d2408]"
                            style={{ background: "radial-gradient(circle at 40% 35%, #fbe3a0, #b8862f)" }}
                            initial={opening ? { rotate: 0, x: 26, opacity: 0 } : { rotate: 180 }}
                            animate={opening ? { x: [26, 0, 0, 0], opacity: [0, 1, 1, 1], rotate: [0, 0, 90, 180] } : { rotate: 0 }}
                            transition={{ duration: opening ? 0.72 : 0.4, times: opening ? [0, 0.25, 0.6, 1] : undefined }}
                          >
                            <Icon name="key" size={20} strokeWidth={2.4} />
                          </m.span>
                        </div>
                      </div>
                    </m.div>
                  </div>
                )}
              </div>
              <div className="absolute inset-x-0 -top-[10px]">
                <Toran />
              </div>
              <p className="absolute inset-x-0 -bottom-12 m-0 text-center text-[13px] font-semibold uppercase tracking-[0.3em] text-[#4a2711]/80">Kutumb</p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
