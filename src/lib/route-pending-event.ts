export const ROUTE_PENDING_EVENT = "toe-the-slab:route-pending";

export type RoutePendingDetail = {
  label?: string;
  secondary?: string;
};

export function dispatchRoutePending(detail: RoutePendingDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RoutePendingDetail>(ROUTE_PENDING_EVENT, { detail }));
}
