import type { DisplaySignal } from '../data/zeitgeist';
export const palette = [
  '#e8a0ae',
  '#e8ad94',
  '#e7c48e',
  '#d9d998',
  '#b4d39c',
  '#95cfb5',
  '#91cbd1',
  '#9dbce7',
  '#b1a9e2',
  '#d1a5d4',
];
export interface MovingSignal extends DisplaySignal {
  opacity: number;
  order: number;
  slot: number;
  color: string;
  exiting: boolean;
}
const approach = (value: number, target: number, dt: number, tau: number) =>
  value + (target - value) * (1 - Math.exp(-dt / tau));
/** Preserve identities through rank changes and fade removals instead of remounting all rows. */
export class SignalMotion {
  private nodes = new Map<string, MovingSignal>();
  private departures = new Map<string, number>();
  step(targets: DisplaySignal[], dt: number, reduced = false): MovingSignal[] {
    const active = new Set(targets.map((s) => s.tag));
    const occupied = new Set(
      [...this.nodes.values()]
        .filter((s) => active.has(s.tag) && !s.exiting)
        .map((s) => s.slot),
    );
    for (const target of targets) {
      let node = this.nodes.get(target.tag);
      if (!node) {
        const slot =
          Array.from({ length: 10 }, (_, i) => i).find(
            (i) => !occupied.has(i),
          ) ?? target.rank - 1;
        occupied.add(slot);
        node = {
          ...target,
          share: reduced ? target.share : 0,
          momentum: 0,
          opacity: reduced ? 1 : 0,
          order: target.rank - 1,
          slot,
          color: palette[slot],
          exiting: false,
        };
        this.nodes.set(target.tag, node);
      }
      if (node.exiting) {
        if (occupied.has(node.slot))
          node.slot =
            Array.from({ length: 10 }, (_, i) => i).find(
              (i) => !occupied.has(i),
            ) ?? node.slot;
        node.color = palette[node.slot];
        occupied.add(node.slot);
      }
      this.departures.delete(target.tag);
      const share = approach(node.share, target.share, dt, 0.5),
        momentum = approach(node.momentum, target.momentum, dt, 0.65),
        order = approach(node.order, target.rank - 1, dt, 0.7),
        opacity = approach(node.opacity, 1, dt, 0.45);
      Object.assign(node, target, {
        share: reduced ? target.share : share,
        momentum: reduced ? target.momentum : momentum,
        order: reduced ? target.rank - 1 : order,
        opacity: reduced ? 1 : opacity,
        exiting: false,
      });
    }
    for (const [tag, node] of this.nodes) {
      if (active.has(tag)) continue;
      node.exiting = true;
      const elapsed = (this.departures.get(tag) ?? 0) + dt;
      this.departures.set(tag, elapsed);
      node.opacity = reduced
        ? 0
        : Math.max(0, 1 - Math.max(0, elapsed - 0.3) / 1.1);
      if (node.opacity === 0) {
        this.nodes.delete(tag);
        this.departures.delete(tag);
      }
    }
    return [...this.nodes.values()].map((s) => ({ ...s }));
  }
}
export interface PlacedSignal extends MovingSignal {
  x: number;
  y: number;
  r: number;
  glow: number;
}
/** Elliptical age orbits use the available viewport; local collision relief gives growing nodes room. */
export function placeSignals(
  signals: MovingSignal[],
  width: number,
  height: number,
  clock: number,
): PlacedSignal[] {
  const active = signals.filter((s) => !s.exiting),
    oldest = Math.max(1, ...active.map((s) => s.ageDays));
  const compact = width < 600,
    cx = width / 2,
    cy = height / 2 - 12;
  const unit = Math.min(height * 0.36, width * (compact ? 0.27 : 0.2));
  const nodes = signals.map((s) => {
    const angle =
      (s.slot * Math.PI) / 5 -
      Math.PI / 2 +
      0.065 * Math.sin(clock / 14 + s.slot * 0.7);
    const fraction =
      0.16 + 0.84 * Math.pow(Math.max(0, s.ageDays) / oldest, 0.72);
    const r = Math.max(7, Math.sqrt(Math.max(0, s.share)) * unit);
    const rx = Math.max(25, width / 2 - (compact ? 35 : 72) - r * 0.65),
      ry = Math.max(25, height / 2 - 58 - r * 0.7);
    return {
      ...s,
      x: cx + Math.cos(angle) * rx * fraction,
      y: cy + Math.sin(angle) * ry * fraction,
      r,
      glow: Math.sqrt(Math.max(0, s.momentum)),
    };
  });
  // Several small relaxations are more stable than reassigning orbital slots on every ranking change.
  for (let iteration = 0; iteration < 14; iteration++) {
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j];
        if (a.exiting || b.exiting) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const requiredX =
          Math.max(a.r + 12, compact ? 43 : 66) +
          Math.max(b.r + 12, compact ? 43 : 66);
        const requiredY = a.r + b.r + 40;
        const normalized = Math.hypot(dx / requiredX, dy / requiredY);
        if (normalized >= 1) continue;
        const distance = Math.hypot(dx, dy) || 1,
          ux = distance === 1 && dx === 0 && dy === 0 ? 1 : dx / distance,
          uy = dy / distance;
        const overlap =
          (1 - normalized) * Math.min(requiredX, requiredY) * 0.42;
        const weight = (a.r * a.r) / (a.r * a.r + b.r * b.r);
        a.x -= ux * overlap * (1 - weight);
        a.y -= uy * overlap * (1 - weight);
        b.x += ux * overlap * weight;
        b.y += uy * overlap * weight;
      }
    for (const n of nodes) {
      const side = Math.max(n.r + 10, compact ? 54 : 86);
      n.x = Math.max(side, Math.min(width - side, n.x));
      n.y = Math.max(n.r + 18, Math.min(height - n.r - 48, n.y));
    }
  }
  return nodes;
}

