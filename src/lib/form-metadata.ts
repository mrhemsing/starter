import { HEAT_BANDS, TREND_STYLES } from "@/lib/form-tokens";
import { pitcherHref } from "@/lib/routes";
import type { FormLeaderboardResponse, FormPitcherResponse, FormSummary } from "@/lib/types";

export const FORM_SITE_TITLE = "Toe the Slab";
export const FORM_PAGE_TITLE = "Heat Check";

export function formPageTitle(window: number) {
  return window === 5 ? "MLB Pitcher Heat Check - Who's Rising & Falling" : `MLB Pitcher Heat Check - Last ${window} Starts`;
}

export function formPageDescription(leaderboard: Pick<FormLeaderboardResponse, "window" | "qualifiedCount" | "heatingCount" | "coolingCount" | "leagueMeanGS">) {
  return `Every qualified MLB starter ranked by form direction. See who's heating up and cooling down over their last ${leaderboard.window} starts.`;
}

export function pitcherFormTitle(form: Pick<FormPitcherResponse, "window" | "summary">) {
  return `${form.summary.name} - Recent Form, GS+ & Start Log`;
}

export function pitcherFormDescription(form: Pick<FormPitcherResponse, "window" | "summary" | "leagueMeanGS">) {
  const band = HEAT_BANDS.find((candidate) => candidate.key === form.summary.tier) ?? HEAT_BANDS[2];
  const trend = TREND_STYLES[form.summary.trend].label;
  return `${form.summary.name} (${form.summary.team}) recent starting-pitcher form: last-${form.window} GS+, ${band.label.toLowerCase()} direction band, ${trend.toLowerCase()} trend, and full game log.`;
}

export function jsonLdForFormPage(leaderboard: FormLeaderboardResponse) {
  const leaders = leaderboard.pitchers.slice(0, 10);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: formPageTitle(leaderboard.window),
    description: formPageDescription(leaderboard),
    numberOfItems: leaderboard.count,
    itemListElement: leaders.map((pitcher, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: pitcher.name,
      url: pitcherHref(pitcher, { window: leaderboard.window }),
      additionalProperty: formSummaryProperties(pitcher),
    })),
  };
}

export function jsonLdForPitcherForm(form: FormPitcherResponse) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: pitcherFormTitle(form),
    description: pitcherFormDescription(form),
    identifier: form.summary.pitcherId,
    jobTitle: "Baseball pitcher",
    memberOf: form.summary.team ? { "@type": "SportsTeam", name: form.summary.team } : undefined,
    url: pitcherHref(form.summary),
    additionalProperty: formSummaryProperties(form.summary),
  };
}

function formSummaryProperties(summary: FormSummary) {
  return [
    { "@type": "PropertyValue", name: "Recent GS+", value: summary.rgs },
    { "@type": "PropertyValue", name: "Heat Index", value: summary.heatIndex ?? 0 },
    { "@type": "PropertyValue", name: "Trend", value: TREND_STYLES[summary.trend].label },
    { "@type": "PropertyValue", name: "Qualified Starts", value: summary.windowCount },
  ];
}
