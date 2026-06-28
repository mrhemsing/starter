import Link from "next/link";
import { RankedStartsArchiveKeyboard, RankedStartsArchiveLink } from "@/components/ranked-starts-archive-link";
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
    <nav className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]" aria-label="Ranked starts archive navigation" data-responsive-check="ranked-starts-archive-nav">
      <RankedStartsArchiveKeyboard previousHref={previousHref} nextHref={nextHref} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">{formatRankedEyebrowDate(activeDate)}</span>
      <span className="inline-flex overflow-hidden rounded border border-white/10" aria-label="Step ranked starts slates">
        {previousDate ? (
          <RankedStartsArchiveLink className="inline-flex min-h-11 min-w-11 items-center justify-center text-zinc-300 transition hover:bg-white/10 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" href={previousHref ?? rankedStartsPath(previousDate)} ariaLabel={`Previous completed slate, ${formatRankedEyebrowDate(previousDate)}`} dataArchiveStep="previous">
            <span aria-hidden="true">&lt;</span>
          </RankedStartsArchiveLink>
        ) : (
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center text-zinc-700" aria-disabled="true" aria-label="No previous completed slate">
            &lt;
          </span>
        )}
        {nextDate ? (
          <RankedStartsArchiveLink className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" href={nextHref ?? rankedStartsPath(nextDate)} ariaLabel={`Next completed slate, ${formatRankedEyebrowDate(nextDate)}`} dataArchiveStep="next">
            <span aria-hidden="true">&gt;</span>
          </RankedStartsArchiveLink>
        ) : (
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-white/10 text-zinc-700" aria-disabled="true" aria-label="No newer completed slate">
            &gt;
          </span>
        )}
      </span>
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
