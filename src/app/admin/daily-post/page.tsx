import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getDailySocialPostDraft } from "@/lib/data/daily-social-post-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { noIndexFollow } from "@/lib/seo";

type DailyPostAdminPageProps = {
  searchParams?: Promise<{
    date?: string;
    token?: string;
  }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Social Preview",
  robots: noIndexFollow(),
};

export default async function DailyPostAdminPage({ searchParams }: DailyPostAdminPageProps) {
  const params = await searchParams;
  enforceAdminGate(params?.token);

  const date = params?.date ?? previousDate(getHomeSlateDate());
  const draft = await getDailySocialPostDraft(date);
  const today = getHomeSlateDate();

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <SiteHeader active={null} today={today} responsiveCheck="daily-post-admin-header" />

        <section className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">Admin preview</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-5xl font-black leading-none text-zinc-50">Daily social post</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Review the Start of the Day renders and captions before publishing. Posting integrations stay separate from this P0 preview surface.
              </p>
            </div>
            <Link href={`/api/social/start-of-day?date=${date}`} className="inline-flex min-h-11 items-center rounded border border-white/10 px-4 font-mono text-xs uppercase tracking-[0.16em] text-zinc-300 transition hover:border-amber-300/50 hover:text-amber-200">
              JSON
            </Link>
          </div>
        </section>

        {draft.status === "ready" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="space-y-6">
              <PreviewImage title="Instagram" detail="1080 x 1350" src={draft.start.renderUrls.instagram} />
              <PreviewImage title="X" detail="1600 x 900" src={draft.start.renderUrls.x} />
            </div>

            <aside className="space-y-5">
              <div className="rounded border border-white/10 bg-[#101014] p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">Resolved winner</p>
                <h2 className="mt-3 font-serif text-4xl font-bold leading-none text-zinc-50">{draft.start.name}</h2>
                <dl className="mt-5 grid grid-cols-2 gap-3 font-mono text-xs uppercase tracking-[0.12em]">
                  <Metric label="Date" value={draft.start.date} />
                  <Metric label="GS+" value={String(draft.start.gsPlus)} accent />
                  <Metric label="Matchup" value={`${draft.start.team} vs ${draft.start.opponent}`} />
                  <Metric label="Result" value={draft.start.result} />
                </dl>
              </div>

              <CaptionBlock title="Instagram caption" value={draft.copy.instagram} />
              <CaptionBlock title="X post" value={draft.copy.x} />
              <CaptionBlock title="Rankings reply link" value={draft.copy.rankingsUrl} />
            </aside>
          </section>
        ) : (
          <section className="rounded border border-white/10 bg-[#101014] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">No post generated</p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-zinc-50">{draft.reason}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{draft.message}</p>
            {draft.tiedPitchers ? <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-zinc-300">Tied: {draft.tiedPitchers.join(", ")}</p> : null}
          </section>
        )}
      </div>
    </main>
  );
}

function PreviewImage({ title, detail, src }: { title: string; detail: string; src: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-sm uppercase tracking-[0.18em] text-zinc-200">{title}</h2>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{detail}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${title} Start of the Day render`} className="w-full rounded border border-white/10 bg-black" />
    </section>
  );
}

function CaptionBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded border border-white/10 bg-[#101014] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-sm leading-6 text-zinc-100">{value}</pre>
    </section>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <dt className="text-[10px] text-zinc-500">{label}</dt>
      <dd className={`mt-2 text-sm ${accent ? "text-amber-300" : "text-zinc-100"}`}>{value}</dd>
    </div>
  );
}

function enforceAdminGate(token: string | undefined) {
  const expectedToken = process.env.DAILY_POST_ADMIN_TOKEN;
  if (expectedToken && token !== expectedToken) notFound();
}

function previousDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}
