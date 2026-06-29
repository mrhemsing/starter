import Link from "next/link";
import { SiteNav, type NavKey } from "@/components/site-nav";
import { currentSeasonFromDate } from "@/lib/season";

export async function SiteHeader({
  active,
  today,
  rankedDate,
  className = "",
  responsiveCheck,
}: {
  active: NavKey | null;
  today: string;
  rankedDate?: string;
  className?: string;
  responsiveCheck?: string;
}) {
  const currentSeason = currentSeasonFromDate(today);

  return (
    <header className={`site-header-nav flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5 ${className}`} data-responsive-check={responsiveCheck}>
      <div className="site-logo-lockup">
        <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
          Toe the Slab
        </Link>
        <p className="site-logo-season-kicker">{currentSeason} MLB Season</p>
      </div>
      <SiteNav active={active} today={today} rankedDate={rankedDate} />
    </header>
  );
}
