"use client";

import { AnimatePresence, MotionConfig, m } from "framer-motion";
import { useEffect, useState } from "react";
import { playDoorClose, playDoorOpen } from "@/lib/door-sound";

// The door into Kutumb (SPEC §29.2, revised 30 Oct): an old carved teak door
// in a lime-plaster wall, quiet and premium (no colour but wood, brass and
// light). Timed to the sound in lib/door-sound.ts: the key goes in, turns
// twice, the bolt slides back, the leaves swing in on their hinges with light
// spilling through the gap, and you step through. Reduced motion: a fade.

const OPEN_MS = 1950;
const CLOSE_MS = 950;
const ARCH = "50% 50% 0 0 / 22% 22% 0 0";

/** Oiled teak: grain lines over a deep, slightly uneven brown. */
const TEAK: React.CSSProperties = {
  backgroundColor: "#3a2416",
  backgroundImage: [
    "repeating-linear-gradient(90deg, rgba(255,220,180,.035) 0 1px, transparent 1px 5px, rgba(0,0,0,.06) 5px 6px, transparent 6px 11px)",
    "radial-gradient(120% 60% at 30% 20%, rgba(255,200,150,.08), transparent 60%)",
    "linear-gradient(180deg, #4a2e1c 0%, #34200f 55%, #2a190c 100%)",
  ].join(","),
};
const BRASS = "radial-gradient(circle at 36% 30%, #f3e1b0 0 10%, #c9a560 32%, #7b5a24 70%, #3a280e 100%)";

/** A raised, mitred panel. */
function Panel({ top, height }: { top: number; height: number }) {
  return (
    <div className="absolute left-[11%] right-[11%] rounded-[3px]" style={{ top: `${top}%`, height: `${height}%`, boxShadow: "inset 0 0 0 2px rgba(0,0,0,.45), inset 0 0 0 4px rgba(255,210,160,.07), inset 0 0 0 9px rgba(0,0,0,.18), inset 0 10px 22px rgba(0,0,0,.5), inset 0 -2px 0 rgba(255,220,180,.06)" }}>
      <div className="absolute inset-[18%_22%] rounded-[2px]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,210,160,.08), 0 1px 0 rgba(0,0,0,.4)" }} />
    </div>
  );
}

function Stud() {
  return <span className="block h-[11px] w-[11px] rounded-full" style={{ background: BRASS, boxShadow: "0 2px 3px rgba(0,0,0,.6)" }} />;
}

