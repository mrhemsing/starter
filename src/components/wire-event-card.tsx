import type { WatchlistWireEvent } from "@/lib/data/watchlist-service";

type WireEventCardProps = {
  event: WatchlistWireEvent;
  pitcherName?: string;
  className?: string;
};

export function WireEventCard({ event, pitcherName, className }: WireEventCardProps) {
  const sharedClassName = className ?? "rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/40";
  const headline = event.headline?.text ?? event.sentence ?? pitcherName ?? "Wire item";

  return (
    <a href={event.headline?.url ?? "#"} target="_blank" rel="noopener" className={sharedClassName} data-wire-event={event.key} data-wire-payload={event.payloadValues.join("|")}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" data-wire-eyebrow>{event.headline?.source ?? "News"} · {relativeEventTime(event.headline?.publishedAt ?? event.detectedAt)}</p>
        <span className="h-2 w-2 rounded-full bg-amber-300" aria-label="Unread Wire item" />
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-zinc-100">{headline}</p>
    </a>
  );
}

function relativeEventTime(detectedAt: string) {
  const elapsedMs = Date.now() - Date.parse(detectedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return "Just now";
  const minutes = Math.round(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return formatArticleDate(detectedAt);
}

function formatArticleDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(date);
}
