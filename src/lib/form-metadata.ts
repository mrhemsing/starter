import { tierOf, TREND_STYLES } from "@/lib/form-tokens";
import type { FormLeaderboardResponse, FormPitcherResponse, FormSummary } from "@/lib/types";

export const FORM_SITE_TITLE = "The Bump";
export const FORM_PAGE_TITLE = "Heat Check";

export function formPageTitle(window: number) {
  return `${FORM_PAGE_TITLE}: MLB starter form over the last ${window}`;
}

export function formPageDescription(leaderboard: Pick<FormLeaderboardResponse, "window" | "qualifiedCount" | "heatingCount" | "coolingCount" | "leagueMeanGS">) {
  return `${leaderboard.qualifiedCount} qualified MLB starters ranked by recent GS+ form over their last ${leaderboard.window} starts. ${leaderboard.heatingCount} rising, ${leaderboard.coolingCount} falling, league mean ${leaderboard.leagueMeanGS.toFixed(1)}.`;
}

export function pitcherFormTitle(form: Pick<FormPitcherResponse, "window" | "summary">) {
  return `${form.summary.name} Heat Check: ${Math.round(form.summary.rgs)} form`;
}

export function pitcherFormDescription(form: Pick<FormPitcherResponse, "window" | "summary" | "leagueMeanGS">) {
  const band = tierOf(Math.round(form.summary.rgs));
  const trend = TREND_STYLES[form.summary.trend].label;
  return `${form.summary.name} is ${band.label.toLowerCase()} with ${Math.round(form.summary.rgs)} recent GS+ over ${form.summary.windowCount} qualified starts, ${trend.toLowerCase()} against a ${form.leagueMeanGS.toFixed(1)} league mean.`;
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
      url: `/pitchers/${pitcher.pitcherId}/form?window=${leaderboard.window}`,
      additionalProperty: formSummaryProperties(pitcher),
    })),
  };
}

export function jsonLdForPitcherForm(form: FormPitcherResponse) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: pitcherFormTitle(form),
    description: pitcherFormDescription(form),
    competitor: {
      "@type": "Person",
      name: form.summary.name,
      identifier: form.summary.pitcherId,
      memberOf: form.summary.team ? { "@type": "SportsTeam", name: form.summary.team } : undefined,
    },
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
