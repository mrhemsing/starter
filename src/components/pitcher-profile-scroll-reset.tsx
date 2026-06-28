"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export function PitcherProfileScrollReset() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!pathname.startsWith("/pitchers/")) return;

    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const firstFrame = window.requestAnimationFrame(scrollToTop);
    const secondFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToTop));
    const timers = [100, 350, 800].map((delay) => window.setTimeout(scrollToTop, delay));

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
