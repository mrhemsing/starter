"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

type PrimaryNavLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function PrimaryNavLink({ href, className, children }: PrimaryNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingIntent, setPendingIntent] = useState<{ href: string; from: string } | null>(null);
  const pending = pendingIntent?.href === href && pendingIntent.from === pathname;

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  const warmRoute = () => {
    router.prefetch(href);
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setPendingIntent({ href, from: pathname });
    router.prefetch(href);
    router.push(href);
  };

  return (
    <Link
      href={href}
      prefetch
      className={`${className ?? ""}${pending ? " text-amber-300 opacity-80" : ""}`}
      data-nav-pending={pending ? "true" : undefined}
      onPointerEnter={warmRoute}
      onPointerDown={warmRoute}
      onFocus={warmRoute}
      onClick={handleClick}
    >
      <span className={pending ? "sr-only" : undefined}>{children}</span>
      {pending ? (
        <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" aria-hidden="true" />
          Loading…
        </span>
      ) : null}
    </Link>
  );
}
