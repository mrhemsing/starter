import Link from "next/link";
import { SiteNav, type NavKey } from "@/components/site-nav";

export async function SiteHeader({
  active,
  today,
  rankedDate,
  hideUpcoming = false,
  className = "",
  responsiveCheck,
}: {
  active: NavKey | null;
  today: string;
  rankedDate?: string;
  hideUpcoming?: boolean;
  className?: string;
  responsiveCheck?: string;
}) {
  return (
    <header className={`site-header-nav flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5 ${className}`} data-responsive-check={responsiveCheck}>
      <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
        Toe the Slab
      </Link>
      <SiteNav active={active} today={today} rankedDate={rankedDate} hideUpcoming={hideUpcoming} />
    </header>
  );
}
