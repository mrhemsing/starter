"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import { useRouteControlPending } from "@/components/route-control-pending";

type HeatCheckFilterLinkProps = {
  href: string;
  className: string;
  children: React.ReactNode;
  ariaCurrent?: "page" | "location";
  ariaLabel?: string;
  onSelect?: () => void;
  role?: string;
  "data-heat-window-link"?: string;
  "data-heat-view-link"?: string;
  "data-team"?: string;
  "data-team-drawer-link"?: string;
  "data-team-jump-link"?: string;
  "data-heat-client-team-link"?: string;
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
  "data-heat-view-link": dataHeatViewLink,
  "data-team": dataTeam,
  "data-team-drawer-link": dataTeamDrawerLink,
  "data-team-jump-link": dataTeamJumpLink,
  "data-heat-client-team-link": dataHeatClientTeamLink,
}: HeatCheckFilterLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : ""}`;
  const { pending, beginPending } = useRouteControlPending({ href, currentHref, active: Boolean(ariaCurrent), region: "heat-check-board" });

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
        data-heat-view-link={dataHeatViewLink}
        data-team={dataTeam}
        data-team-drawer-link={dataTeamDrawerLink}
        data-team-jump-link={dataTeamJumpLink}
        data-heat-client-team-link={dataHeatClientTeamLink}
        onPointerEnter={warmRoute}
        onPointerDown={warmRoute}
        onFocus={warmRoute}
        onClick={(event) => {
          beginPending(() => {
            if (dataHeatClientTeamLink) {
              event.currentTarget.dispatchEvent(new CustomEvent("heat-client-team-filter-request", { bubbles: true, cancelable: true, detail: { team: dataTeam === "all" ? "" : dataTeam, href } }));
              if (event.currentTarget.dataset.heatClientTeamHandled === "true") event.preventDefault();
              delete event.currentTarget.dataset.heatClientTeamHandled;
            }
          });
          onSelect?.();
        }}
      >
        {children}
      </Link>
    </>
  );
}
