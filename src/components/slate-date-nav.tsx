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

export function RankedStartsRangeToggle({ activeDate, today }: { activeDate: string; today: string }) {
  const yesterday = addDays(today, -1);
  const todayActive = activeDate === today;
  const yesterdayActive = activeDate === yesterday;

  return (
    <SlateRangeToggle
      label="Ranked starts range"
      options={[
        {
          key: "today",
          label: todayActive || yesterdayActive ? "Today" : "Jump to today",
          href: rankedStartsPath(today),
          active: todayActive,
          ariaLabel: `View ranked starts for today, ${formatUpcomingDate(today)}`,
        },
        {
          key: "yesterday",
          label: "Yesterday",
          href: rankedStartsPath(yesterday),
          active: yesterdayActive,
          ariaLabel: `View ranked starts for yesterday, ${formatUpcomingDate(yesterday)}`,
        },
        {
          key: "week",
          label: "This week",
          href: upcomingWeekHref(activeDate),
          active: false,
          ariaLabel: `View week of ${formatUpcomingDate(activeDate)}`,
        },
      ]}
    />
  );
}

export function slateRangeToggleClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
