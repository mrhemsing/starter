"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { WatchlistSort } from "@/lib/data/watchlist-service";

type WatchlistSearchFormProps = {
  query: string;
  sort: WatchlistSort;
};

export function WatchlistSearchForm({ query, sort }: WatchlistSearchFormProps) {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = String(formData.get("q") ?? "").trim();
    const params = new URLSearchParams();
    if (sort !== "default") params.set("sort", sort);
    if (nextQuery) params.set("q", nextQuery);
    const nextPath = `/watchlist${params.size > 0 ? `?${params}` : ""}`;
    router.replace(nextPath, { scroll: false });
  }

  return (
    <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSubmit} data-responsive-check="watchlist-search">
      <input type="hidden" name="sort" value={sort} />
      <input
        name="q"
        defaultValue={query}
        placeholder="Search pitchers"
        className="min-h-11 rounded border border-white/10 bg-black/20 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-amber-300"
      />
      <button className="min-h-11 rounded border border-amber-300/40 px-4 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
        Search
      </button>
    </form>
  );
}
