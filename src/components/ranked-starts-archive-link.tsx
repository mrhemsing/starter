"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { rankedStartsPath } from "@/lib/routes";

type RankedStartsArchiveLinkProps = {
  href: string;
  className: string;
  ariaLabel?: string;
  ariaCurrent?: "page";
  anchorRef?: React.Ref<HTMLAnchorElement>;
  children: React.ReactNode;
  dataArchiveStep?: "previous" | "next";
  dataArchiveDate?: string;
};

export function RankedStartsArchiveLink({
  href,
  className,
  ariaLabel,
  ariaCurrent,
  anchorRef,
  children,
  dataArchiveStep,
  dataArchiveDate,
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
      ref={anchorRef}
      href={href}
      prefetch
      className={`${className}${pending ? " opacity-80" : ""}`}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      data-archive-step={dataArchiveStep}
      data-archive-date={dataArchiveDate}
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

export function RankedStartsArchiveStrip({ activeDate, availableDates }: { activeDate: string; availableDates: string[] }) {
  const [visibleCount, setVisibleCount] = useState(DESKTOP_ARCHIVE_WINDOW_SIZE);
  const [pagedWindow, setPagedWindow] = useState(() => ({
    activeDate,
    availableCount: availableDates.length,
    start: getArchiveWindowStart(availableDates, activeDate),
  }));

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const syncVisibleCount = () => setVisibleCount(mediaQuery.matches ? DESKTOP_ARCHIVE_WINDOW_SIZE : MOBILE_ARCHIVE_WINDOW_SIZE);
    syncVisibleCount();
    mediaQuery.addEventListener("change", syncVisibleCount);
    return () => mediaQuery.removeEventListener("change", syncVisibleCount);
  }, []);

  const windowStart = pagedWindow.activeDate === activeDate && pagedWindow.availableCount === availableDates.length ? pagedWindow.start : getArchiveWindowStart(availableDates, activeDate);
  const maxWindowStart = Math.max(0, availableDates.length - DESKTOP_ARCHIVE_WINDOW_SIZE);
  const windowedDates = useMemo(() => availableDates.slice(windowStart, windowStart + DESKTOP_ARCHIVE_WINDOW_SIZE), [availableDates, windowStart]);
  const visibleMobileIndexes = getMobileVisibleIndexes(windowStart, windowedDates.length, availableDates.length);
  const canPageEarlier = windowStart > 0 && availableDates.length > visibleCount;
  const canPageLater = windowStart < maxWindowStart && availableDates.length > visibleCount;

  const pageWindow = (direction: "earlier" | "later") => {
    setPagedWindow({
      activeDate,
      availableCount: availableDates.length,
      start: Math.max(0, Math.min(maxWindowStart, direction === "earlier" ? windowStart - visibleCount : windowStart + visibleCount)),
    });
  };

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-2" data-slate-strip="ranked-starts" data-slate-strip-window-start={windowStart}>
      <button
        type="button"
        className={rankedStartsArchivePageButtonClass(canPageEarlier)}
        disabled={!canPageEarlier}
        aria-label="Show earlier slates"
        data-slate-strip-page="earlier"
        onClick={() => pageWindow("earlier")}
      >
        <ChevronLeftIcon />
      </button>
      <div className="grid min-w-0 flex-1 grid-cols-5 gap-2 sm:grid-cols-7">
        {windowedDates.map((date, index) => {
        const parsed = parseArchiveDate(date);
        const month = parsed ? formatArchiveChipMonth(parsed) : "";
        const previousWindowParsed = index > 0 ? parseArchiveDate(windowedDates[index - 1] ?? "") : null;
        const previousWindowMonth = previousWindowParsed ? formatArchiveChipMonth(previousWindowParsed) : "";
        const previousMobileIndex = visibleMobileIndexes.filter((visibleIndex) => visibleIndex < index).at(-1);
        const previousMobileParsed = previousMobileIndex !== undefined ? parseArchiveDate(windowedDates[previousMobileIndex] ?? "") : null;
        const previousMobileMonth = previousMobileParsed ? formatArchiveChipMonth(previousMobileParsed) : "";
        const showDesktopMonth = Boolean(month && (index === 0 || month !== previousWindowMonth));
        const showMobileMonth = Boolean(month && (index === visibleMobileIndexes[0] || month !== previousMobileMonth));
        const active = date === activeDate;
        const hiddenOnMobile = !visibleMobileIndexes.includes(index);

        return (
          <RankedStartsArchiveLink
            key={date}
            className={`${rankedStartsArchiveChipClass(active)} ${hiddenOnMobile ? "hidden sm:grid" : "grid"}`}
            href={rankedStartsPath(date)}
            ariaLabel={`View slate for ${formatArchiveChipFullDate(date)}`}
            ariaCurrent={active ? "page" : undefined}
            dataArchiveDate={date}
          >
            <span className="grid min-w-0 justify-items-center gap-1">
              <span className="h-3 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-zinc-500 group-aria-[current=page]:text-amber-950 sm:hidden">
                {showMobileMonth ? month : ""}
              </span>
              <span className="hidden h-3 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.16em] text-zinc-500 group-aria-[current=page]:text-amber-950 sm:block">
                {showDesktopMonth ? month : ""}
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.14em]">{parsed ? formatArchiveChipWeekday(parsed) : date.slice(5)}</span>
              <span className="font-mono text-lg font-semibold leading-none tracking-normal">{parsed ? parsed.getUTCDate() : date.slice(-2)}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-zinc-950" : "bg-amber-300/70"}`} aria-hidden="true" />
            </span>
          </RankedStartsArchiveLink>
        );
      })}
      </div>
      <button
        type="button"
        className={rankedStartsArchivePageButtonClass(canPageLater)}
        disabled={!canPageLater}
        aria-label="Show later slates"
        data-slate-strip-page="later"
        onClick={() => pageWindow("later")}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

