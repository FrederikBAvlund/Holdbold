export type Box = { top: number; left: number; width: number; height: number };

export type TooltipPlacement = {
  /** Hvor boblen sidder i forhold til det markerede element */
  side: "below" | "above";
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

const GUTTER = 16;
const GAP = 12;
const MAX_WIDTH = 340;

/**
 * Placerer forklaringen under det markerede element, eller over hvis der ikke er plads.
 * `reservedBottom` er bundmenuen på mobil, som boblen ikke må ligge bag.
 */
export function placeTooltip(
  target: Box,
  viewport: { width: number; height: number },
  tooltipHeight: number,
  reservedBottom = 0
): TooltipPlacement {
  const width = Math.min(MAX_WIDTH, viewport.width - GUTTER * 2);
  const centered = target.left + target.width / 2 - width / 2;
  const left = Math.max(GUTTER, Math.min(centered, viewport.width - width - GUTTER));

  const usableBottom = viewport.height - reservedBottom;
  const spaceBelow = usableBottom - (target.top + target.height) - GAP;
  const spaceAbove = target.top - GAP;

  if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
    const top = Math.min(target.top + target.height + GAP, usableBottom - tooltipHeight - GUTTER);
    return { side: "below", top: Math.max(GUTTER, top), left, width };
  }
  return { side: "above", bottom: Math.max(GUTTER, viewport.height - target.top + GAP), left, width };
}
