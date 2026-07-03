"use client";

import { useEffect } from "react";

export function HeatCheckClientTeamFilter({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    const board = document.querySelector<HTMLElement>("[data-heat-client-team-board]");
    if (!enabled || !board) return;

    const applyTeam = (team: string) => {
      const normalized = team.trim().toUpperCase();
      board.dataset.heatClientTeam = normalized;
      board.dataset.heatClientTeamActive = normalized ? "true" : "false";
      for (const row of board.querySelectorAll<HTMLElement>("[data-form-row]")) {
        row.dataset.heatClientVisible = normalized && row.dataset.heatTeam === normalized ? "true" : "false";
      }
      for (const link of document.querySelectorAll<HTMLElement>("[data-heat-client-team-link][data-team]")) {
        const linkTeam = link.dataset.team === "all" ? "" : (link.dataset.team ?? "").toUpperCase();
        link.dataset.heatClientActive = linkTeam === normalized ? "true" : "false";
      }
      for (const section of board.querySelectorAll<HTMLElement>("[data-heat-band-section]")) {
        const visibleRows = normalized
          ? section.querySelectorAll(`[data-form-row][data-heat-team="${normalized}"]`).length
          : section.querySelectorAll("[data-form-row]").length;
        section.dataset.heatBandClientEmpty = visibleRows === 0 ? "true" : "false";
      }
    };

    const teamFromLocation = () => new URLSearchParams(window.location.search).get("team") ?? "";
    const onTeamRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{ team?: string; href?: string }>;
      const team = customEvent.detail?.team ?? "";
      const href = customEvent.detail?.href;
      if (!href) return;
      event.preventDefault();
      const link = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-heat-client-team-link]") : null;
      if (link) link.dataset.heatClientTeamHandled = "true";
      applyTeam(team);
      window.history.pushState({ heatClientTeam: team }, "", href);
      window.dispatchEvent(new CustomEvent("route-control-pending-clear", { detail: { region: "heat-check-board" } }));
    };
    const onPopState = () => applyTeam(teamFromLocation());

    applyTeam(teamFromLocation());
    document.addEventListener("heat-client-team-filter-request", onTeamRequest);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("heat-client-team-filter-request", onTeamRequest);
      window.removeEventListener("popstate", onPopState);
    };
  }, [enabled]);

  return null;
}