function Leaf({ side }: { side: "l" | "r" }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Panel top={5} height={27} />
      <Panel top={36} height={27} />
      <Panel top={67} height={28} />
      {[2.5, 34, 65, 97.5].map((top) =>
        [22, 50, 78].map((left) => (
          <span key={`${top}-${left}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: `${top}%`, left: `${left}%` }}>
            <Stud />
          </span>
        )),
      )}
      {/* ring pull */}
      <span className="absolute top-[49%]" style={{ [side === "l" ? "right" : "left"]: "13%" }}>
        <span className="block h-3 w-3 rounded-full" style={{ background: BRASS }} />
        <span className="absolute left-1/2 top-1.5 block h-9 w-9 -translate-x-1/2 rounded-full" style={{ border: "3px solid #b8955a", boxShadow: "0 3px 5px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,240,210,.35)" }} />
      </span>
      {/* hinge straps on the outer edge */}
      {[14, 84].map((top) => (
        <span key={top} className="absolute h-[10px] w-[34%] rounded-r-full" style={{ top: `${top}%`, [side === "l" ? "left" : "right"]: 0, background: "linear-gradient(180deg,#5a4426,#2c200f)", boxShadow: "0 2px 3px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,230,190,.18)", transform: side === "r" ? "scaleX(-1)" : undefined }} />
      ))}
      {/* the meeting edge */}
      <span className="absolute inset-y-0 w-[5px]" style={{ [side === "l" ? "right" : "left"]: 0, background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.1))" }} />
    </div>
  );
}

export function DoorTransition({ state, onDone }: { state: "opening" | "closing" | null; onDone: () => void }) {
  // The door carries meaning, so it runs unless the person asked for less motion.
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
    const t = window.setTimeout(onDone, reduce ? 250 : state === "opening" ? OPEN_MS : CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [state, onDone, reduce]);

  const opening = state === "opening";
  const ease = [0.5, 0, 0.18, 1] as const;
  const leaf = (side: "l" | "r") => {
    const open = side === "l" ? -100 : 100;
    return {
      initial: { rotateY: opening ? 0 : open },
      animate: { rotateY: opening ? open : 0 },
      transition: opening ? { delay: 0.8, duration: 1.0, ease } : { duration: 0.45, ease },
    };
  };
  // As a leaf turns away from the light it darkens.
  const shade = { initial: { opacity: opening ? 0 : 0.55 }, animate: { opacity: opening ? 0.55 : 0 }, transition: opening ? { delay: 0.8, duration: 1.0 } : { duration: 0.45 } };

  return (
    <MotionConfig reducedMotion={reduce ? "always" : "never"}>
      <AnimatePresence>
        {state && (
          <m.div
            className="fixed inset-0 z-[70] overflow-hidden"
            style={{ background: "#e9e4dc" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.18 }}
            role="status"
            aria-live="polite"
            aria-label={opening ? "Opening Kutumb" : "Closing Kutumb"}
          >
            {/* Lime-plaster wall, lit from above */}
            <div className="absolute inset-0" style={{ background: "radial-gradient(90% 70% at 50% 35%, #f4f0ea, #ddd5c9 65%, #c4baab)" }} />
            <div className="absolute inset-0 opacity-[.35] mix-blend-multiply" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,.08) 1px, transparent 1.2px)", backgroundSize: "5px 5px" }} />

            {/* Stepping through: the doorway grows as the leaves open */}
            <m.div
              className="absolute left-1/2 top-[8%] h-[80%] w-[84%] max-w-[420px]"
              style={{ x: "-50%", transformOrigin: "50% 55%" }}
              initial={{ scale: opening ? 1 : 2.4 }}
              animate={{ scale: opening ? [1, 1, 2.6] : 1 }}
              transition={opening ? { duration: OPEN_MS / 1000, times: [0, 0.62, 1], ease: [0.6, 0, 0.4, 1] } : { duration: 0.4, ease }}
            >
              {/* stone frame */}
              <div className="absolute -inset-[16px]" style={{ borderRadius: ARCH, background: "linear-gradient(180deg,#d9d1c4,#b9ae9c)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.5), inset 0 0 0 7px rgba(0,0,0,.06), 0 30px 60px -20px rgba(40,30,20,.45)" }} />
              <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: ARCH, perspective: 1100, background: "radial-gradient(70% 60% at 50% 55%, #ffffff, #fbf6ee 40%, #e8dccb 100%)" }}>
                {reduce ? (
                  <div className="absolute inset-0" style={TEAK}>
                    <Leaf side="l" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex" style={{ transformStyle: "preserve-3d" }}>
                    <m.div className="relative h-full w-1/2" style={{ ...TEAK, transformOrigin: "left center", backfaceVisibility: "hidden" }} {...leaf("l")}>
                      <Leaf side="l" />
                      <m.div className="absolute inset-0 bg-black" {...shade} />
                    </m.div>
                    <m.div className="relative h-full w-1/2" style={{ ...TEAK, transformOrigin: "right center", backfaceVisibility: "hidden" }} {...leaf("r")}>
                      <Leaf side="r" />
                      <m.div className="absolute inset-0 bg-black" {...shade} />
                    </m.div>
                    {/* lock plate on the seam: escutcheon, bolt, the key */}
                    <m.div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2" initial={{ opacity: 1 }} animate={{ opacity: opening ? [1, 1, 0] : 1 }} transition={opening ? { duration: 0.95, times: [0, 0.85, 1] } : undefined}>
                      <div className="relative grid h-[84px] w-[40px] place-items-center rounded-[8px]" style={{ background: "linear-gradient(180deg,#cdb07a,#7d5e2a)", boxShadow: "0 8px 18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,245,220,.55), inset 0 -1px 0 rgba(0,0,0,.3)" }}>
                        {/* the bolt, sliding back */}
                        <m.span className="absolute top-[14px] h-[7px] w-[44px] rounded-full" style={{ background: "linear-gradient(180deg,#e8d3a0,#8a6a30)", boxShadow: "0 1px 2px rgba(0,0,0,.5)" }} initial={{ x: opening ? 6 : -22 }} animate={{ x: opening ? -22 : 6 }} transition={opening ? { delay: 0.6, duration: 0.14, ease: "easeIn" } : { delay: 0.4, duration: 0.12 }} />
                        <span className="mt-4 block h-[14px] w-[7px] rounded-[4px_4px_1px_1px] bg-[#1a120a]" />
                        {/* key: slides in, then two quarter turns */}
                        <m.svg
                          width="22"
                          height="50"
                          viewBox="0 0 22 50"
                          className="absolute left-1/2 top-[38px] -ml-[11px]"
                          style={{ transformOrigin: "11px 6px" }}
                          initial={opening ? { y: 10, opacity: 0, rotate: 0 } : { rotate: 180, opacity: 1 }}
                          animate={opening ? { y: [10, 0, 0, 0, 0], opacity: [0, 1, 1, 1, 1], rotate: [0, 0, 0, 90, 180] } : { rotate: 0 }}
                          transition={opening ? { duration: 0.56, times: [0, 0.2, 0.5, 0.72, 1] } : { duration: 0.3 }}
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient id="kb" x1="0" x2="1">
                              <stop offset="0" stopColor="#f1dfae" />
                              <stop offset="1" stopColor="#8d6c31" />
                            </linearGradient>
                          </defs>
                          <rect x="9" y="0" width="4" height="30" rx="1.5" fill="url(#kb)" />
                          <circle cx="11" cy="39" r="9" fill="none" stroke="url(#kb)" strokeWidth="4" />
                        </m.svg>
                      </div>
                    </m.div>
                    {/* light through the gap */}
                    <m.div className="pointer-events-none absolute inset-y-0 left-1/2 w-[30%] -translate-x-1/2" style={{ background: "radial-gradient(closest-side, rgba(255,250,235,.95), rgba(255,250,235,0))", filter: "blur(8px)" }} initial={{ opacity: 0, scaleX: 0.1 }} animate={opening ? { opacity: [0, 0, 1, 0.6], scaleX: [0.1, 0.1, 1.2, 3] } : { opacity: 0 }} transition={{ duration: 1.8, times: [0, 0.45, 0.65, 1] }} />
                  </div>
                )}
              </div>
            </m.div>
            {/* the courtyard behind the door is bright: finish into it */}
            {opening && <m.div className="pointer-events-none absolute inset-0 bg-[#f6f3ee]" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1] }} transition={{ duration: OPEN_MS / 1000, times: [0, 0.82, 1] }} />}
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
