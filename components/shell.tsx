"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AddSheet, type AddTab, type ReplyContribution } from "./add-sheet";
import { PlayerProvider } from "./player";
import { TabBar } from "./tab-bar";
import { ViewerProvider } from "./viewer";

interface ShellState {
  addOpen: boolean;
  addTab: AddTab;
  replyTo: ReplyContribution | null;
  openAdd: (tab?: AddTab, replyTo?: ReplyContribution | null) => void;
  closeAdd: () => void;
  refreshKey: number;
  bumpRefresh: () => void;
  chromeHidden: boolean;
  setChromeHidden: (v: boolean) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside Shell");
  return ctx;
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>("photos");
  const [replyTo, setReplyTo] = useState<ReplyContribution | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chromeHidden, setChromeHidden] = useState(false);

  const openAdd = useCallback((tab: AddTab = "photos", contribution: ReplyContribution | null = null) => {
    setAddTab(tab);
    setReplyTo(contribution);
    setAddOpen(true);
  }, []);
  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setReplyTo(null);
  }, []);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo<ShellState>(
    () => ({ addOpen, addTab, replyTo, openAdd, closeAdd, refreshKey, bumpRefresh, chromeHidden, setChromeHidden }),
    [addOpen, addTab, replyTo, openAdd, closeAdd, refreshKey, bumpRefresh, chromeHidden],
  );

  return (
    <ShellContext.Provider value={value}>
      <PlayerProvider>
        <div
          className="relative z-10 mx-auto min-h-full w-full max-w-[480px] bg-paper px-4 pt-6"
          style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
        <TabBar />
        <AddSheet />
      </PlayerProvider>
    </ShellContext.Provider>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ViewerProvider>
      <ShellInner>{children}</ShellInner>
    </ViewerProvider>
  );
}
