"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

type HeatCheckFilterLinkProps = {
  href: string;
  className: string;
  children: React.ReactNode;
  ariaCurrent?: "page" | "location";
  ariaLabel?: string;
  onSelect?: () => void;
  role?: string;
  "data-heat-window-link"?: string;
  "data-team"?: string;
  "data-team-drawer-link"?: string;
  "data-team-jump-link"?: string;
};

export function HeatCheckFilterLink({
  href,
  className,
  children,
  ariaCurrent,
  ariaLabel,
  onSelect,
  role,
  "data-heat-window-link": dataHeatWindowLink,
  "data-team": dataTeam,
  "data-team-drawer-link": dataTeamDrawerLink,
  "data-team-jump-link": dataTeamJumpLink,
}: HeatCheckFilterLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const [pendingIntent, setPendingIntent] = useState<{ href: string; from: string } | null>(null);
  const pending = !ariaCurrent && pendingIntent?.href === href && pendingIntent.from === currentHref;

  useEffect(() => {
    if (!pendingIntent) return;
    const timer = window.setTimeout(() => setPendingIntent(null), 8000);
    return () => window.clearTimeout(timer);
  }, [pendingIntent]);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  const warmRoute = () => {
    router.prefetch(href);
  };

  return (
    <>
      <Link
        href={href}
        prefetch
        scroll={false}
        className={`${className}${pending ? " pointer-events-none opacity-60" : ""}`}
        aria-current={ariaCurrent}
        aria-label={ariaLabel}
        aria-busy={pending ? true : undefined}
        role={role}
        data-heat-filter-link
        data-heat-window-link={dataHeatWindowLink}
        data-team={dataTeam}
        data-team-drawer-link={dataTeamDrawerLink}
        data-team-jump-link={dataTeamJumpLink}
        onPointerEnter={warmRoute}
        onPointerDown={warmRoute}
        onFocus={warmRoute}
        onClick={() => {
          if (href !== currentHref) setPendingIntent({ href, from: currentHref });
          onSelect?.();
        }}
      >
        {children}
      </Link>
      {pending ? (
        <div className="absolute inset-0 z-[120] flex items-center justify-start bg-black/55 px-4 backdrop-blur-sm" role="status" aria-live="polite" data-responsive-check="heat-filter-pending">
          <div className="flex min-h-24 w-full max-w-sm items-center gap-4 rounded border border-white/10 bg-[#101014]/95 px-5 py-4 shadow-2xl shadow-black/40">
            <span className="route-loading-spinner" aria-hidden="true" />
            <span>
              <span className="block font-mono text-xs uppercase tracking-[0.18em] text-zinc-300">Updating Heat Check</span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">Fetching pitcher form...</span>
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
