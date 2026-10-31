import { describe, it, expect } from 'vitest';
import { popularity, momentum, prepare, sample } from './pipeline';
import { createDemo } from '../data/demo';
import { identity, dataset, type Observation } from '../data/model';
import { parseImport } from '../data/import';
import { advance, DAY } from '../state/timeline';
const record = (date: string, value: number | null): Observation => ({
  hashtag: '#Test',
  date,
  value,
  source: 'test',
  platform: 'test',
  granularity: 'day',
  measurement: 'count',
  status: 'observed',
});
describe('analytics', () => {
  it('uses bounded log popularity with zero-safe scaling', () => {
    expect(popularity(0, 100)).toBe(0);
    expect(popularity(100, 100)).toBe(1);
    expect(popularity(10, 100)).toBeGreaterThan(0.1);
    expect(popularity(2, 0)).toBe(0);
  });
  it('distinguishes rising, falling and neutral momentum', () => {
    expect(momentum(1000, 100)).toBeGreaterThan(0);
    expect(momentum(100, 1000)).toBeLessThan(0);
    expect(momentum(100, 100)).toBe(0);
    expect(momentum(0, 0)).toBe(0);
    expect(momentum(1e9, 0)).toBeLessThanOrEqual(1);
  });
  it('preserves missing versus observed zero and resets momentum across missing data', () => {
    const d = dataset('test', [
      record('2024-01-01', 0),
      record('2024-01-02', null),
      record('2024-01-03', 100),
    ]);
    const p = prepare(d).get('#Test')!;
    expect(p[0].value).toBe(0);
    expect(p[1].value).toBeNull();
    expect(p[2].momentum).toBe(0);
    expect(sample(p, Date.parse('2024-01-01T12:00:00Z'))).toBeNull();
  });
  it('interpolates without claiming a measurement was observed; no extrapolation', () => {
    const p = prepare(
      dataset('test', [record('2024-01-01', 0), record('2024-01-03', 100)]),
    ).get('#Test')!;
    expect(sample(p, Date.parse('2024-01-02'))).toMatchObject({
      value: 50,
      interpolated: true,
    });
    expect(sample(p, Date.parse('2024-01-01'))?.interpolated).toBe(false);
    expect(sample(p, Date.parse('2023-12-31'))).toBeNull();
    expect(sample(p, Date.parse('2024-01-04'))).toBeNull();
  });
  it('preserves stable identities, colours and deterministic fixtures', () => {
    expect(identity('#Test', 3, 42)).toEqual(identity('#Test', 3, 42));
    expect(identity('#Test', 9, 50).color).toBe(identity('#Test', 3, 42).color);
    const a = createDemo(),
      b = createDemo();
    expect(a).toEqual(b);
    expect(a.identities).toHaveLength(42);
    expect(a.observations).toHaveLength(42 * 228);
  });
  it('keeps frame-rate-independent elapsed playback within bounds', () => {
    expect(advance(0, 1, 30, 1, 0, 100 * DAY)).toBe(30 * DAY);
    expect(advance(90 * DAY, 1, 30, 1, 0, 100 * DAY)).toBe(100 * DAY);
    expect(advance(10 * DAY, 1, 30, -1, 0, 100 * DAY)).toBe(0);
    expect(
      advance(advance(0, 0.5, 30, 1, 0, 100 * DAY), 0.5, 30, 1, 0, 100 * DAY),
    ).toBe(30 * DAY);
  });
});
describe('local import', () => {
  it('loads JSON with provenance and observed zero', () => {
    const d = parseImport(
      JSON.stringify([record('2024-01-01', 0)]),
      'test.json',
    );
    expect(d.simulated).toBe(false);
    expect(d.observations[0].value).toBe(0);
  });
  it('loads quoted CSV and preserves blank values', () => {
    const d = parseImport(
      'hashtag,date,value,source,platform,granularity,measurement,status\n#Test,2024-01-01,,"A, B",test,day,count,observed',
      'test.csv',
    );
    expect(d.observations[0].source).toBe('A, B');
    expect(d.observations[0].value).toBeNull();
  });
  it('rejects invalid values, duplicate times, incompatible sources and missing provenance', () => {
    expect(() =>
      parseImport(JSON.stringify([record('2024-01-01', -1)]), 'test.json'),
    ).toThrow('nonnegative');
    expect(() =>
      parseImport(
        JSON.stringify([record('2024-01-01', 1), record('2024-01-01', 2)]),
        'test.json',
      ),
    ).toThrow('duplicate');
    expect(() =>
      parseImport(
        JSON.stringify([
          record('2024-01-01', 1),
          { ...record('2024-01-02', 2), source: 'other' },
        ]),
        'test.json',
      ),
    ).toThrow('compatible');
    expect(() => parseImport('[{"hashtag":"#Test"}]', 'test.json')).toThrow(
      'date',
    );
  });
});
