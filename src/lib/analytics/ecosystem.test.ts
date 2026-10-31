import { describe, it, expect } from 'vitest';
import { dataset, type Observation } from '../data/model';
import { prepare } from './pipeline';
import { ecosystem, ageRadius } from './ecosystem';
import { createDemo } from '../data/demo';
import { parseImport } from '../data/import';
const row = (
  hashtag: string,
  value: number,
  date = '2024-01-01',
  bornAt = '2020-01-01',
): Observation => ({
  hashtag,
  value,
  date,
  bornAt,
  source: 'test',
  platform: 'test',
  measurement: 'count',
  granularity: 'day',
  status: 'simulated',
});
describe('attention ecosystem', () => {
  it('uses cohort ratios independent of units, and areas proportional to shares', () => {
    const d = dataset('test', [row('#A', 10), row('#B', 90)]),
      e = ecosystem(d, prepare(d), Date.parse('2024-01-01'));
    expect(e.map((x) => x.share)).toEqual([0.1, 0.9]);
    const scaled = dataset(
      'scaled',
      d.observations.map((o) => ({ ...o, value: o.value! * 1000 })),
    );
    expect(
      ecosystem(scaled, prepare(scaled), Date.parse('2024-01-01')).map(
        (x) => x.share,
      ),
    ).toEqual([0.1, 0.9]);
    expect((Math.sqrt(e[1].share) / Math.sqrt(e[0].share)) ** 2).toBeCloseTo(9);
  });
  it('has no presence before birth and grows smoothly from the origin', () => {
    const d = dataset('test', [
      row('#A', 100, '2024-01-01', '2024-01-01'),
      row('#A', 100, '2024-06-01', '2024-01-01'),
    ]);
    const series = prepare(d),
      born = Date.parse('2024-01-01');
    expect(ecosystem(d, series, born - 1)[0].presence).toBe(0);
    expect(ecosystem(d, series, born)[0].position[0]).toBe(0);
    expect(ecosystem(d, series, born)[0].presence).toBe(0);
    expect(ecosystem(d, series, born + 50 * 86400000)[0].presence).toBe(0.5);
  });
  it('moves older signals outward without making them smaller, including a resurgence', () => {
    expect(ageRadius(3650)).toBeGreaterThan(ageRadius(365));
    const d = dataset('test', [
      row('#A', 100, '2024-01-01'),
      row('#A', 0, '2024-02-01'),
      row('#A', 100, '2024-03-01'),
    ]);
    const series = prepare(d),
      a = ecosystem(d, series, Date.parse('2024-01-01'))[0],
      b = ecosystem(d, series, Date.parse('2024-03-01'))[0];
    expect(a.share).toBe(b.share);
    expect(b.ageDays).toBeGreaterThan(a.ageDays);
    expect(ecosystem(d, series, Date.parse('2024-02-01'))[0].presence).toBe(0);
    expect(b.presence).toBe(1);
  });
  it('infers first seen, not true birth; handles empty attention', () => {
    const d = dataset('test', [
      { ...row('#A', 0), bornAt: undefined },
      { ...row('#A', 5, '2024-02-01'), bornAt: undefined },
    ]);
    expect(d.identities[0].birthBasis).toBe('first-seen');
    expect(d.identities[0].bornAt).toBe(Date.parse('2024-02-01'));
    expect(ecosystem(d, prepare(d), Date.parse('2024-01-01'))[0].share).toBe(0);
  });
  it('has staggered demo births and no prebirth activity', () => {
    const d = createDemo();
    expect(new Set(d.identities.map((x) => x.bornAt)).size).toBe(42);
    for (const o of d.observations)
      if (Date.parse(o.date) <= Date.parse(o.bornAt!)) expect(o.value).toBe(0);
  });
  it('rejects inconsistent or impossible declared births', () => {
    expect(() =>
      parseImport(
        JSON.stringify([row('#A', 1, '2024-01-01', '2025-01-01')]),
        'a.json',
      ),
    ).toThrow('precedes');
    expect(() =>
      parseImport(
        JSON.stringify([
          row('#A', 1),
          row('#A', 1, '2024-02-01', '2021-01-01'),
        ]),
        'a.json',
      ),
    ).toThrow('conflicting');
  });
});
