"use client";

import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { startUploadQueue } from "@/lib/upload-queue";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  // Anything saved but not yet sent goes out on app start and when the network returns.
  useEffect(() => startUploadQueue(), []);
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
