import type { NutritionBucket } from '@/logic/nutritionRange';

export interface TrendChartPoint {
  bucket: NutritionBucket;
  index: number;
  x: number;
  y: number;
  plottable: boolean;
  partial: boolean;
}

export interface TrendChartSegment {
  from: TrendChartPoint;
  to: TrendChartPoint;
  partial: boolean;
}

export interface TrendChartModel {
  points: TrendChartPoint[];
  segments: TrendChartSegment[];
  maximum: number;
}

/** Pure SVG geometry. Unknown and no-meal dates remain accessible points but
 * break the visual line instead of being misrepresented as complete zeroes. */
export function buildTrendChartModel(
  buckets: readonly NutritionBucket[],
  width: number,
  height: number,
  pointDiameter: number,
): TrendChartModel {
  const known = buckets.flatMap((bucket) => isPlottable(bucket) ? [bucket.knownValue!] : []);
  const maximum = Math.max(1, ...known);
  const columnWidth = buckets.length === 0 ? width : width / buckets.length;
  const radius = pointDiameter / 2;
  const drawableHeight = Math.max(0, height - pointDiameter);
  const points = buckets.map((bucket, index): TrendChartPoint => {
    const plottable = isPlottable(bucket);
    const ratio = plottable ? bucket.knownValue! / maximum : 0;
    return {
      bucket,
      index,
      x: columnWidth * index + columnWidth / 2,
      y: radius + drawableHeight * (1 - ratio),
      plottable,
      partial: bucket.coverage === 'partial',
    };
  });
  const segments = points.slice(0, -1).flatMap((point, index) => {
    const next = points[index + 1]!;
    if (!point.plottable || !next.plottable) return [];
    return [{ from: point, to: next, partial: point.partial || next.partial }];
  });
  return { points, segments, maximum };
}

function isPlottable(bucket: NutritionBucket): boolean {
  return bucket.knownValue !== null
    && bucket.coverage !== 'unknown'
    && bucket.coverage !== 'no-meals';
}