/** Pack age-ordered circles along one baseline, preserving their relative areas. */
export function placeLinearSignals(
  signals: MovingSignal[],
  width: number,
  height: number,
): PlacedSignal[] {
  const active = signals
    .filter((s) => !s.exiting)
    .sort((a, b) => a.ageDays - b.ageDays || a.tag.localeCompare(b.tag));
  let unit = Math.min(height * 0.36, width * 0.2);
  const radius = (s: MovingSignal) =>
    Math.max(7, Math.sqrt(Math.max(0, s.share)) * unit);
  const footprint = (s: MovingSignal) => Math.max(36, radius(s));
  // Reserve label space and shrink the common scale only when the row needs it.
  for (let i = 0; i < 20; i++) {
    const needed =
      active.reduce((sum, s) => sum + footprint(s) * 2, 0) +
      Math.max(0, active.length - 1) * 24;
    if (needed <= width - 48) break;
    unit *= 0.94;
  }
  const total = active.reduce((sum, s) => sum + footprint(s) * 2, 0);
  const gap =
    active.length > 1
      ? Math.max(24, (width - 48 - total) / (active.length - 1))
      : 0;
  let cursor = active.length === 1 ? width / 2 - footprint(active[0]) : 24;
  return [...active, ...signals.filter((s) => s.exiting)].map((s) => {
    const half = footprint(s);
    const x = cursor + half;
    if (!s.exiting) cursor += half * 2 + gap;
    return {
      ...s,
      x,
      y: height / 2 - 15,
      r: radius(s),
      glow: Math.sqrt(Math.max(0, s.momentum)),
    };
  });
}

export interface VisualPosition {
  x: number;
  y: number;
  r: number;
  exiting: boolean;
  elapsed: number;
  exitY: number;
}
/** Departures keep their horizontal location and accelerate downward; no bounce or ghost travel. */
export function moveSignal(
  n: PlacedSignal,
  previous: VisualPosition | undefined,
  dt: number,
  height: number,
  reduced = false,
) {
  const entering = !previous || (previous.exiting && !n.exiting);
  const state: VisualPosition = entering
    ? {
        x: n.x,
        y: n.y - (reduced ? 0 : 42),
        r: n.r,
        exiting: false,
        elapsed: 0,
        exitY: n.y,
      }
    : { ...previous };
  if (n.exiting && !state.exiting) {
    state.elapsed = 0;
    state.exitY = state.y;
  }
  state.exiting = n.exiting;
  state.elapsed += dt;
  const ease = reduced ? 1 : 1 - Math.exp(-dt / 0.45);
  if (n.exiting) {
    const progress = Math.min(1, state.elapsed / 1.4);
    state.y =
      state.exitY + (height + state.r - state.exitY) * progress * progress;
  } else {
    state.x += (n.x - state.x) * ease;
    state.y += (n.y - state.y) * ease;
    state.r += (n.r - state.r) * ease;
  }
  return {
    state,
    node: {
      ...n,
      x: state.x,
      y: state.y,
      r: state.r,
      opacity: n.exiting
        ? n.opacity
        : reduced
          ? 1
          : Math.min(1, 0.8 + state.elapsed * 0.8),
    },
  };
}
