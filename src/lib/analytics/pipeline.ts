import type { Dataset, Observation } from '../data/model';
export const analyticsConfig = {
  pseudocount: 100,
  smoothing: 0.35,
  momentumScale: 0.65,
};
export const clamp = (v: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, v));
export function popularity(value: number, max: number) {
  return max > 0 ? clamp(Math.log1p(Math.max(0, value)) / Math.log1p(max)) : 0;
}
export function momentum(
  current: number,
  previous: number,
  scale = analyticsConfig.momentumScale,
) {
  return Math.tanh(
    (Math.log(current + analyticsConfig.pseudocount) -
      Math.log(previous + analyticsConfig.pseudocount)) /
      scale,
  );
}
export interface Point {
  time: number;
  value: number | null;
  popularity: number;
  momentum: number;
  record: Observation;
}
export function prepare(data: Dataset) {
  const max = data.observations.reduce((m, o) => Math.max(m, o.value ?? 0), 1);
  const grouped = new Map<string, Observation[]>();
  for (const o of data.observations) {
    const list = grouped.get(o.hashtag) ?? [];
    list.push(o);
    grouped.set(o.hashtag, list);
  }
  const series = new Map<string, Point[]>();
  for (const identity of data.identities) {
    let previous: number | null = null;
    let previousEnd: number | null = null;
    const points = (grouped.get(identity.tag) ?? [])
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .map((record) => {
        if (record.validUntil && previousEnd !== Date.parse(record.date))
          previous = null;
        previousEnd = record.validUntil ? Date.parse(record.validUntil) : null;
        const value = record.value;
        let smoothed: number | null = null;
        if (value !== null)
          smoothed =
            previous === null
              ? value
              : Math.expm1(
                  analyticsConfig.smoothing * Math.log1p(value) +
                    (1 - analyticsConfig.smoothing) * Math.log1p(previous),
                );
        const rate =
          smoothed === null || previous === null
            ? 0
            : momentum(smoothed, previous);
        previous = smoothed;
        return {
          time: Date.parse(record.date),
          value,
          popularity: value === null ? 0 : popularity(value, max),
          momentum: rate,
          record,
        };
      });
    series.set(identity.id, points);
  }
  return series;
}
export function sample(points: Point[], time: number) {
  if (
    !points.length ||
    time < points[0].time ||
    time >
      (points.at(-1)!.record.validUntil
        ? Date.parse(points.at(-1)!.record.validUntil!)
        : points.at(-1)!.time)
  )
    return null;
  let lo = 0,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  const b = points[lo];
  if (b.time === time) return { ...b, interpolated: false };
  if (b.record.validUntil) {
    const prior = b.time <= time ? b : points[lo - 1];
    return prior?.record.validUntil &&
      time < Date.parse(prior.record.validUntil)
      ? { ...prior, time, interpolated: false }
      : null;
  }
  const a = points[Math.max(0, lo - 1)];
  if (a.value === null || b.value === null) return null;
  const t = (time - a.time) / (b.time - a.time);
  return {
    time,
    value: a.value + (b.value - a.value) * t,
    popularity: a.popularity + (b.popularity - a.popularity) * t,
    momentum: a.momentum + (b.momentum - a.momentum) * t,
    record: a.record,
    interpolated: true,
  };
}
