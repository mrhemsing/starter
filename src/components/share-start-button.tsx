"use client";

import { useMemo, useState } from "react";

type ShareStartButtonProps = {
  title: string;
  text: string;
  path: string;
  className?: string;
};

export function ShareStartButton({ title, text, path, className = "" }: ShareStartButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");
  const url = useMemo(() => {
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  }, [path]);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setStatus("shared");
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
      }
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
        window.setTimeout(() => setStatus("idle"), 1600);
      } catch {
        setStatus("idle");
      }
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex min-h-11 items-center rounded border border-white/10 px-3 font-mono text-xs uppercase tracking-[0.16em] text-zinc-300 transition hover:border-amber-300/40 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${className}`}
      aria-live="polite"
    >
      {status === "copied" ? "Copied link" : status === "shared" ? "Shared" : "Share"}
    </button>
  );
}
