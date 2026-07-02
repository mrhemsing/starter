"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { dispatchRoutePending } from "@/lib/route-pending-event";

type HeatTeamClearLinkProps = {
  href: string;
  className: string;
  onClear?: () => void;
};

export function HeatTeamClearLink({ href, className, onClear }: HeatTeamClearLinkProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  const warmClearRoute = () => {
    router.prefetch(href);
  };

  return (
    <Link
      href={href}
      prefetch
      className={`${className}${pending ? " pointer-events-none opacity-60" : ""}`}
      aria-label="Clear team filter"
      data-responsive-check="heat-team-clear"
      onPointerDown={warmClearRoute}
      onFocus={warmClearRoute}
      onClick={() => {
        setPending(true);
        dispatchRoutePending({ label: "Updating Heat Check", secondary: "Fetching pitcher form..." });
        onClear?.();
      }}
    >
      {"✕"}
    </Link>
  );
}
