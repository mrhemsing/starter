"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

type FastFilterLinkProps = {
  href: string;
  className: string;
  children: React.ReactNode;
  prefetch?: boolean;
  ariaCurrent?: "page" | "location";
  ariaLabel?: string;
  style?: React.CSSProperties;
  "data-control-link-active"?: string;
};

export function FastFilterLink({ href, className, children, prefetch = true, ariaCurrent, ariaLabel, style, "data-control-link-active": dataControlLinkActive }: FastFilterLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const [pendingIntent, setPendingIntent] = useState<{ href: string; from: string } | null>(null);
  const pending = pendingIntent?.href === href && pendingIntent.from === currentHref;

  useEffect(() => {
    if (prefetch) router.prefetch(href);
  }, [href, prefetch, router]);

  const warmRoute = () => {
    if (prefetch) router.prefetch(href);
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`${className}${pending ? " opacity-70" : ""}`}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      style={style}
      data-fast-filter-link
      data-control-link-active={dataControlLinkActive}
      onPointerEnter={warmRoute}
      onPointerDown={warmRoute}
      onFocus={warmRoute}
      onClick={() => setPendingIntent({ href, from: currentHref })}
    >
      {children}
    </Link>
  );
}
