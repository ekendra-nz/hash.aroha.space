import {
  validateZeitgeist,
  type ZeitgeistHistory,
  type HistoryFrame,
} from '../../src/lib/data/zeitgeist.ts';

export const endpoint = 'https://mastodon.social/api/v1/trends/tags?limit=20';
export const liveSource = {
  id: 'mastodon-social-daily',
  name: 'Mastodon · daily mastodon.social trending sample',
  url: endpoint,
  attribution:
    'mastodon.social public trends API. https://docs.joinmastodon.org/methods/trends/ and https://docs.joinmastodon.org/entities/Tag/',
  reuse:
    'Public aggregate hashtag counts only; no posts or account records. No blanket license to underlying platform content asserted.',
};
export const liveMethod =
  'Daily updates append completed UTC days from the mastodon.social public trending-tag sample. Shares use all returned candidates for that day, not global activity. Historical frames are immutable. Today is excluded; missing observations are not zeros. Source changes reset momentum.';
export interface DailyLedger {
  schemaVersion: 1;
  frames: HistoryFrame[];
  firstSeen: Record<string, string>;
}
const DAY = 86400000;
export function appendFrames(
  base: ZeitgeistHistory,
  frames: HistoryFrame[],
  generatedAt: string,
): ZeitgeistHistory {
  const extra = frames
    .filter((f) => f.date > base.coverage.end)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!extra.length) return base;
  const merged = [...base.frames, ...extra];
  return validateZeitgeist({
    ...base,
    generatedAt,
    frames: merged,
    sources: base.sources.some((s) => s.id === liveSource.id)
      ? base.sources
      : [...base.sources, liveSource],
    methodology: base.methodology.includes(liveMethod)
      ? base.methodology
      : [...base.methodology, liveMethod],
    coverage: {
      ...base.coverage,
      end: merged.at(-1)!.date,
      observedDays: merged.length,
      candidateTags: Math.max(
        base.coverage.candidateTags,
        new Set(merged.flatMap((f) => f.signals.map((s) => s.tag))).size,
      ),
    },
  });
}
/** Strict parsing: malformed responses must never partially overwrite a good archive. */
export function collectDaily(
  base: ZeitgeistHistory,
  ledger: DailyLedger,
  response: unknown,
  capturedAt: string,
  captureHash: string,
) {
  if (!Array.isArray(response) || !response.length)
    throw Error('Empty or invalid trend response');
  const today = capturedAt.slice(0, 10);
  const todayMs = Date.parse(today);
  if (!Number.isFinite(todayMs)) throw Error('Invalid capture timestamp');
  const seen: Record<string, string> = { ...ledger.firstSeen };
  for (const frame of base.frames)
    for (const signal of frame.signals) {
      if (!seen[signal.tag] || signal.firstSeen < seen[signal.tag])
        seen[signal.tag] = signal.firstSeen;
    }
  const days = new Map<string, Map<string, number>>();
  for (const row of response) {
    if (typeof row?.name !== 'string' || !Array.isArray(row.history))
      throw Error('Malformed tag');
    const tag = '#' + row.name.normalize('NFC').toLowerCase().replace(/^#/, '');
    if (!/^#[\p{L}\p{M}\p{N}_]+$/u.test(tag)) continue;
    for (const observation of row.history) {
      if (
        !/^\d+$/.test(String(observation.day)) ||
        !/^\d+$/.test(String(observation.uses))
      )
        throw Error('Malformed daily count');
      const stamp = Number(observation.day) * 1000,
        uses = Number(observation.uses);
      if (
        !Number.isSafeInteger(stamp) ||
        stamp % DAY !== 0 ||
        !Number.isSafeInteger(uses)
      )
        throw Error('Invalid daily count or timestamp');
      // Trends exposes a rolling week. Discard current/future days and implausible old buckets.
      if (stamp >= todayMs || stamp < todayMs - 7 * DAY || uses === 0) continue;
      const date = new Date(stamp).toISOString().slice(0, 10);
      if (!seen[tag] || date < seen[tag]) seen[tag] = date;
      const candidates = days.get(date) ?? new Map<string, number>();
      candidates.set(tag, Math.max(candidates.get(tag) ?? 0, uses));
      days.set(date, candidates);
    }
  }
  let history = appendFrames(base, ledger.frames, capturedAt);
  const added: HistoryFrame[] = [];
  for (const [date, candidates] of [...days].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (date <= history.coverage.end) continue;
    const total = [...candidates.values()].reduce((sum, n) => sum + n, 0);
    if (!Number.isSafeInteger(total) || total <= 0)
      throw Error('Invalid total');
    const previous = history.frames.at(-1)!;
    const continuous =
      Date.parse(date) - Date.parse(previous.date) === DAY &&
      previous.signals.every((s) => s.sourceId === liveSource.id);
    const frame: HistoryFrame = {
      date,
      signals: [...candidates]
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .slice(0, 10)
        .map(([tag, value]) => {
          const share = value / total,
            old = previous.signals.find((s) => s.tag === tag);
          return {
            tag,
            share,
            value,
            frequency: null,
            firstSeen: seen[tag],
            sourceId: liveSource.id,
            evidenceId: `daily:${captureHash}:${date}:${tag}`,
            momentum:
              continuous && old
                ? Math.tanh(
                    Math.log((share + 0.0001) / (old.share + 0.0001)) / 0.9,
                  )
                : 0,
          };
        }),
    };
    history = appendFrames(history, [frame], capturedAt);
    added.push(frame);
  }
  return {
    history,
    ledger: {
      schemaVersion: 1 as const,
      frames: [...ledger.frames, ...added],
      firstSeen: seen,
    },
    added,
  };
}
