"use client";

import { useEffect } from "react";
import { GlassPanel } from "@/components/ui/glass";
import { PrimaryButton } from "@/components/ui/buttons";

// Graceful fallback card: a load failure never leaves a blank screen.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Aangan failed to load:", error);
  }, [error]);

  return (
    <div className="pt-8" role="alert">
      <GlassPanel className="p-6">
        <h1 className="mb-2 mt-0 text-2xl font-normal">Your memories are safe — they just did not load.</h1>
        <p className="mt-0 text-ink-soft">Check your connection and try again.</p>
        <PrimaryButton onClick={reset}>Try again</PrimaryButton>
      </GlassPanel>
    </div>
  );
}
