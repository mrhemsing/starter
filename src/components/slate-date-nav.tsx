import Link from "next/link";
import { RankedStartsArchiveKeyboard, RankedStartsArchiveLink, RankedStartsDatePicker } from "@/components/ranked-starts-archive-link";
import { formatUpcomingDate, rankedStartsPath, upcomingDateHref, upcomingStreamersHref, upcomingWeekHref } from "@/lib/routes";

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

export function UpcomingSlateRangeToggle({ activeDate, today, tomorrow, weekActive = false, streamersActive = false }: { activeDate: string; today: string; tomorrow: string; weekActive?: boolean; streamersActive?: boolean }) {
  const todayActive = !weekActive && !streamersActive && activeDate === today;
  const tomorrowActive = !weekActive && !streamersActive && activeDate === tomorrow;

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
          active: weekActive && !streamersActive,
          ariaLabel: `View week of ${formatUpcomingDate(activeDate)}`,
        },
        {
          key: "streamers",
          label: "Streamers",
          href: upcomingStreamersHref(),
          active: streamersActive,
          ariaLabel: "View upcoming fantasy streamers",
        },
      ]}
    />
  );
}

export function RankedStartsArchiveNav({
  activeDate,
  previousDate,
  nextDate,
}: {
  activeDate: string;
  previousDate: string | null;
  nextDate: string | null;
}) {
  const previousHref = previousDate ? rankedStartsPath(previousDate) : null;
  const nextHref = nextDate ? rankedStartsPath(nextDate) : null;

  return (
    <nav className="w-full min-w-0 font-mono uppercase" aria-label="Ranked starts archive navigation" data-responsive-check="ranked-starts-archive-nav">
      <RankedStartsArchiveKeyboard previousHref={previousHref} nextHref={nextHref} />
      <div className="grid min-w-0 justify-items-start gap-2">
        <span className="inline-flex max-w-full shrink-0 items-center gap-1.5" aria-label="Step ranked starts slates">
          {previousDate ? (
            <RankedStartsArchiveLink className={rankedStartsArchiveStepClass} href={previousHref ?? rankedStartsPath(previousDate)} ariaLabel={`Previous slate, ${formatRankedEyebrowDate(previousDate)}`} dataArchiveStep="previous">
              <span className="text-3xl font-semibold leading-none" aria-hidden="true">‹</span>
            </RankedStartsArchiveLink>
          ) : (
            <span className={rankedStartsArchiveStepDisabledClass} aria-disabled="true" aria-label="No previous slate" data-archive-step="previous">
              <span className="text-3xl font-semibold leading-none" aria-hidden="true">‹</span>
            </span>
          )}
          <RankedStartsDatePicker activeDate={activeDate} className={rankedStartsArchiveDatePickerClass} />
          {nextDate ? (
            <RankedStartsArchiveLink className={rankedStartsArchiveStepClass} href={nextHref ?? rankedStartsPath(nextDate)} ariaLabel={`Next slate, ${formatRankedEyebrowDate(nextDate)}`} dataArchiveStep="next">
              <span className="text-3xl font-semibold leading-none" aria-hidden="true">›</span>
            </RankedStartsArchiveLink>
          ) : (
            <span className={rankedStartsArchiveStepDisabledClass} aria-disabled="true" aria-label="No next slate" data-archive-step="next">
              <span className="text-3xl font-semibold leading-none" aria-hidden="true">›</span>
            </span>
          )}
        </span>
        <span className="block w-full min-w-0 font-mono text-xl font-semibold leading-tight tracking-normal text-zinc-100 sm:text-2xl sm:leading-none" data-context-primary>
          <RankedEyebrowDateLabel date={activeDate} />
        </span>
      </div>
    </nav>
  );
}

const rankedStartsArchiveStepClass =
  "inline-flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-[#101014] text-zinc-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-200 active:border-amber-300 active:bg-amber-300/15 active:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";

const rankedStartsArchiveStepDisabledClass =
  "inline-flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-[#101014] text-zinc-700";

const rankedStartsArchiveDatePickerClass =
  "inline-flex h-10 items-center justify-center rounded border border-white/10 bg-[#101014] px-2 text-zinc-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 focus-within:border-amber-300/80 focus-within:ring-2 focus-within:ring-amber-300";

export function slateRangeToggleClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}

function RankedEyebrowDateLabel({ date }: { date: string }) {
  const label = formatRankedEyebrowDate(date);
  const parts = formatRankedEyebrowDateParts(date);
  if (!parts) return <span data-ranked-date-label>{label}</span>;

  return (
    <span className="flex min-w-0 flex-wrap items-baseline" aria-label={label} data-ranked-date-label>
      <span>{parts.weekday},</span>
      <span className="ml-[0.2em]">{parts.date}</span>
    </span>
  );
}

function formatRankedEyebrowDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function formatRankedEyebrowDateParts(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(parsed),
    date: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed),
  };
}
