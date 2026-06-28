"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

type RankedStartsArchiveLinkProps = {
  href: string;
  className: string;
  ariaLabel?: string;
  children: React.ReactNode;
  dataLatestState?: "jump";
  dataArchiveStep?: "previous" | "next";
};

export function RankedStartsArchiveLink({
  href,
  className,
  ariaLabel,
  children,
  dataLatestState,
  dataArchiveStep,
}: RankedStartsArchiveLinkProps) {
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
    <Link
      href={href}
      prefetch
      className={`${className}${pending ? " opacity-80" : ""}`}
      aria-label={ariaLabel}
      data-latest-state={dataLatestState}
      data-archive-step={dataArchiveStep}
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

export function RankedStartsArchiveKeyboard({ previousHref, nextHref }: { previousHref: string | null; nextHref: string | null }) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))) return;

      const href = event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : null;
      if (!href) return;

      event.preventDefault();
      router.prefetch(href);
      router.push(href);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextHref, previousHref, router]);

  return null;
}
