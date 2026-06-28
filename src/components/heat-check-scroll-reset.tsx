"use client";

import { useLayoutEffect } from "react";

export function HeatCheckScrollReset() {
  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation && navigation.type !== "navigate" && navigation.type !== "reload") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const firstFrame = window.requestAnimationFrame(scrollToTop);
    const secondFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToTop));
    const timers = [50, 150, 350, 800].map((delay) => window.setTimeout(scrollToTop, delay));

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
