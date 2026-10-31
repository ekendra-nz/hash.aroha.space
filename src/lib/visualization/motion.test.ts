import { describe, it, expect } from 'vitest';
import {
  SignalMotion,
  placeSignals,
  placeLinearSignals,
  moveSignal,
} from './motion';
import type { DisplaySignal } from '../data/zeitgeist';
const sample = (tag: string, rank: number, share = 0.05): DisplaySignal => ({
  tag,
  rank,
  share,
  value: 100,
  frequency: null,
  momentum: 0.5,
  firstSeen: '2010-01-01',
  sourceId: 'test',
  evidenceId: 'test',
  ageDays: rank * 150,
});
describe('continuous visual motion', () => {
  it('preserves color and slot when rankings swap, and moves rows gradually', () => {
    const motion = new SignalMotion();
    const a = motion.step([sample('#a', 1), sample('#b', 2)], 1, true);
    const b = motion.step([sample('#b', 1), sample('#a', 2)], 1 / 60);
    expect(b.find((s) => s.tag === '#a')!.color).toBe(a[0].color);
    expect(b.find((s) => s.tag === '#a')!.slot).toBe(a[0].slot);
    expect(b.find((s) => s.tag === '#a')!.order).toBeGreaterThan(0);
    expect(b.find((s) => s.tag === '#a')!.order).toBeLessThan(0.1);
  });
  it('retains a fading departure and gives returning signals distinct slots', () => {
    const motion = new SignalMotion();
    motion.step([sample('#a', 1), sample('#b', 2)], 1, true);
    const exit = motion.step([sample('#b', 1), sample('#c', 2)], 0.1);
    expect(exit.find((s) => s.tag === '#a')?.exiting).toBe(true);
    const returned = motion
      .step([sample('#a', 1), sample('#b', 2), sample('#c', 3)], 0.1)
      .filter((s) => !s.exiting);
    expect(new Set(returned.map((s) => s.slot)).size).toBe(3);
  });
  it('has ten distinct pastel identities, independent of momentum direction', () => {
    const motion = new SignalMotion();
    const list = Array.from({ length: 10 }, (_, i) =>
      sample('#tag' + i, i + 1),
    );
    const before = motion.step(list, 1, true),
      after = motion.step(
        list.map((s) => ({ ...s, momentum: -0.8 })),
        1,
        true,
      );
    expect(new Set(before.map((s) => s.color)).size).toBe(10);
    expect(after.map((s) => s.color)).toEqual(before.map((s) => s.color));
  });
  it('lets the leading bubble grow with share, with proportional area', () => {
    const motion = new SignalMotion();
    const small = placeSignals(
      motion.step([sample('#a', 1, 0.1)], 1, true),
      1200,
      650,
      0,
    )[0];
    const large = placeSignals(
      motion.step([sample('#a', 1, 0.4)], 1, true),
      1200,
      650,
      0,
    )[0];
    expect(large.r / small.r).toBeCloseTo(2);
    expect(large.r).toBeGreaterThan(100);
  });
  it.each([
    [1200, 650],
    [700, 650],
    [362, 560],
  ])('keeps circles and labels inside a %sx%s viewport', (width, height) => {
    const motion = new SignalMotion();
    const list = Array.from({ length: 10 }, (_, i) =>
      sample('#tag' + i, i + 1, i === 0 ? 0.4 : 0.04),
    );
    const nodes = placeSignals(motion.step(list, 1, true), width, height, 0);
    for (const n of nodes) {
      expect(n.x - n.r).toBeGreaterThanOrEqual(0);
      expect(n.x + n.r).toBeLessThanOrEqual(width);
      expect(n.y - n.r).toBeGreaterThanOrEqual(0);
      expect(n.y + n.r + 33).toBeLessThan(height);
    }
  });
  it('adds gentle drift without changing age or rank', () => {
    const motion = new SignalMotion();
    const signals = motion.step([sample('#a', 1)], 1, true);
    const a = placeSignals(signals, 1200, 650, 0)[0],
      b = placeSignals(signals, 1200, 650, 12)[0];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(3);
    expect(b.ageDays).toBe(a.ageDays);
    expect(b.rank).toBe(a.rank);
  });
});

