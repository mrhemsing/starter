"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";

type TopPerformerCardProps = {
  href: string;
  pitcherName: string;
  team: string;
  opponent: string;
  lineLabel: string;
  score: number;
  image: TopPerformerImage | null;
  isProvisional: boolean;
};

export function TopPerformerCard({ href, pitcherName, team, opponent, lineLabel, score, image, isProvisional }: TopPerformerCardProps) {
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [scrollShift, setScrollShift] = useState(0);
  const [displayScore, setDisplayScore] = useState(score);
  const isFullBleed = image?.source === "action" || image?.source === "highlight";

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
        setDisplayScore(score);
      });
      return () => cancelAnimationFrame(frame);
    }

    const card = cardRef.current;
    if (!card) return;

    let animationFrame = 0;
    const updateScrollShift = () => {
      const rect = card.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progress = (viewport - rect.top) / (viewport + rect.height);
      const clamped = Math.max(0, Math.min(1, progress));
      setScrollShift((clamped - 0.5) * 28);
    };

    const onScroll = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateScrollShift);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.28 },
    );

    updateScrollShift();
    observer.observe(card);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [score]);

  useEffect(() => {
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isVisible) return;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setDisplayScore(score));
      return () => cancelAnimationFrame(frame);
    }

    const duration = 850;
    const start = performance.now();
    let animationFrame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(() => {
      setDisplayScore(0);
      animationFrame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [isVisible, score]);

  const imageScale = 1.04 + Math.abs(scrollShift) / 900;
  const imageStyle = { transform: `translate3d(0, ${scrollShift}px, 0) scale(${imageScale})` };
  const desktopFullBleedImageStyle = { transform: `translate3d(0, calc(${scrollShift}px - 15%), 0) scale(${imageScale})` };
  const eyebrow = isProvisional ? "The one to beat" : "Start of the night";

  return (
    <a
      ref={cardRef}
      href={href}
      className={`top-performer-card heat-glow-card group relative block overflow-hidden rounded border border-amber-300/25 bg-[#09090b] transition duration-700 hover:border-amber-300/50 sm:grid sm:min-h-[430px] lg:min-h-[520px] ${isVisible ? "is-visible" : ""}`}
      style={{ "--heat-glow-color": "239 159 39", "--heat-glow-opacity": "0.44" } as CSSProperties}
      data-responsive-check="home-top-performer-marquee"
    >
      {image && isFullBleed ? (
        <>
          <div className="relative h-80 overflow-hidden sm:hidden">
            <Image
              src={image.imageUrl}
              alt={image.alt}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.08)_34%,rgba(0,0,0,0.03)_58%,rgba(0,0,0,0.78)_100%)]" />
            {image.source === "highlight" && image.playUrl ? <PlayAffordance className="right-4 top-4" /> : null}
            {image.source === "action" && image.attribution ? <CreditLine attribution={image.attribution} className="bottom-3 left-3 right-3" /> : null}
          </div>
          <div className="top-performer-photo-wrap absolute inset-y-0 left-[30%] right-[-30%] hidden sm:block" style={desktopFullBleedImageStyle}>
            <Image
              src={image.imageUrl}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              className="object-cover object-top opacity-100 transition duration-500 group-hover:scale-[1.015]"
              priority
            />
          </div>
          <div className="absolute inset-y-0 left-[18%] hidden w-[38%] bg-[linear-gradient(90deg,#09090b_0%,rgba(9,9,11,0.96)_28%,rgba(9,9,11,0.62)_64%,transparent_100%)] sm:block" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.84)_24%,rgba(0,0,0,0.36)_48%,rgba(0,0,0,0.08)_66%,transparent_82%)] sm:block" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.18)_24%,rgba(0,0,0,0.02)_48%,rgba(0,0,0,0.22)_70%,rgba(0,0,0,0.86)_100%)] sm:block" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(253,184,39,0.32),transparent_34%),linear-gradient(135deg,rgba(0,0,0,0.96)_0%,rgba(33,20,8,0.72)_100%)]" />
          <div className="absolute inset-y-0 right-0 w-[52%] bg-[radial-gradient(circle_at_54%_46%,rgba(253,184,39,0.28),transparent_58%)]" />
          {image ? (
            <div className="top-performer-photo-wrap absolute bottom-0 right-[-22px] h-[72%] max-h-[320px] w-[54%] sm:right-3 sm:h-[88%] sm:max-h-[430px] sm:w-[46%]" style={imageStyle}>
              <Image
                src={image.imageUrl}
                alt={image.alt}
                width={360}
                height={360}
                sizes="(min-width: 1024px) 300px, 52vw"
                className="h-full w-full object-contain object-bottom opacity-95 drop-shadow-[0_18px_45px_rgba(0,0,0,0.72)] transition duration-500 group-hover:scale-[1.02]"
                priority
              />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.60)_42%,rgba(0,0,0,0.94)_100%)] sm:bg-[linear-gradient(90deg,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.74)_52%,rgba(0,0,0,0.18)_100%)]" />
        </>
      )}
      <div className="absolute left-0 top-0 hidden h-full w-[48%] bg-[radial-gradient(ellipse_at_20%_20%,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_34%,rgba(0,0,0,0.18)_64%,transparent_84%)] sm:block" />
      <div className="relative flex flex-col gap-5 bg-[#09090b] p-5 sm:min-h-[430px] sm:justify-between sm:gap-7 sm:bg-transparent sm:p-7 lg:min-h-[520px]">
        <div className="max-w-[17.5rem] sm:max-w-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">{eyebrow}</p>
          <h2 className="mt-3 font-serif text-4xl font-black leading-none text-zinc-50 drop-shadow-[0_4px_22px_rgba(0,0,0,0.86)] sm:text-6xl">
            {pitcherName}
          </h2>
          <p className="mt-4 max-w-xs rounded bg-black/55 px-2.5 py-2 font-mono text-xs uppercase leading-5 tracking-[0.12em] text-zinc-100 shadow-[0_0_24px_rgba(0,0,0,0.62)] backdrop-blur-[2px] sm:max-w-sm">
            {team} vs {opponent} · {lineLabel}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <span className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/10 bg-black/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200 shadow-[0_10px_34px_rgba(0,0,0,0.52)] backdrop-blur-sm sm:w-auto sm:justify-self-start">
            View start log
          </span>
          <div className="top-performer-score relative justify-self-end text-right">
            <div className="absolute -inset-x-8 -inset-y-5 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.58)_42%,rgba(239,159,39,0.20)_63%,transparent_78%)] blur-sm" aria-hidden="true" />
            <p className="relative font-serif text-8xl font-black leading-none text-amber-300 drop-shadow-[0_0_28px_rgba(239,159,39,0.66)] sm:text-9xl">{displayScore}</p>
            <p className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100">GS+</p>
          </div>
        </div>
      </div>
      {image?.source === "highlight" && image.playUrl ? <PlayAffordance className="right-4 top-4 hidden sm:grid" /> : null}
      {image?.source === "action" && image.attribution ? <CreditLine attribution={image.attribution} className="bottom-3 left-4 right-4 hidden sm:block" /> : null}
    </a>
  );
}

function PlayAffordance({ className = "" }: { className?: string }) {
  return (
    <span className={`absolute grid h-12 w-12 place-items-center rounded-full border border-white/45 bg-black/65 text-amber-200 shadow-lg ${className}`}>
      <span className="ml-1 h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-current" />
    </span>
  );
}

function CreditLine({ attribution, className = "" }: { attribution: string; className?: string }) {
  return (
    <span className={`absolute rounded bg-black/52 px-2 py-1 text-right font-mono text-[9px] uppercase tracking-[0.08em] text-white/80 shadow-[0_0_18px_rgba(0,0,0,0.82)] ${className}`}>
      {attribution}
    </span>
  );
}
