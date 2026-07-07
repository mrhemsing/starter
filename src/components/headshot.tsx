"use client";

import { useState } from "react";
import type { FormTier } from "@/lib/types";

export type HeadshotSize = "hero" | "marquee" | "simple" | "xl" | "lg" | "md" | "sm" | "xs";

type HeadshotProps = {
  playerId?: number | string | null;
  name: string;
  team?: string | null;
  size?: HeadshotSize;
  band?: FormTier | null;
  sampleSufficient?: boolean;
  decorative?: boolean;
  alt?: string;
  loading?: "eager" | "lazy";
  className?: string;
  starterStatus?: string;
};

const sizeClasses: Record<HeadshotSize, string> = {
  hero: "h-[112px] w-[75px] sm:h-[132px] sm:w-[88px] lg:h-[148px] lg:w-[99px]",
  marquee: "h-24 w-16",
  simple: "h-14 w-14 sm:h-[72px] sm:w-[72px]",
  xl: "h-[88px] w-[59px]",
  lg: "h-16 w-[43px]",
  md: "h-[52px] w-[35px]",
  sm: "h-11 w-[29px]",
  xs: "h-9 w-6",
};

export function Headshot({
  playerId,
  name,
  team,
  size = "md",
  band = null,
  sampleSufficient = true,
  decorative = false,
  alt,
  loading = "lazy",
  className = "",
  starterStatus,
}: HeadshotProps) {
  const [failed, setFailed] = useState(false);
  const resolvedBand = sampleSufficient ? band : null;
  const hasImage = Boolean(playerId) && !failed;
  const width = headshotImageWidth(size);
  const label = alt ?? (team ? `${name}, ${team}` : name);

  return (
    <span
      className={`headshot thermal-headshot ${thermalHeadshotClass(resolvedBand)} ${sizeClasses[size]} relative grid shrink-0 place-items-center overflow-hidden rounded-xl border bg-[#15181C] ${className}`}
      style={{
        borderColor: thermalBorderColor(resolvedBand),
        background: thermalBackground(resolvedBand),
      }}
      data-form-band={resolvedBand ?? "neutral"}
      data-headshot-size={size}
      data-starter-status={starterStatus}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mlbHeadshotUrl(String(playerId), width)}
          alt={decorative ? "" : label}
          width={width}
          height={width}
          loading={loading}
          onError={() => setFailed(true)}
          className="headshot__img relative z-10"
        />
      ) : (
        <span className="relative z-10 flex h-full w-full items-center justify-center bg-black/10 font-mono text-xs font-semibold text-zinc-300">
          {initials(name || team || "TBD")}
        </span>
      )}
    </span>
  );
}

export function mlbHeadshotUrl(playerId: string, width: number) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

function headshotImageWidth(size: HeadshotSize) {
  if (size === "hero") return 320;
  if (size === "marquee") return 280;
  if (size === "simple") return 220;
  if (size === "xl") return 240;
  if (size === "lg") return 180;
  if (size === "md") return 140;
  if (size === "sm") return 120;
  return 100;
}

function thermalHeadshotClass(band: FormTier | null) {
  if (band === "onfire") return "headshot--onfire";
  if (band === "hot") return "headshot--hot";
  if (band === "cooling") return "headshot--cooling";
  if (band === "ice") return "headshot--ice";
  return "headshot--neutral";
}

function thermalBorderColor(band: FormTier | null) {
  if (band === "onfire") return "#FF5A1F";
  if (band === "hot") return "#FF7A3D";
  if (band === "cooling") return "#8FCBFF";
  if (band === "ice") return "#5BA8FF";
  return "#888780";
}

function thermalBackground(band: FormTier | null) {
  if (band === "onfire") return "radial-gradient(circle at 50% 18%, rgba(255, 90, 31, 0.22), rgba(21, 24, 28, 0.96) 62%)";
  if (band === "ice") return "radial-gradient(circle at 50% 18%, rgba(91, 168, 255, 0.24), rgba(21, 24, 28, 0.96) 62%)";
  if (band === "hot") return "radial-gradient(circle at 50% 18%, rgba(255, 122, 61, 0.16), rgba(21, 24, 28, 0.96) 62%)";
  if (band === "cooling") return "radial-gradient(circle at 50% 18%, rgba(143, 203, 255, 0.16), rgba(21, 24, 28, 0.96) 62%)";
  return "linear-gradient(135deg, rgba(136, 135, 128, 0.14), rgba(21, 24, 28, 0.96) 54%)";
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
