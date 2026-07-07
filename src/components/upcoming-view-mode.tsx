"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import { SegmentedControl } from "@/components/segmented-control";

type UpcomingViewMode = "detailed" | "simple";

const STORAGE_KEY = "tts.upcoming.view";
const UpcomingViewModeContext = createContext<{
  mode: UpcomingViewMode;
  setMode: (mode: UpcomingViewMode) => void;
} | null>(null);

export function UpcomingViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UpcomingViewMode>(() => readStoredViewMode());

  useLayoutEffect(() => {
    // Reconcile after hydration so a stored SIMPLE preference wins over the server default.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(readStoredViewMode());
  }, []);

  const value = useMemo(() => ({
    mode,
    setMode(nextMode: UpcomingViewMode) {
      setModeState(nextMode);
      document.documentElement.setAttribute("data-upcoming-view-mode-init", nextMode);
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
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `(() => { if (window.__ttsUpcomingViewModeClickBridge) return; window.__ttsUpcomingViewModeClickBridge = true; const storageKey = "${STORAGE_KEY}"; const applyMode = (mode, persist) => { document.documentElement.setAttribute("data-upcoming-view-mode-init", mode); try { if (persist) window.localStorage.setItem(storageKey, mode === "simple" ? "SIMPLE" : "DETAILED"); } catch {} const root = document.querySelector('[data-upcoming-view-storage-key="${STORAGE_KEY}"]'); if (root) { root.setAttribute("data-upcoming-view-mode", mode); root.querySelector('[data-upcoming-view-panel="detailed"]')?.toggleAttribute("hidden", mode !== "detailed"); root.querySelector('[data-upcoming-view-panel="simple"]')?.toggleAttribute("hidden", mode !== "simple"); } const control = document.querySelector('[data-upcoming-view-mode-control]'); if (!control) return; control.querySelector('[data-segmented-control]')?.setAttribute("data-segmented-control-active", mode); control.querySelectorAll('[data-view-mode-option]').forEach((option) => { const active = option.getAttribute("data-view-mode-option") === mode; option.setAttribute("data-control-link-active", String(active)); option.setAttribute("aria-pressed", String(active)); }); const indicator = control.querySelector('[data-segmented-control-indicator]'); if (indicator) { const index = mode === "simple" ? 1 : 0; indicator.setAttribute("data-segmented-control-indicator-index", String(index)); indicator.style.transform = \`translateX(\${index * 100}%)\`; } }; try { applyMode(window.localStorage.getItem(storageKey) === "SIMPLE" ? "simple" : "detailed", false); } catch { applyMode("detailed", false); } document.addEventListener("click", (event) => { const target = event.target instanceof Element ? event.target.closest('[data-upcoming-view-mode-control] [data-view-mode-option]') : null; if (!target) return; applyMode(target.getAttribute("data-view-mode-option") === "simple" ? "simple" : "detailed", true); }, true); })();`,
        }}
      />
    </div>
  );
}

export function UpcomingViewModePanels({ detailed, simple }: { detailed: ReactNode; simple: ReactNode }) {
  const context = useUpcomingViewMode();

  return (
    <>
      <div data-upcoming-view-mode={context.mode} data-upcoming-view-storage-key={STORAGE_KEY}>
        <div hidden={context.mode !== "detailed"} data-upcoming-view-panel="detailed">
          {detailed}
        </div>
        <div hidden={context.mode !== "simple"} data-upcoming-view-panel="simple">
          {simple}
        </div>
      </div>
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `(() => { try { const mode = window.localStorage.getItem("${STORAGE_KEY}") === "SIMPLE" ? "simple" : "detailed"; document.documentElement.setAttribute("data-upcoming-view-mode-init", mode); const root = document.querySelector('[data-upcoming-view-storage-key="${STORAGE_KEY}"]'); if (!root) return; root.setAttribute("data-upcoming-view-mode", mode); root.querySelector('[data-upcoming-view-panel="detailed"]')?.toggleAttribute("hidden", mode !== "detailed"); root.querySelector('[data-upcoming-view-panel="simple"]')?.toggleAttribute("hidden", mode !== "simple"); } catch {} })();`,
        }}
      />
    </>
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
  return (
    <article
      aria-label={ariaLabel}
      className="heat-glow-card relative block overflow-hidden rounded-lg border border-white/10 p-3 shadow-[0_18px_44px_rgba(0,0,0,0.24)] sm:p-5"
      style={{ background, borderColor: `${accentColor}44` }}
      data-responsive-check="upcoming-simple-card"
      data-game-pk={gamePk}
      data-simple-card-interaction="static-preview"
      data-simple-card-tint={bandKey}
      data-simple-card-background={background}
      data-simple-card-edge-color={accentColor}
    >
      {children}
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
