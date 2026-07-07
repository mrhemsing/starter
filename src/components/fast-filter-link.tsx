"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import { useRouteControlPending } from "@/components/route-control-pending";

type FastFilterLinkProps = {
  href: string;
  className: string;
  children: React.ReactNode;
  prefetch?: boolean;
  ariaCurrent?: "page" | "location";
  ariaLabel?: string;
  style?: React.CSSProperties;
  scroll?: boolean;
  "data-control-link-active"?: string;
  "data-control-link-key"?: string;
  "data-segmented-control-option"?: string;
  "aria-controls"?: string;
  pendingRegion?: string;
  pendingLabel?: string;
};

export function FastFilterLink({
  href,
  className,
  children,
  prefetch = true,
  ariaCurrent,
  ariaLabel,
  style,
  scroll = true,
  "data-control-link-active": dataControlLinkActive,
  "data-control-link-key": dataControlLinkKey,
  "data-segmented-control-option": dataSegmentedControlOption,
  "aria-controls": ariaControls,
  pendingRegion = "route-data",
  pendingLabel,
}: FastFilterLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const { pending, beginPending } = useRouteControlPending({ href, currentHref, active: Boolean(ariaCurrent), region: pendingRegion });

  useEffect(() => {
    if (prefetch) router.prefetch(href);
  }, [href, prefetch, router]);

  const warmRoute = () => {
    if (prefetch) router.prefetch(href);
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    beginPending();
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      scroll={scroll}
      className={`${className}${pending ? " opacity-70" : ""}`}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      style={style}
      data-fast-filter-link
      data-control-link-active={dataControlLinkActive}
      data-control-link-key={dataControlLinkKey}
      data-segmented-control-option={dataSegmentedControlOption}
      data-route-pending-region={pendingRegion}
      data-route-pending-label={pendingLabel ?? pendingRegion}
      data-route-pending-target={ariaControls}
      aria-controls={ariaControls}
      onPointerEnter={warmRoute}
      onPointerDown={warmRoute}
      onFocus={warmRoute}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
