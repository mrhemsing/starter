"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { rankedStartsPath } from "@/lib/routes";

type RankedStartsArchiveLinkProps = {
  href: string;
  className: string;
  ariaLabel?: string;
  children: React.ReactNode;
  dataArchiveStep?: "previous" | "next";
};

export function RankedStartsArchiveLink({
  href,
  className,
  ariaLabel,
  children,
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

export function RankedStartsDatePicker({ activeDate, className }: { activeDate: string; className: string }) {
  const router = useRouter();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;

    const href = rankedStartsPath(nextDate);
    router.prefetch(href);
    router.push(href);
  };

  return (
    <label className={className} aria-label="Jump to ranked starts date" data-archive-step="date-picker">
      <span className="sr-only">Jump to ranked starts date</span>
      <input
        className="h-8 w-[9.3rem] max-w-[42vw] bg-transparent font-mono text-xs text-zinc-100 [color-scheme:dark] focus:outline-none"
        type="date"
        value={activeDate}
        onChange={handleChange}
        aria-label="Jump to ranked starts date"
      />
    </label>
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
