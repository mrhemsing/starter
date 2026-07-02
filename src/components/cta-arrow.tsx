import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CtaArrowProps = Omit<ComponentPropsWithoutRef<typeof Link>, "children"> & {
  children: ReactNode;
  tone?: "amber" | "orange";
};

const toneClasses = {
  amber: "border-[#F6C445]/50 text-[#F6C445] hover:border-[#F6C445]",
  orange: "border-[#FF9A62]/50 text-[#FF9A62] hover:border-[#FF9A62]",
};

export function CtaArrow({ children, className = "", tone = "orange", ...props }: CtaArrowProps) {
  return (
    <Link
      {...props}
      data-cta-arrow
      className={`group/cta inline-flex max-w-full items-center rounded border px-[18px] py-[13px] font-mono text-[13px] uppercase tracking-[0.08em] transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${toneClasses[tone]} ${className}`}
    >
      <span className="min-w-0 truncate">{children}</span>
      <CtaArrowTail className="ml-3.5" />
    </Link>
  );
}

export function CtaArrowTail({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`} aria-hidden="true" data-cta-arrow-tail>
      <span className="h-px w-[26px] bg-current transition-[width] duration-150 ease-out group-hover/cta:w-10" data-cta-arrow-shaft />
      <span className="-ml-2 h-[7px] w-[7px] rotate-45 border-r border-t border-current" data-cta-arrow-head />
    </span>
  );
}
