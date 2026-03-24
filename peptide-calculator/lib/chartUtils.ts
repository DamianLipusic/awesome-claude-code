/**
 * Build an SVG fill-area path for hydrophobicity / charge charts.
 * points  – pre-mapped {x, y} pixel coordinates
 * y0      – pixel y of the zero line
 * side    – 'pos' clips to values above zero, 'neg' below
 * xStart  – pixel x to close the left edge back to the zero line
 * xEnd    – pixel x to close the right edge to the zero line
 */
export function buildFillPath(
  points: { x: number; y: number }[],
  y0: number,
  side: 'pos' | 'neg',
  xStart: number,
  xEnd: number,
): string {
  const clamp = side === 'pos' ? Math.min : Math.max;
  return (
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${clamp(p.y, y0).toFixed(1)}`)
      .join(' ') +
    ` L ${xEnd.toFixed(1)} ${y0.toFixed(1)} L ${xStart.toFixed(1)} ${y0.toFixed(1)} Z`
  );
}
