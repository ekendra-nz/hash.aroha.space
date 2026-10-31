export interface Signal {
  tag: string;
  share: number;
  value: number;
  frequency: number | null;
  momentum: number;
  firstSeen: string;
  sourceId: string;
  evidenceId: string;
}
export interface HistoryFrame {
  date: string;
  signals: Signal[];
}
export interface ZeitgeistHistory {
  schemaVersion: 2;
  generatedAt: string;
  title: string;
  methodology: string[];
  sources: {
    id: string;
    name: string;
    url: string;
    attribution: string;
    reuse: string;
  }[];
  coverage: {
    start: string;
    end: string;
    observedDays: number;
    candidateTags: number;
    limitations: string[];
  };
  frames: HistoryFrame[];
}
export interface DisplaySignal extends Signal {
  ageDays: number;
  rank: number;
}
const DAY = 86400000;
/** Transition adjacent archive frames. Long breaks crossfade, but do not invent intermediate dates. */
export function frameAt(history: ZeitgeistHistory, position: number) {
  const index = Math.max(0, Math.min(history.frames.length - 1, position));
  const a = history.frames[Math.floor(index)],
    b =
      history.frames[
        Math.min(history.frames.length - 1, Math.floor(index) + 1)
      ];
  const t = index - Math.floor(index),
    start = Date.parse(a.date),
    end = Date.parse(b.date);
  const short = end - start <= 14 * DAY;
  const time = short ? start + (end - start) * t : t < 0.5 ? start : end;
  const next = new Map(b.signals.map((s) => [s.tag, s]));
  const prior = new Map(a.signals.map((s) => [s.tag, s]));
  const signals = [...new Set([...prior.keys(), ...next.keys()])]
    .map((tag) => {
      const old = prior.get(tag),
        fresh = next.get(tag),
        base = (t < 0.5 ? (old ?? fresh) : (fresh ?? old))!;
      const share = (old?.share ?? 0) * (1 - t) + (fresh?.share ?? 0) * t;
      return {
        ...base,
        share,
        value: (old?.value ?? 0) * (1 - t) + (fresh?.value ?? 0) * t,
        momentum: (old?.momentum ?? 0) * (1 - t) + (fresh?.momentum ?? 0) * t,
        ageDays: Math.max(0, (time - Date.parse(base.firstSeen)) / DAY),
        rank: 0,
      };
    })
    .filter((s) => s.share > 0.000001)
    .sort((a, b) => b.share - a.share)
    .slice(0, 10)
    .map((s, i) => ({ ...s, rank: i + 1 }));
  return { time, signals, estimated: t > 0 && a !== b, frame: a };
}
export function positionForDate(history: ZeitgeistHistory, time: number) {
  let lo = 0,
    hi = history.frames.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (Date.parse(history.frames[mid].date) < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  const a = Date.parse(history.frames[lo - 1].date),
    b = Date.parse(history.frames[lo].date);
  return b - a > 14 * DAY
    ? time - a < b - time
      ? lo - 1
      : lo
    : lo - 1 + Math.max(0, Math.min(1, (time - a) / (b - a)));
}
export function validateZeitgeist(value: unknown): ZeitgeistHistory {
  const h = value as ZeitgeistHistory;
  if (
    !h ||
    h.schemaVersion !== 2 ||
    !Array.isArray(h.frames) ||
    !h.frames.length ||
    !Array.isArray(h.sources)
  )
    throw Error('Invalid history file.');
  const sources = new Set(h.sources.map((s) => s.id));
  let last = '';
  for (const f of h.frames) {
    if (
      !Number.isFinite(Date.parse(f.date)) ||
      f.date <= last ||
      !f.signals.length ||
      f.signals.length > 10
    )
      throw Error('Invalid chronological frame.');
    last = f.date;
    const seen = new Set<string>();
    for (const s of f.signals) {
      if (
        !s.tag.startsWith('#') ||
        seen.has(s.tag) ||
        !sources.has(s.sourceId) ||
        !Number.isFinite(s.share) ||
        s.share < 0 ||
        s.share > 1 ||
        !Number.isFinite(s.value) ||
        s.value < 0 ||
        !Number.isFinite(s.momentum) ||
        Math.abs(s.momentum) > 1 ||
        Date.parse(s.firstSeen) > Date.parse(f.date)
      )
        throw Error('Invalid history signal.');
      seen.add(s.tag);
    }
  }
  return h;
}

/** Advance in real calendar days across short gaps; compress long uncovered breaks into one transition. */
export function advancePosition(
  history: ZeitgeistHistory,
  position: number,
  elapsed: number,
  speed: number,
) {
  let remaining = Math.max(0, elapsed * speed),
    p = Math.max(0, Math.min(history.frames.length - 1, position));
  while (remaining > 0 && p < history.frames.length - 1) {
    const index = Math.floor(p),
      gap =
        (Date.parse(history.frames[index + 1].date) -
          Date.parse(history.frames[index].date)) /
        DAY;
    const duration = gap <= 14 ? Math.max(1, gap) : 1;
    const available = (index + 1 - p) * duration;
    if (remaining < available) {
      p += remaining / duration;
      break;
    }
    remaining -= available;
    p = index + 1;
  }
  return p;
}