export function RankedStartsDatePicker({
  activeDate,
  className,
  min,
  max,
}: {
  activeDate: string;
  className: string;
  min?: string;
  max?: string;
}) {
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
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
      </svg>
      <input
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:dark]"
        type="date"
        value={activeDate}
        min={min}
        max={max}
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

function rankedStartsArchiveChipClass(active: boolean) {
  const base = "group h-[4.75rem] min-w-0 place-items-center rounded border px-2 py-1.5 text-center font-mono uppercase transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";
  if (active) return `${base} border-amber-300 bg-amber-300 text-zinc-950`;
  return `${base} border-white/10 bg-[#101014] text-zinc-300 hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-200`;
}

function rankedStartsArchivePageButtonClass(enabled: boolean) {
  const base = "inline-flex h-[4.75rem] w-10 shrink-0 items-center justify-center rounded border text-zinc-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:w-10";
  if (!enabled) return `${base} border-white/10 text-zinc-700`;
  return `${base} border-white/10 hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-200`;
}

function getArchiveWindowStart(availableDates: string[], activeDate: string) {
  const activeIndex = Math.max(0, availableDates.indexOf(activeDate));
  const maxStart = Math.max(0, availableDates.length - DESKTOP_ARCHIVE_WINDOW_SIZE);
  return Math.max(0, Math.min(maxStart, activeIndex - Math.floor(DESKTOP_ARCHIVE_WINDOW_SIZE / 2)));
}

function getMobileVisibleIndexes(windowStart: number, windowLength: number, availableCount: number) {
  const indexes = Array.from({ length: windowLength }, (_, index) => index);
  if (windowLength <= MOBILE_ARCHIVE_WINDOW_SIZE) return indexes;
  if (windowStart === 0) return indexes.slice(0, MOBILE_ARCHIVE_WINDOW_SIZE);
  if (windowStart + windowLength >= availableCount) return indexes.slice(windowLength - MOBILE_ARCHIVE_WINDOW_SIZE);
  return indexes.slice(1, 1 + MOBILE_ARCHIVE_WINDOW_SIZE);
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const DESKTOP_ARCHIVE_WINDOW_SIZE = 7;
const MOBILE_ARCHIVE_WINDOW_SIZE = 5;

function parseArchiveDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function formatArchiveChipWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
}

function formatArchiveChipMonth(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
}

function formatArchiveChipFullDate(date: string) {
  const parsed = parseArchiveDate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}
