"use client";

import { AnimatePresence, MotionConfig, m } from "framer-motion";
import { useEffect, useState } from "react";
import { playDoorClose, playDoorOpen } from "@/lib/door-sound";
import { Icon } from "./ui/kit";

// The door between LITE and the family courtyard (SPEC §29.2). Two carved
// wooden leaves; a key turns twice, the bolt drops, the leaves swing in.
// The sound is synthesised (lib/door-sound.ts). Reduced motion: a fade.

const WOOD: React.CSSProperties = {
  backgroundColor: "#5a3a22",
  backgroundImage: [
    // iron straps
    "linear-gradient(to bottom, transparent 17%, #2a1d14 17%, #2a1d14 19.5%, transparent 19.5%, transparent 79%, #2a1d14 79%, #2a1d14 81.5%, transparent 81.5%)",
    // planks
    "repeating-linear-gradient(90deg, rgba(0,0,0,.28) 0 2px, transparent 2px 22%)",
    // grain
    "repeating-linear-gradient(90deg, rgba(255,220,170,.05) 0 1px, transparent 1px 7px)",
    "linear-gradient(180deg, #7a5233, #4e321d)",
  ].join(","),
};

function Studs() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {[18.2, 80.2].map((top) =>
        [14, 38, 62, 86].map((left) => (
          <span
            key={`${top}-${left}`}
            className="absolute h-2.5 w-2.5 rounded-full"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              background:
                "radial-gradient(circle at 35% 35%, #8a7766, #1d140e)",
            }}
          />
        )),
      )}
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
              background: opening ? "transparent" : "rgba(10,7,5,.4)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.15 }}
            role="status"
            aria-live="polite"
            aria-label={
              opening
                ? "Opening the door to the family courtyard"
                : "Closing the door"
            }
          >
            {/* Light from the courtyard behind the door */}
            {opening && !reduce && (
              <m.div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 55%, #fff4dc, #f5c77a 45%, #b5712f 100%)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 0.9] }}
                transition={{ duration: 1.7, times: [0, 0.45, 0.75, 1] }}
              />
            )}
            {reduce ? (
              <div className="absolute inset-0" style={WOOD} />
            ) : (
              <div
                className="absolute inset-0 flex"
                style={{ transformStyle: "preserve-3d" }}
              >
                <m.div
                  className="relative h-full w-1/2"
                  style={{
                    ...WOOD,
                    transformOrigin: "left center",
                    boxShadow: "inset -6px 0 12px rgba(0,0,0,.45)",
                  }}
                  {...leaf("l")}
                >
                  <Studs />
                </m.div>
                <m.div
                  className="relative h-full w-1/2"
                  style={{
                    ...WOOD,
                    transformOrigin: "right center",
                    boxShadow: "inset 6px 0 12px rgba(0,0,0,.45)",
                  }}
                  {...leaf("r")}
                >
                  <Studs />
                  {/* The lock plate and the key, on the right leaf's edge */}
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div
                      className="grid h-24 w-14 place-items-center rounded-[14px]"
                      style={{
                        background: "linear-gradient(180deg,#c49a52,#7d5a22)",
                        boxShadow:
                          "0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,240,200,.5)",
                      }}
                    >
                      <m.span
                        className="grid h-11 w-11 place-items-center rounded-full text-[#2a1d14]"
                        style={{
                          background:
                            "radial-gradient(circle at 40% 35%, #f3d48c, #b8862f)",
                        }}
                        initial={
                          opening
                            ? { rotate: 0, x: 26, opacity: 0 }
                            : { rotate: 180 }
                        }
                        animate={
                          opening
                            ? {
                                x: [26, 0, 0, 0],
                                opacity: [0, 1, 1, 1],
                                rotate: [0, 0, 90, 180],
                              }
                            : { rotate: 0 }
                        }
                        transition={{
                          duration: opening ? 0.72 : 0.4,
                          times: opening ? [0, 0.25, 0.6, 1] : undefined,
                        }}
                      >
                        <Icon name="key" size={22} strokeWidth={2.4} />
                      </m.span>
                    </div>
                  </div>
                </m.div>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
