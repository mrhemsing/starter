"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [pending, setPending] = useState(false);

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
      className={`${className}${pending ? " pointer-events-none opacity-70" : ""}`}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      style={style}
      data-fast-filter-link
      data-control-link-active={dataControlLinkActive}
      onPointerEnter={warmRoute}
      onPointerDown={warmRoute}
      onFocus={warmRoute}
      onClick={() => setPending(true)}
    >
      {children}
    </Link>
  );
}
