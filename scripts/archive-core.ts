import { createHash } from 'node:crypto';
import type { ArchiveRecord } from '../src/lib/data/archive.ts';
export const canonicalTag = (s: string) =>
  s.trim().normalize('NFC').toLowerCase();
export const isHashtag = (s: string) => /^#[\p{L}\p{M}\p{N}_]+$/u.test(s);
export function recordId(context: string, date: string, tag: string) {
  return createHash('sha256')
    .update([context, date, canonicalTag(tag)].join('|'))
    .digest('hex')
    .slice(0, 20);
}
/** Max displayed volume is a derived statistic, NEVER a sum of repeated snapshots. */
export function mergeDaily(
  current: ArchiveRecord | undefined,
  next: ArchiveRecord,
): ArchiveRecord {
  if (!current) return next;
  if (
    current.contextId !== next.contextId ||
    current.periodStart !== next.periodStart ||
    canonicalTag(current.hashtag) !== canonicalTag(next.hashtag)
  )
    throw Error('Cannot merge incompatible observations.');
  const winner = (next.value ?? -1) > (current.value ?? -1) ? next : current;
  return { ...winner, samples: current.samples + next.samples };
}
