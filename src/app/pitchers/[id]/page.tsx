import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PitcherFormPage from "./form/page";
import { getPitcherForm, parseFormWindow } from "@/lib/data/form-service";
import { FORM_CONFIG } from "@/lib/form-tokens";
import { pitcherFormDescription } from "@/lib/form-metadata";
import { parsePitcherRouteParam, pitcherHref } from "@/lib/routes";

type PitcherPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    window?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: PitcherPageProps): Promise<Metadata> {
  const routeParams = await params;
  const id = parsePitcherRouteParam(routeParams.id);
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const form = await getPitcherForm(id, { window });
  if (!form) return {};

  const isDefaultWindow = window === FORM_CONFIG.windowDefault;
  const url = pitcherHref(form.summary, isDefaultWindow ? undefined : { window });
  const image = `/pitchers/${id}/form/opengraph-image${isDefaultWindow ? "" : `?window=${window}`}`;
  const title = `${form.summary.name} - GS+, Form & Heat Check · Toe the Slab`;
  const description = pitcherFormDescription(form);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "profile",
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PitcherPage({ params, searchParams }: PitcherPageProps) {
  const routeParams = await params;
  const id = parsePitcherRouteParam(routeParams.id);
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const form = await getPitcherForm(id, { window });
  if (!form) notFound();

  const isDefaultWindow = window === FORM_CONFIG.windowDefault;
  const canonicalHref = pitcherHref(form.summary, isDefaultWindow ? undefined : { window });
  const currentHref = `/pitchers/${routeParams.id}${isDefaultWindow ? "" : `?window=${window}`}`;
  if (currentHref !== canonicalHref) permanentRedirect(canonicalHref);

  return (
    <PitcherFormPage
      params={Promise.resolve({ id })}
      searchParams={searchParams}
    />
  );
}