describe('linear age presentation', () => {
  it('orders left to right by age, independently of popularity rank', () => {
    const signals = new SignalMotion().step(
      [sample('#older', 9), sample('#new', 1), sample('#middle', 5)],
      1,
      true,
    );
    const placed = placeLinearSignals(signals, 1200, 600);
    expect(placed.map((s) => s.tag)).toEqual(['#new', '#middle', '#older']);
    expect(placed[0].x).toBeLessThan(placed[1].x);
    expect(placed[1].x).toBeLessThan(placed[2].x);
    for (const n of placed) {
      const original = signals.find((s) => s.tag === n.tag)!;
      expect(n.color).toBe(original.color);
      expect(n.share).toBe(original.share);
      expect(n.momentum).toBe(original.momentum);
    }
  });
  it.each([
    [960, 460],
    [1200, 600],
  ])(
    'keeps growing circles and age labels in a %sx%s timeline',
    (width, height) => {
      const signals = new SignalMotion().step(
        Array.from({ length: 10 }, (_, i) =>
          sample('#tag' + i, i + 1, i === 4 ? 0.5 : 0.04),
        ),
        1,
        true,
      );
      const placed = placeLinearSignals(signals, width, height);
      for (const [i, n] of placed.entries()) {
        if (i)
          expect(n.x - n.r).toBeGreaterThan(placed[i - 1].x + placed[i - 1].r);
        expect(n.x - n.r).toBeGreaterThanOrEqual(0);
        expect(n.x + n.r).toBeLessThanOrEqual(width);
        expect(n.y - n.r).toBeGreaterThanOrEqual(0);
        expect(n.y + n.r + 19).toBeLessThan(height);
      }
      expect(new Set(placed.map((n) => Math.round(n.y))).size).toBe(1);
    },
  );
  it('gives equal-age tags a stable order when their popularity changes', () => {
    const motion = new SignalMotion();
    const initial = [
      { ...sample('#z', 1), ageDays: 100 },
      { ...sample('#a', 2), ageDays: 100 },
    ];
    const a = placeLinearSignals(motion.step(initial, 1, true), 960, 500);
    const b = placeLinearSignals(
      motion.step(
        initial.map((s) => ({ ...s, rank: 3 - s.rank })),
        1,
        true,
      ),
      960,
      500,
    );
    expect(a.map((s) => [s.tag, s.x])).toEqual(b.map((s) => [s.tag, s.x]));
  });
});

it('keeps moves visible, drops departures vertically, and resets returning entrances', () => {
  const motion = new SignalMotion();
  const n = placeLinearSignals(
    motion.step([sample('#a', 1)], 1, true),
    1200,
    600,
  )[0];
  const first = moveSignal(n, undefined, 1, 600);
  const shifted = moveSignal(
    { ...n, x: n.x + 100, opacity: 0.05 },
    first.state,
    0.1,
    600,
  );
  expect(shifted.node.opacity).toBe(1);
  const exit = moveSignal(
    { ...n, x: 50, exiting: true },
    shifted.state,
    0.2,
    600,
  );
  expect(exit.node.x).toBe(shifted.node.x);
  expect(exit.node.y).toBeGreaterThan(shifted.node.y);
  const later = moveSignal(
    { ...n, x: 50, exiting: true },
    exit.state,
    0.3,
    600,
  );
  expect(later.node.y).toBeGreaterThan(exit.node.y);
  const back = moveSignal(
    { ...n, x: 200, opacity: 0.01 },
    later.state,
    0.016,
    600,
  );
  expect(back.node.x).toBe(200);
  expect(back.node.y).toBeLessThan(n.y);
  expect(back.node.opacity).toBeGreaterThanOrEqual(0.8);
});
