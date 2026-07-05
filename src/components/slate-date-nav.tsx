import Link from "next/link";
import { RankedStartsArchiveKeyboard, RankedStartsArchiveStrip, RankedStartsDatePicker } from "@/components/ranked-starts-archive-link";
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
  availableDates,
}: {
  activeDate: string;
  previousDate: string | null;
  nextDate: string | null;
  availableDates: string[];
}) {
  const previousHref = previousDate ? rankedStartsPath(previousDate) : null;
  const nextHref = nextDate ? rankedStartsPath(nextDate) : null;
  const minDate = availableDates[0];
  const maxDate = availableDates.at(-1);

  return (
    <nav className="w-full min-w-0 font-mono uppercase" aria-label="Ranked starts archive navigation" data-responsive-check="ranked-starts-archive-nav">
      <RankedStartsArchiveKeyboard previousHref={previousHref} nextHref={nextHref} />
      <div className="flex min-w-0 items-stretch gap-2 rounded border border-white/10 bg-[#101014]/95 p-2">
        <RankedStartsArchiveStrip activeDate={activeDate} availableDates={availableDates} />
        <RankedStartsDatePicker activeDate={activeDate} min={minDate} max={maxDate} className={rankedStartsArchiveDatePickerClass} />
      </div>
    </nav>
  );
}

const rankedStartsArchiveDatePickerClass =
  "relative inline-flex h-[4.75rem] w-10 shrink-0 items-center justify-center rounded border border-white/10 bg-[#101014] text-[10px] font-semibold tracking-[0.14em] text-zinc-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-200 focus-within:border-amber-300/80 focus-within:ring-2 focus-within:ring-amber-300 sm:w-12";

export function slateRangeToggleClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}
