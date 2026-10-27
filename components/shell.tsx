"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AddSheet, type AddTab } from "./add-sheet";
import { TabBar } from "./tab-bar";
import { ViewerProvider } from "./viewer";
import { Wash } from "./wash";

interface ShellState {
  addOpen: boolean;
  addTab: AddTab;
  openAdd: (tab?: AddTab) => void;
  closeAdd: () => void;
  washPalette: string[];
  setWashPalette: (palette: string[]) => void;
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
  const [washPalette, setWashPalette] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chromeHidden, setChromeHidden] = useState(false);

  const openAdd = useCallback((tab: AddTab = "photos") => {
    setAddTab(tab);
    setAddOpen(true);
  }, []);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo<ShellState>(
    () => ({
      addOpen,
      addTab,
      openAdd,
      closeAdd,
      washPalette,
      setWashPalette,
      refreshKey,
      bumpRefresh,
      chromeHidden,
      setChromeHidden,
    }),
    [addOpen, addTab, openAdd, closeAdd, washPalette, refreshKey, bumpRefresh, chromeHidden],
  );

  return (
    <ShellContext.Provider value={value}>
      <Wash palette={washPalette.length >= 3 ? washPalette : undefined} />
      <div className="relative z-10 mx-auto min-h-full w-full max-w-[480px] px-4 pb-28 pt-6">{children}</div>
      <TabBar />
      <AddSheet />
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
