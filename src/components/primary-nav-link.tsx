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
  const documentNavigation = href === "/starts" || href.startsWith("/live/");
  const canPrefetch = !documentNavigation;
  const canClientNavigate = !documentNavigation;
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
      return;
    }
    event.preventDefault();
    setPendingIntent({ href, from: pathname });
    if (canPrefetch) router.prefetch(href);
    router.push(href);
  };

  if (documentNavigation) {
    return (
      <a
        href={href}
        className={`${className ?? ""}${pending ? " text-amber-300 opacity-80" : ""}`}
        data-nav-pending={pending ? "true" : undefined}
        data-document-nav="true"
        onClick={handleClick}
      >
        {children}
      </a>
    );
  }

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
