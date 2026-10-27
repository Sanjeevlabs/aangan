"use client";

import { useEffect } from "react";

// Graceful fallback card: model or load failure never leaves a blank screen.
export default function TimelineError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Memory Lane failed to load:", error);
  }, [error]);

  return (
    <main>
      <h1>Aangan</h1>
      <article className="card" role="alert">
        <h2>Your memories are safe — they just did not load.</h2>
        <p>Check your connection and try again.</p>
        <button className="button" type="button" onClick={reset}>
          Try again
        </button>
      </article>
    </main>
  );
}
