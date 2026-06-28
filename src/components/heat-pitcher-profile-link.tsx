"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

type HeatPitcherProfileLinkProps = {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
};

export function HeatPitcherProfileLink({ href, className, ariaLabel, children }: HeatPitcherProfileLinkProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  const warmRoute = () => {
    router.prefetch(href);
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setPending(true);
    router.prefetch(href);
    router.push(href);
  };

  return (
    <>
      <Link
        href={href}
        prefetch
        className={className}
        aria-label={ariaLabel}
        data-heat-pitcher-profile-link="true"
        data-nav-pending={pending ? "true" : undefined}
        onPointerEnter={warmRoute}
        onPointerDown={warmRoute}
        onFocus={warmRoute}
        onClick={handleClick}
      >
        {children}
      </Link>
      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#08080a]/82 px-4 backdrop-blur-sm" aria-live="polite" aria-busy="true" data-responsive-check="heat-pitcher-profile-pending">
          <div className="flex min-h-20 items-center gap-3 rounded border border-white/10 bg-[#101014] px-4 py-3 shadow-2xl">
            <span className="route-loading-spinner" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-300">Loading pitcher profile</p>
              <p className="route-loading-secondary-message mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">Fetching data...</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
