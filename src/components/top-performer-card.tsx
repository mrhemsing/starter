"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { StartLineText } from "@/components/wrap-safe-text";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";
import type { FeaturedStartHighlight, StartLine } from "@/lib/types";

type TopPerformerCardProps = {
  href: string;
  pitcherName: string;
  team: string;
  opponent: string;
  dateLabel: string;
  score: number;
  line: StartLine;
  rank: number;
  slateCount: number;
  image: TopPerformerImage | null;
  highlight?: FeaturedStartHighlight | null;
  status: "final" | "live" | "previous";
  whiffRate?: number | null;
  topVelo?: number | null;
  veloSparkline?: number[];
};

export function TopPerformerCard({
  href,
  pitcherName,
  team,
  opponent,
  dateLabel,
  score,
  line,
  rank,
  slateCount,
  image,
  highlight,
  status,
  whiffRate,
  topVelo,
  veloSparkline = [],
}: TopPerformerCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [displayScore, setDisplayScore] = useState(score);
  const imageUrl = image?.imageUrl;
  const isPlaceholderImage = image?.source === "placeholder";
  const imageObjectPosition = image?.objectPosition ?? (isPlaceholderImage ? "50% 45%" : "50% 50%");
  const imageMobileObjectPosition = image?.mobileObjectPosition ?? imageObjectPosition;
  const scoreText = displayScore.toString().padStart(2, "0");
  const finalScoreText = score.toString().padStart(2, "0");
  const statusLabel = formatTopPerformerStatusLabel(status, dateLabel);
  const isLiveLeader = status === "live";
  const scoreStatusLabel = isLiveLeader ? "PROV" : null;
  const context = `#${rank} of ${slateCount} · league avg 50`;
  const hasVeloData = veloSparkline.length > 1 || typeof topVelo === "number" || typeof whiffRate === "number";

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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.24 },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, [score]);

  useEffect(() => {
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isVisible) return;

    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setDisplayScore(score));
      return () => cancelAnimationFrame(frame);
    }

    const duration = 620;
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

  return (
    <article
      ref={cardRef}
      className={`top-performer-card top-performer-scorebug relative overflow-hidden rounded border border-[#4A3E1C] bg-[#0A0B0D] text-[#F5F2EA] transition duration-700 lg:min-h-[500px] ${isVisible ? "is-visible" : ""}`}
      style={{ "--heat-glow-color": "246 196 69", "--heat-glow-opacity": "0.3" } as CSSProperties}
      data-responsive-check="home-top-performer-marquee"
      aria-label={`${pitcherName}, ${statusLabel.eyebrow}, ${score} GS+`}
    >
      <div className="pointer-events-none absolute -right-5 top-16 z-0 hidden font-mono text-[18rem] font-black leading-none text-[#F6C445]/[0.045] lg:block" aria-hidden="true">
        {finalScoreText}
      </div>

      <div className="grid lg:min-h-[500px] lg:grid-cols-[45%_55%]">
        <div className="relative z-10 order-2 flex flex-col justify-between gap-5 border-t border-[#4A3E1C] bg-[#0A0B0D] p-4 sm:p-5 lg:order-1 lg:border-r lg:border-t-0 lg:p-7">
          <div className="hidden lg:block">
            <p className="font-mono text-[10px] uppercase leading-[1.25] tracking-[0.22em] text-[#F6C445]">
              <TopPerformerEyebrow live={isLiveLeader} label={statusLabel.eyebrow} />
              <span className="mt-1 block">{statusLabel.detail}</span>
            </p>
            <h2 className="pitcher-name mt-3 max-w-[12ch] font-serif text-4xl font-black leading-[0.92] text-[#F5F2EA] sm:text-5xl lg:text-6xl">
              {pitcherName}
            </h2>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-[#878D97]">
              {team} vs {opponent}
            </p>
          </div>

          <div className="space-y-4">
            <div className="hidden grid-cols-5 overflow-hidden rounded border border-white/10 bg-[#15181C] font-mono lg:grid">
              <StatTile label="IP" value={line.inningsPitched.toFixed(1)} />
              <StatTile label="H" value={String(line.hits)} />
              <StatTile label="ER" value={String(line.earnedRuns)} />
              <StatTile label="BB" value={String(line.walks)} />
              <StatTile label="K" value={String(line.strikeouts)} />
            </div>

            <p className="font-mono text-xs leading-5 text-[#F5F2EA] lg:hidden">
              <StartLineText line={line} />
            </p>

            {hasVeloData ? (
              <div className="hidden rounded border border-white/10 bg-black/25 p-3 lg:block">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#878D97]">Velo by inning</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#878D97]">
                    {topVelo ? `${topVelo.toFixed(1)} top` : ""}
                    {whiffRate ? `${topVelo ? " · " : ""}${whiffRate.toFixed(0)}% whiff` : ""}
                  </p>
                </div>
                {veloSparkline.length > 1 ? <VeloSparkline values={veloSparkline} active={isVisible} /> : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 lg:flex">
              {highlight ? (
                <HeatHighlightModal
                  highlight={highlight}
                  pitcherName={pitcherName}
                  label="Video highlights"
                  eyebrow={statusLabel.eyebrow}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded border border-[#F6C445]/50 bg-[#F6C445] px-2 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[#0A0B0D] transition hover:bg-[#ffd76a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C445] sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.14em] lg:w-auto"
                />
              ) : null}
              <Link
                href={href}
                className={`inline-flex min-h-11 items-center justify-center rounded border border-[#F6C445]/40 px-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[#F6C445] transition hover:border-[#F6C445]/70 hover:text-[#ffd76a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C445] sm:px-3 sm:text-xs sm:tracking-[0.16em] ${highlight ? "" : "col-span-2 lg:w-auto"}`}
              >
                Game log
              </Link>
            </div>
          </div>
        </div>

        <div className="relative order-1 min-h-[470px] overflow-hidden bg-[#15181C] lg:order-2 lg:min-h-[500px]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={image?.alt ?? ""}
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              quality={isPlaceholderImage ? 82 : 86}
              className="top-performer-image object-cover"
              style={
                {
                  "--top-performer-image-position": imageObjectPosition,
                  "--top-performer-mobile-image-position": imageMobileObjectPosition,
                } as CSSProperties
              }
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#15181C_0%,#0A0B0D_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,11,13,0.44)_0%,rgba(10,11,13,0.05)_38%,rgba(10,11,13,0.86)_100%)] lg:bg-[linear-gradient(90deg,rgba(10,11,13,0.44)_0%,rgba(10,11,13,0.02)_38%,rgba(10,11,13,0.66)_100%)]" />
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 sm:p-5 lg:hidden">
            <p className="max-w-[68%] font-mono text-[10px] uppercase leading-[1.25] tracking-[0.16em] text-[#F6C445] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              <TopPerformerEyebrow live={isLiveLeader} label={statusLabel.eyebrow} compact />
              <span className="mt-1 block nowrap-token">{statusLabel.detail}</span>
            </p>
            <ScoreBug score={scoreText} scoreStatusLabel={scoreStatusLabel} compact />
          </div>
          {highlight ? (
            <div className="absolute inset-0 z-20 grid place-items-center lg:hidden">
              <HeatHighlightModal
                highlight={highlight}
                pitcherName={pitcherName}
                label=""
                eyebrow={statusLabel.eyebrow}
                className="grid h-14 w-14 place-items-center rounded-full border border-white/50 bg-black/65 text-[#F6C445] shadow-[0_16px_42px_rgba(0,0,0,0.46)] backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C445]"
              />
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5 lg:hidden">
            <h3 className="pitcher-name max-w-[9ch] font-serif text-4xl font-black leading-[0.92] text-[#F5F2EA] drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] sm:text-5xl">
              {pitcherName}
            </h3>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-[#F5F2EA] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
              {team} vs {opponent}
            </p>
          </div>
          <div className="absolute bottom-7 right-7 z-10 hidden text-right lg:block">
            <ScoreBug score={scoreText} scoreStatusLabel={scoreStatusLabel} />
            <p className="nowrap-token mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#F5F2EA]">{context}</p>
          </div>
          {highlight ? (
            <div className="absolute inset-0 z-20 hidden place-items-center lg:grid">
              <HeatHighlightModal
                highlight={highlight}
                pitcherName={pitcherName}
                label=""
                eyebrow={statusLabel.eyebrow}
                className="grid h-14 w-14 place-items-center rounded-full border border-white/50 bg-black/65 text-[#F6C445] shadow-[0_16px_42px_rgba(0,0,0,0.46)] backdrop-blur-sm transition hover:scale-105 hover:border-[#F6C445] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C445]"
              />
            </div>
          ) : null}
          {image?.attribution ? <CreditLine attribution={image.attribution} /> : null}
        </div>
      </div>

      <div className="border-t border-[#4A3E1C] bg-[#0A0B0D] px-4 py-3 sm:px-5 lg:hidden">
        <p className="nowrap-token font-mono text-xs text-[#F5F2EA]">{context}</p>
      </div>
    </article>
  );
}

function TopPerformerEyebrow({ live, label, compact = false }: { live: boolean; label: string; compact?: boolean }) {
  if (!live) return <span className={compact ? "nowrap-token" : ""}>{label}</span>;

  return (
    <span className={`inline-flex items-center gap-2 ${compact ? "nowrap-token" : ""}`}>
      <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function formatTopPerformerStatusLabel(status: "final" | "live" | "previous", dateLabel: string) {
  if (status === "live") {
    return {
      eyebrow: "Live GS+ leader",
      detail: `Today, ${dateLabel}`,
    };
  }

  return {
    eyebrow: "Start of the night",
    detail: dateLabel,
  };
}

function ScoreBug({ score, scoreStatusLabel, compact = false }: { score: string; scoreStatusLabel?: string | null; compact?: boolean }) {
  return (
    <div className="relative text-right">
      <p className={`font-mono font-black tabular-nums leading-[0.82] text-[#F6C445] ${compact ? "text-7xl" : "text-9xl"}`}>{score}</p>
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="h-px w-10 bg-[#F6C445]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5F2EA]">GS+</span>
        {scoreStatusLabel ? <span className="rounded border border-[#FF5A1F]/45 bg-[#FF5A1F]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#FFB199]">{scoreStatusLabel}</span> : null}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/10 p-3 last:border-r-0">
      <p className="text-2xl font-semibold tabular-nums text-[#F5F2EA]">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#878D97]">{label}</p>
    </div>
  );
}

function VeloSparkline({ values, active }: { values: number[]; active: boolean }) {
  const width = 260;
  const height = 58;
  const pad = 6;
  const points = values.length > 0 ? values : [0];
  const min = points.length > 1 ? Math.min(...points) - 1 : points[0] - 1;
  const max = points.length > 1 ? Math.max(...points) + 1 : points[0] + 1;
  const xFor = (index: number) => pad + (points.length === 1 ? (width - pad * 2) / 2 : (index / (points.length - 1)) * (width - pad * 2));
  const yFor = (value: number) => pad + ((max - value) / Math.max(1, max - min)) * (height - pad * 2);
  const path = points.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");

  return (
    <svg className="mt-2 h-16 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Average velocity by inning: ${points.map((value) => value.toFixed(1)).join(", ")}`}>
      <path className={active ? "top-performer-velo-line" : ""} d={path} fill="none" stroke="#F6C445" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      {points.map((value, index) => (
        <circle key={`${value}-${index}`} cx={xFor(index)} cy={yFor(value)} r="2.8" fill="#F6C445">
          <title>{`${value.toFixed(1)} mph`}</title>
        </circle>
      ))}
    </svg>
  );
}

function CreditLine({ attribution }: { attribution: string }) {
  return (
    <span className="absolute bottom-2 left-3 right-3 z-30 text-right font-mono text-[9px] uppercase tracking-[0.08em] text-white/80">
      {attribution}
    </span>
  );
}
