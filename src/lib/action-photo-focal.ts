const SAFE_REGION_MARGIN = 0.15;

export type ActionPhotoFocalPoint = {
  x: number;
  y: number;
};

export function clampActionPhotoObjectPosition({
  focal,
  imageAspect = 16 / 9,
  containerAspect = 3.7,
  margin = SAFE_REGION_MARGIN,
}: {
  focal: ActionPhotoFocalPoint | null | undefined;
  imageAspect?: number;
  containerAspect?: number;
  margin?: number;
}) {
  if (!focal || !Number.isFinite(focal.x) || !Number.isFinite(focal.y)) return "center 30%";
  const focalX = normalizeFocal(focal.x);
  const focalY = normalizeFocal(focal.y);

  if (imageAspect >= containerAspect) {
    const renderedWidth = imageAspect;
    const containerWidth = containerAspect;
    return `${cssPositionForAxis(focalX, renderedWidth, containerWidth, margin)}% ${Math.round(focalY * 100)}%`;
  }

  const renderedHeight = containerAspect / imageAspect;
  return `${Math.round(focalX * 100)}% ${cssPositionForAxis(focalY, renderedHeight, 1, margin)}%`;
}

function cssPositionForAxis(focal: number, renderedSize: number, containerSize: number, margin: number) {
  if (renderedSize <= containerSize) return Math.round(focal * 100);
  const visibleRatio = containerSize / renderedSize;
  const overflowRatio = 1 - visibleRatio;
  const lower = (focal - (1 - margin) * visibleRatio) / overflowRatio;
  const upper = (focal - margin * visibleRatio) / overflowRatio;
  const centered = (focal - 0.5 * visibleRatio) / overflowRatio;
  return Math.round(clamp(centered, lower, upper, 0, 1) * 100);
}

function normalizeFocal(value: number) {
  return Math.min(1, Math.max(0, value > 1 ? value / 100 : value));
}

function clamp(value: number, lower: number, upper: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.min(upper, Math.max(lower, value))));
}
