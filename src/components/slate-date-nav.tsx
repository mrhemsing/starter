import Link from "next/link";
import { formatUpcomingDate, rankedStartsPath, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";

type SlateRangeOption = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  ariaLabel: string;
};

export function SlateRangeToggle({ label, options }: { label: string; options: SlateRangeOption[] }) {
  return (
    <nav className="mt-5 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]" aria-label={label}>
      {options.map((option) => (
        <Link
          key={option.key}
          className={slateRangeToggleClass(option.active)}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          aria-label={option.ariaLabel}
          data-range-option={option.key}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

export function UpcomingSlateRangeToggle({ activeDate, today, tomorrow, weekActive = false }: { activeDate: string; today: string; tomorrow: string; weekActive?: boolean }) {
  const todayActive = !weekActive && activeDate === today;
  const tomorrowActive = !weekActive && activeDate === tomorrow;

  return (
    <SlateRangeToggle
      label="Upcoming range"
      options={[
        {
          key: "today",
          label: "Today",
          href: upcomingDateHref(today),
          active: todayActive,
          ariaLabel: `View today slate for ${formatUpcomingDate(today)}`,
        },
        {
          key: "tomorrow",
          label: "Tomorrow",
          href: upcomingDateHref(tomorrow),
          active: tomorrowActive,
          ariaLabel: `View tomorrow slate for ${formatUpcomingDate(tomorrow)}`,
        },
        {
          key: "week",
          label: "This week",
          href: upcomingWeekHref(activeDate),
          active: weekActive,
          ariaLabel: `View week of ${formatUpcomingDate(activeDate)}`,
        },
      ]}
    />
  );
}

export function RankedStartsArchiveNav({
  activeDate,
  latestDate,
  previousDate,
  nextDate,
  availableDates,
  isLatest,
}: {
  activeDate: string;
  latestDate: string;
  previousDate: string | null;
  nextDate: string | null;
  availableDates: string[];
  isLatest: boolean;
}) {
  const datesDescending = [...availableDates].sort().reverse();

  return (
    <nav className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]" aria-label="Ranked starts archive navigation" data-responsive-check="ranked-starts-archive-nav">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">{formatRankedEyebrowDate(activeDate)}</span>
      <span className="inline-flex overflow-hidden rounded border border-white/10" aria-label="Step ranked starts slates">
        {previousDate ? (
          <Link className="inline-flex min-h-11 min-w-11 items-center justify-center text-zinc-300 transition hover:bg-white/10 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" href={rankedStartsPath(previousDate)} aria-label={`Previous completed slate, ${formatRankedEyebrowDate(previousDate)}`}>
            <span aria-hidden="true">&lt;</span>
          </Link>
        ) : (
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center text-zinc-700" aria-disabled="true" aria-label="No previous completed slate">
            &lt;
          </span>
        )}
        {nextDate ? (
          <Link className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" href={rankedStartsPath(nextDate)} aria-label={`Next completed slate, ${formatRankedEyebrowDate(nextDate)}`}>
            <span aria-hidden="true">&gt;</span>
          </Link>
        ) : (
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-white/10 text-zinc-700" aria-disabled="true" aria-label="No newer completed slate">
            &gt;
          </span>
        )}
      </span>
      {isLatest ? (
        <span className={slateRangeToggleClass(true)} data-latest-state="latest">Latest</span>
      ) : (
        <Link className={slateRangeToggleClass(false)} href={rankedStartsPath(latestDate)} data-latest-state="jump">Jump to latest</Link>
      )}
      <details className="relative" data-responsive-check="ranked-starts-date-picker">
        <summary className={`${slateRangeToggleClass(false)} cursor-pointer list-none`}>Pick a date</summary>
        <div className="absolute left-0 z-30 mt-2 grid max-h-80 min-w-52 gap-1 overflow-auto rounded border border-white/10 bg-[#101014] p-2 shadow-2xl">
          {datesDescending.map((date) => (
            <Link
              key={date}
              className={`rounded px-3 py-2 text-left ${date === activeDate ? "bg-amber-300 text-zinc-950" : "text-zinc-300 hover:bg-white/10 hover:text-amber-300"}`}
              href={rankedStartsPath(date)}
              aria-current={date === activeDate ? "page" : undefined}
            >
              {formatRankedPickerDate(date)}
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}

export function slateRangeToggleClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}

function formatRankedEyebrowDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function formatRankedPickerDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
