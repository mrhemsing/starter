"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SegmentedControl } from "@/components/segmented-control";

type UpcomingViewMode = "detailed" | "simple";

const STORAGE_KEY = "tts.upcoming.view";
const UpcomingViewModeContext = createContext<{
  mode: UpcomingViewMode;
  setMode: (mode: UpcomingViewMode) => void;
} | null>(null);

export function UpcomingViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UpcomingViewMode>(() => readStoredViewMode());

  useEffect(() => {
    // Reconcile after hydration so a stored SIMPLE preference wins over the server default.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(readStoredViewMode());
  }, []);

  const value = useMemo(() => ({
    mode,
    setMode(nextMode: UpcomingViewMode) {
      setModeState(nextMode);
      try {
        window.localStorage.setItem(STORAGE_KEY, nextMode === "simple" ? "SIMPLE" : "DETAILED");
      } catch {
        // Keep the in-session state when storage is blocked.
      }
    },
  }), [mode]);

  return <UpcomingViewModeContext.Provider value={value}>{children}</UpcomingViewModeContext.Provider>;
}

export function UpcomingViewModeToggle() {
  const context = useUpcomingViewMode();

  return (
    <div data-upcoming-view-mode-control data-storage-key={STORAGE_KEY}>
      <SegmentedControl
        label="View"
        ariaLabel="View mode"
        activeValue={context.mode}
        storageKey={STORAGE_KEY}
        segments={[
          { value: "detailed", label: "Detailed", controlKey: "view-detailed" },
          { value: "simple", label: "Simple", controlKey: "view-simple" },
        ]}
        onValueChange={(value) => context.setMode(value === "simple" ? "simple" : "detailed")}
      />
    </div>
  );
}

export function UpcomingViewModePanels({ detailed, simple }: { detailed: ReactNode; simple: ReactNode }) {
  const context = useUpcomingViewMode();

  return (
    <div data-upcoming-view-mode={context.mode} data-upcoming-view-storage-key={STORAGE_KEY}>
      <div hidden={context.mode !== "detailed"} data-upcoming-view-panel="detailed">
        {detailed}
      </div>
      <div hidden={context.mode !== "simple"} data-upcoming-view-panel="simple">
        {simple}
      </div>
    </div>
  );
}

export function UpcomingSimpleCardFrame({
  gamePk,
  ariaLabel,
  bandKey,
  background,
  accentColor,
  children,
}: {
  gamePk: string;
  ariaLabel: string;
  bandKey: string;
  background: string;
  accentColor: string;
  children: ReactNode;
}) {
  const context = useUpcomingViewMode();
  const href = `#upcoming-game-${gamePk}`;

  function openDetails() {
    context.setMode("detailed");
    window.requestAnimationFrame(() => {
      document.getElementById(`upcoming-game-${gamePk}`)?.scrollIntoView({ block: "center" });
      window.history.replaceState(null, "", href);
    });
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="heat-glow-card group relative block overflow-hidden rounded-xl border border-white/10 p-3 shadow-[0_18px_44px_rgba(0,0,0,0.24)] outline-none transition hover:-translate-y-0.5 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-amber-300/70 sm:p-5"
      style={{ background, borderColor: `${accentColor}44` }}
      data-responsive-check="upcoming-simple-card"
      data-game-pk={gamePk}
      data-simple-details-target={href}
      data-simple-card-link="whole-card"
      data-simple-card-tint={bandKey}
      data-simple-card-background={background}
      data-simple-card-edge-color={accentColor}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        event.preventDefault();
        openDetails();
      }}
    >
      {children}
      <span
        className="pointer-events-none absolute bottom-3 right-3 translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
        aria-hidden="true"
        data-upcoming-simple-hover-hint
      >
        &rsaquo;
      </span>
    </Link>
  );
}

function useUpcomingViewMode() {
  const context = useContext(UpcomingViewModeContext);
  if (!context) throw new Error("Upcoming view mode controls must render inside UpcomingViewModeProvider.");
  return context;
}

function readStoredViewMode(): UpcomingViewMode {
  if (typeof window === "undefined") return "detailed";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "SIMPLE" ? "simple" : "detailed";
  } catch {
    return "detailed";
  }
}
