/**
 * S-curve enrollment model — extracted from sampleData for reuse.
 */
export const ENROLLMENT_CURVE: [number, number][] = [
  [0.00, 0.050], [0.05, 0.143], [0.10, 0.273], [0.15, 0.393], [0.20, 0.463],
  [0.25, 0.518], [0.30, 0.562], [0.35, 0.607], [0.40, 0.651], [0.45, 0.693],
  [0.50, 0.730], [0.55, 0.757], [0.60, 0.789], [0.65, 0.820], [0.70, 0.850],
  [0.75, 0.870], [0.80, 0.900], [0.85, 0.920], [0.90, 0.940], [0.95, 0.970],
  [1.00, 1.000],
];

export function getExpectedPct(pctOfTransition: number): number {
  for (let i = 0; i < ENROLLMENT_CURVE.length - 1; i++) {
    const [x0, y0] = ENROLLMENT_CURVE[i];
    const [x1, y1] = ENROLLMENT_CURVE[i + 1];
    if (pctOfTransition >= x0 && pctOfTransition <= x1) {
      const t = (pctOfTransition - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 1.0;
}

export function totalWeeks(start: string, end: string): number | null {
  if (!start || !end) return null;
  return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export function weeksRemaining(openingDate: string): number {
  const now = new Date();
  const open = new Date(openingDate);
  return Math.max(0, Math.ceil((open.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}
