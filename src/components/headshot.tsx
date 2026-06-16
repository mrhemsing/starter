"use client";

import { useState } from "react";
import type { FormTier } from "@/lib/types";

export type HeadshotSize = "xl" | "lg" | "md" | "sm" | "xs";

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
        borderColor: thermalBorderColor(resolvedBand, teamColor(team)),
        background: thermalBackground(resolvedBand, teamColor(team)),
      }}
      data-form-band={resolvedBand ?? "neutral"}
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

function thermalBorderColor(band: FormTier | null, fallback: string) {
  if (band === "onfire") return "#FF3B1F";
  if (band === "hot") return "#FF8A3D";
  if (band === "cooling") return "#5BA8FF";
  if (band === "ice") return "#8FCBFF";
  return fallback;
}

function thermalBackground(band: FormTier | null, fallback: string) {
  if (band === "onfire") return "radial-gradient(circle at 50% 18%, rgba(255, 59, 31, 0.22), rgba(21, 24, 28, 0.96) 62%)";
  if (band === "ice") return "radial-gradient(circle at 50% 18%, rgba(143, 203, 255, 0.24), rgba(21, 24, 28, 0.96) 62%)";
  if (band === "hot") return "radial-gradient(circle at 50% 18%, rgba(255, 138, 61, 0.16), rgba(21, 24, 28, 0.96) 62%)";
  if (band === "cooling") return "radial-gradient(circle at 50% 18%, rgba(91, 168, 255, 0.16), rgba(21, 24, 28, 0.96) 62%)";
  return `linear-gradient(135deg, ${fallback}22, rgba(21, 24, 28, 0.96) 54%)`;
}

function teamColor(team?: string | null) {
  if (!team) return "#3f3f46";
  const code = team.toUpperCase();
  const colors: Record<string, string> = {
    ARI: "#A71930",
    ATL: "#CE1141",
    BAL: "#DF4601",
    BOS: "#BD3039",
    CHC: "#0E3386",
    CWS: "#C4CED4",
    CIN: "#C6011F",
    CLE: "#E31937",
    COL: "#33006F",
    DET: "#0C2340",
    HOU: "#EB6E1F",
    KC: "#004687",
    LAA: "#BA0021",
    LAD: "#005A9C",
    MIA: "#00A3E0",
    MIL: "#FFC52F",
    MIN: "#002B5C",
    NYM: "#FF5910",
    NYY: "#0C2340",
    OAK: "#003831",
    PHI: "#E81828",
    PIT: "#FDB827",
    SD: "#2F241D",
    SEA: "#005C5C",
    SF: "#FD5A1E",
    STL: "#C41E3A",
    TB: "#8FBCE6",
    TEX: "#003278",
    TOR: "#134A8E",
    WSH: "#AB0003",
  };
  return colors[code] ?? "#3f3f46";
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
