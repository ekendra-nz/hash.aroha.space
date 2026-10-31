import type { Dataset } from '../data/model';
import { sample, type Point, clamp } from './pipeline';
import { visual } from '../visualization/config';
const DAY = 86400000;
export function ageRadius(ageDays: number, ageYears = visual.ageYears) {
  return (
    visual.ageRadius *
    (1 - Math.exp(-Math.max(0, ageDays) / (ageYears * 365.25)))
  );
}
/** Denominator is the entire loaded cohort, never just the visible subset. */
export function ecosystem(
  data: Dataset,
  series: Map<string, Point[]>,
  time: number,
  ageYears = visual.ageYears,
) {
  const samples = data.identities.map((identity) => ({
    identity,
    point: sample(series.get(identity.id) ?? [], time),
  }));
  const total = samples.reduce(
    (sum, e) =>
      sum +
      (e.identity.bornAt !== null && time >= e.identity.bornAt
        ? (e.point?.value ?? 0)
        : 0),
    0,
  );
  return samples.map(({ identity, point }) => {
    const born = identity.bornAt !== null && time >= identity.bornAt;
    const ageDays = born ? (time - identity.bornAt!) / DAY : 0;
    const share = born && total > 0 ? (point?.value ?? 0) / total : 0;
    const birth =
      identity.birthBasis === 'first-seen'
        ? 1
        : clamp(ageDays / visual.birthDays);
    const presence = birth * clamp(share / visual.fadeShare);
    const radius = ageRadius(ageDays, ageYears);
    return {
      identity,
      point,
      share,
      ageDays,
      presence,
      born,
      position: [
        Math.cos(identity.angle) * radius,
        Math.sqrt(29 ** 2 - radius ** 2) - 29 + 0.07,
        Math.sin(identity.angle) * radius,
      ] as [number, number, number],
    };
  });
}
export type EcosystemEntity = ReturnType<typeof ecosystem>[number];
