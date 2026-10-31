import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  frameAt,
  advancePosition,
  positionForDate,
  validateZeitgeist,
  type ZeitgeistHistory,
  type Signal,
} from './zeitgeist';
const signal = (tag: string, share: number, value: number): Signal => ({
  tag,
  share,
  value,
  frequency: null,
  momentum: 0.2,
  firstSeen: '2020-01-01',
  sourceId: 'test',
  evidenceId: 'test',
});
const fixture = (dates: string[]): ZeitgeistHistory => ({
  schemaVersion: 2,
  generatedAt: '2026-10-28',
  title: 'Test',
  methodology: [],
  sources: [{ id: 'test', name: 'Test', url: '', attribution: '', reuse: '' }],
  coverage: {
    start: dates[0],
    end: dates.at(-1)!,
    candidateTags: 1,
    observedDays: dates.length,
    limitations: [],
  },
  frames: dates.map((date, i) => ({
    date,
    signals: [signal('#test', 0.2 + i * 0.2, 100 + i * 100)],
  })),
});
describe('one chronological timeline', () => {
  it('ships ordered top-ten frames with valid evidence and exact checksum', () => {
    const bytes = readFileSync('static/data/history.json');
    const data = validateZeitgeist(JSON.parse(bytes.toString()));
    expect(data.frames.length).toBeGreaterThan(5000);
    expect(data.coverage.start).toBe('2008-09-09');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      readFileSync('static/data/history.sha256', 'utf8').split(' ')[0],
    );
    for (const frame of data.frames) {
      expect(frame.signals.length).toBeLessThanOrEqual(10);
      expect(
        frame.signals.reduce((sum, s) => sum + s.share, 0),
      ).toBeLessThanOrEqual(1.00000001);
      expect(new Set(frame.signals.map((s) => s.sourceId)).size).toBe(1);
    }
  });
  it('blends a two-day missing interval without a jump or zero', () => {
    const h = fixture(['2020-01-01', '2020-01-04']);
    const result = frameAt(h, 0.5);
    expect(result.signals[0].value).toBe(150);
    expect(result.signals[0].share).toBeCloseTo(0.3);
    expect(result.estimated).toBe(true);
    expect(result.time).toBe(Date.parse('2020-01-02T12:00:00Z'));
    expect(positionForDate(h, Date.parse('2020-01-02T12:00:00Z'))).toBe(0.5);
  });
  it('advances one calendar day per second across short gaps', () => {
    const h = fixture(['2020-01-01', '2020-01-04']);
    const position = advancePosition(h, 0, 1, 1);
    expect(position).toBeCloseTo(1 / 3);
    expect(frameAt(h, position).time).toBe(Date.parse('2020-01-02'));
    expect(advancePosition(h, position, 20, 1)).toBe(1);
  });
  it('does not fabricate dates in a multi-year gap', () => {
    const h = fixture(['2020-01-01', '2026-01-01']);
    expect(frameAt(h, 0.25).time).toBe(Date.parse('2020-01-01'));
    expect(frameAt(h, 0.75).time).toBe(Date.parse('2026-01-01'));
    expect(positionForDate(h, Date.parse('2025-01-01'))).toBe(1);
  });
  it('keeps forward playback dates monotonic and bounded', () => {
    const h = fixture(['2020-01-01', '2020-01-04', '2026-01-01']);
    let last = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const frame = frameAt(h, i / 10);
      expect(frame.time).toBeGreaterThanOrEqual(last);
      last = frame.time;
    }
    expect(frameAt(h, -1).time).toBe(Date.parse(h.coverage.start));
    expect(frameAt(h, 99).time).toBe(Date.parse(h.coverage.end));
  });
  it('fades departing signals as a visual transition, preserving source records', () => {
    const h = fixture(['2020-01-01', '2020-01-02']);
    h.frames[1].signals = [signal('#next', 0.8, 200)];
    const view = frameAt(h, 0.5);
    expect(view.signals.map((s) => s.tag)).toContain('#test');
    expect(view.signals.find((s) => s.tag === '#test')?.value).toBe(50);
    expect(h.frames[0].signals[0].value).toBe(100);
    expect(h.frames[1].signals.some((s) => s.tag === '#test')).toBe(false);
  });
});
