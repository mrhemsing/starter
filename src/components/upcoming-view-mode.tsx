"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
    <div role="group" aria-label="View mode" data-upcoming-view-mode-control data-storage-key={STORAGE_KEY}>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">View</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={viewButtonClass(context.mode === "detailed")}
          aria-pressed={context.mode === "detailed"}
          data-view-mode-option="detailed"
          data-control-link-active={String(context.mode === "detailed")}
          onClick={() => context.setMode("detailed")}
        >
          Detailed
        </button>
        <button
          type="button"
          className={viewButtonClass(context.mode === "simple")}
          aria-pressed={context.mode === "simple"}
          data-view-mode-option="simple"
          data-control-link-active={String(context.mode === "simple")}
          onClick={() => context.setMode("simple")}
        >
          Simple
        </button>
      </div>
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
  children,
}: {
  gamePk: string;
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
    <article
      className="heat-glow-card relative cursor-pointer overflow-hidden rounded border border-white/10 bg-[#101014] p-3 transition hover:border-amber-300/35 sm:p-4"
      data-responsive-check="upcoming-simple-card"
      data-game-pk={gamePk}
      data-simple-details-target={href}
      tabIndex={0}
      role="link"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button")) return;
        openDetails();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      }}
    >
      {children}
      <button
        type="button"
        className="mt-3 inline-flex min-h-9 items-center rounded border border-amber-300/35 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200"
        data-upcoming-simple-details
        onClick={openDetails}
      >
        Details
      </button>
    </article>
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

function viewButtonClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}
