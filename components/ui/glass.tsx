"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function GlassPill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glass glass-pill", className)}>{children}</div>;
}

export function GlassPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glass rounded-card", className)}>{children}</div>;
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}

// Bottom glass sheet: radius 32, round close button, 150–400ms motion.
export function GlassSheet({ open, onClose, label, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="glass glass-sheet relative mx-4 max-h-[88vh] w-full max-w-[440px] overflow-y-auto p-6 pb-8"
            initial={{ y: 64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 64, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="tap absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/70 text-xl leading-none"
            >
              ×
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
