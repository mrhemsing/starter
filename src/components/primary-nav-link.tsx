"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { dispatchRoutePending } from "@/lib/route-pending-event";

type PrimaryNavLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function PrimaryNavLink({ href, className, children }: PrimaryNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const canPrefetch = href !== "/starts";
  const canClientNavigate = href !== "/starts";
  const [pendingIntent, setPendingIntent] = useState<{ href: string; from: string } | null>(null);
  const pending = pendingIntent?.href === href && pendingIntent.from === pathname;

  useEffect(() => {
    if (!canPrefetch) return;
    router.prefetch(href);
  }, [canPrefetch, href, router]);

  const warmRoute = () => {
    if (!canPrefetch) return;
    router.prefetch(href);
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!canClientNavigate) {
      dispatchRoutePending();
      return;
    }
    event.preventDefault();
    setPendingIntent({ href, from: pathname });
    dispatchRoutePending();
    if (canPrefetch) router.prefetch(href);
    router.push(href);
  };

  return (
    <Link
      href={href}
      prefetch={canPrefetch}
      className={`${className ?? ""}${pending ? " text-amber-300 opacity-80" : ""}`}
      data-nav-pending={pending ? "true" : undefined}
      onPointerEnter={warmRoute}
      onPointerDown={warmRoute}
      onFocus={warmRoute}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
