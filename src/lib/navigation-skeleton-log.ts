const navigationSkeletonCounts = new Map<string, number>();

export function logNavigationSkeletonShown(route: string) {
  const count = (navigationSkeletonCounts.get(route) ?? 0) + 1;
  navigationSkeletonCounts.set(route, count);
  console.info("[navigation-skeleton]", { route, count });
}
