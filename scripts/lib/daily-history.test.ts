import { describe, it, expect } from 'vitest';
import {
  collectDaily,
  appendFrames,
  liveSource,
  type DailyLedger,
} from './daily-history';
import type { ZeitgeistHistory } from '../../src/lib/data/zeitgeist';
const base = (): ZeitgeistHistory => ({
  schemaVersion: 2,
  generatedAt: '2026-10-27T00:00:00Z',
  title: 'test',
  methodology: [],
  sources: [{ ...liveSource, id: 'old' }],
  coverage: {
    start: '2026-10-27',
    end: '2026-10-27',
    observedDays: 1,
    candidateTags: 1,
    limitations: [],
  },
  frames: [
    {
      date: '2026-10-27',
      signals: [
        {
          tag: '#old',
          share: 1,
          value: 10,
          frequency: null,
          momentum: 0,
          firstSeen: '2010-01-01',
          sourceId: 'old',
          evidenceId: 'old',
        },
      ],
    },
  ],
});
const ledger = (): DailyLedger => ({
  schemaVersion: 1,
  frames: [],
  firstSeen: {},
});
const tag = (name: string, values: Record<string, number>) => ({
  name,
  history: Object.entries(values).map(([date, uses]) => ({
    day: String(Date.parse(date) / 1000),
    uses: String(uses),
  })),
});
const now = '2026-10-31T01:00:00Z';
describe('daily append pipeline', () => {
  it('appends chronological completed UTC days and preserves history and first-seen age', () => {
    const h = base(),
      before = JSON.stringify(h);
    const result = collectDaily(
      h,
      ledger(),
      [
        tag('Old', { '2026-10-29': 20, '2026-10-28': 10, '2026-10-31': 900 }),
        tag('new', { '2026-10-28': 30, '2026-10-29': 20 }),
      ],
      now,
      'capture',
    );
    expect(JSON.stringify(h)).toBe(before);
    expect(result.added.map((f) => f.date)).toEqual([
      '2026-10-28',
      '2026-10-29',
    ]);
    expect(result.added[0].signals.map((s) => s.share)).toEqual([0.75, 0.25]);
    expect(result.added[0].signals.every((s) => s.momentum === 0)).toBe(true);
    expect(
      result.added[1].signals.find((s) => s.tag === '#old')!.momentum,
    ).toBeGreaterThan(0);
    expect(
      result.added[1].signals.find((s) => s.tag === '#old')!.firstSeen,
    ).toBe('2010-01-01');
  });
  it('is idempotent, deduplicates observations, and can restore from the ledger', () => {
    const raw = [
      tag('new', { '2026-10-28': 10 }),
      tag('NEW', { '2026-10-28': 20 }),
    ];
    const a = collectDaily(base(), ledger(), raw, now, 'hash');
    expect(a.added[0].signals).toHaveLength(1);
    expect(a.added[0].signals[0].value).toBe(20);
    const b = collectDaily(a.history, a.ledger, raw, now, 'hash');
    expect(b.added).toHaveLength(0);
    expect(b.history).toEqual(a.history);
    expect(appendFrames(base(), a.ledger.frames, now)).toEqual(a.history);
  });
  it('takes ten tags but normalizes against all candidates, and does not invent missing days', () => {
    const raw = Array.from({ length: 20 }, (_, i) =>
      tag('tag' + i, { '2026-10-30': 10 }),
    );
    const r = collectDaily(base(), ledger(), raw, now, 'hash');
    expect(r.added).toHaveLength(1);
    expect(r.added[0].signals).toHaveLength(10);
    expect(r.added[0].signals[0].share).toBe(0.05);
    expect(r.added[0].signals.every((s) => s.momentum === 0)).toBe(true);
  });
  it('rejects malformed data without mutating the input', () => {
    const h = base();
    expect(() =>
      collectDaily(
        h,
        ledger(),
        [{ name: 'oops', history: [{ day: 'bad', uses: '5' }] }],
        now,
        'hash',
      ),
    ).toThrow();
    expect(() => collectDaily(h, ledger(), [], now, 'hash')).toThrow();
    expect(h.frames).toHaveLength(1);
  });
  it('ignores zero, future, current-day and stale buckets without making up new data', () => {
    const r = collectDaily(
      base(),
      ledger(),
      [
        tag('a', {
          '2026-10-20': 4,
          '2026-10-29': 0,
          '2026-10-31': 4,
          '2026-11-01': 4,
        }),
      ],
      now,
      'hash',
    );
    expect(r.history).toEqual(base());
    expect(r.added).toHaveLength(0);
  });
});
