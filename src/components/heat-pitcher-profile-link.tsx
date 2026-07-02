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
    </>
  );
}
