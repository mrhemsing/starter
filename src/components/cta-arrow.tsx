import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type CtaArrowProps = Omit<ComponentPropsWithoutRef<typeof Link>, "children"> & {
  children: ReactNode;
  direction?: "back" | "forward";
  hideTailOnMobile?: boolean;
  tone?: "amber" | "orange";
};

const toneClasses = {
  amber: "border-[#F6C445]/50 text-[#F6C445] hover:border-[#F6C445]",
  orange: "border-[#FF9A62]/50 text-[#FF9A62] hover:border-[#FF9A62]",
};

export function CtaArrow({ children, className = "", direction = "forward", hideTailOnMobile = false, tone = "orange", ...props }: CtaArrowProps) {
  const isBack = direction === "back";
  const mobileTailClassName = hideTailOnMobile ? "max-sm:hidden" : "";

  return (
    <Link
      {...props}
      data-cta-arrow
      data-cta-arrow-direction={direction}
      className={`group/cta inline-flex max-w-full items-center rounded border px-[18px] py-[13px] font-mono text-[13px] uppercase tracking-[0.08em] transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${toneClasses[tone]} ${className}`}
    >
      {isBack ? <CtaArrowTail direction="back" className={`mr-3.5 ${mobileTailClassName}`} /> : null}
      <span className="min-w-0 whitespace-nowrap">{children}</span>
      {isBack ? null : <CtaArrowTail className={`ml-3.5 ${mobileTailClassName}`} />}
    </Link>
  );
}

export function CtaArrowTail({ className = "", direction = "forward" }: { className?: string; direction?: "back" | "forward" }) {
  const isBack = direction === "back";

  return (
    <span className={`inline-flex shrink-0 items-center ${isBack ? "flex-row-reverse" : ""} ${className}`} aria-hidden="true" data-cta-arrow-tail data-cta-arrow-tail-direction={direction}>
      <span className="h-px w-[26px] bg-current transition-[width] duration-150 ease-out group-hover/cta:w-10" data-cta-arrow-shaft />
      <span className={`${isBack ? "-mr-2 border-b border-l" : "-ml-2 border-r border-t"} h-[7px] w-[7px] rotate-45 border-current`} data-cta-arrow-head />
    </span>
  );
}
