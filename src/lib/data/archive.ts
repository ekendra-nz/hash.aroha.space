import { dataset, type Dataset, type Observation } from './model';
export interface ArchiveSource {
  id: string;
  name: string;
  url: string;
  attribution: string;
  license: string;
  retrievedAt: string;
  limitations: string[];
  files: { url: string; sha256: string }[];
}
export interface ArchiveContext {
  id: string;
  sourceId: string;
  label: string;
  platform: string;
  region: string;
  metric: 'daily-peak-displayed-volume' | 'daily-hashtag-uses';
  coverageStart: string;
  coverageEnd: string;
  observedDays: number;
  missingDays: number;
  sampling: string;
}
export interface ArchiveRecord {
  id: string;
  contextId: string;
  hashtag: string;
  periodStart: string;
  periodEnd: string;
  observedAt: string | null;
  value: number | null;
  rank: number | null;
  evidenceId: string;
  samples: number;
}
export interface HistoryArchive {
  schemaVersion: 1;
  compiledAt: string;
  title: string;
  sources: ArchiveSource[];
  contexts: ArchiveContext[];
  observations: ArchiveRecord[];
  policy: {
    deduplication: string;
    missing: string;
    time: string;
    scope: string;
  };
  stats: {
    inputRows: number;
    hashtagRows: number;
    outputRows: number;
    duplicates: number;
    conflicts: number;
  };
}
export function validateArchive(value: unknown): HistoryArchive {
  if (!value || typeof value !== 'object')
    throw Error('Archive must be an object.');
  const a = value as HistoryArchive;
  if (
    a.schemaVersion !== 1 ||
    !Array.isArray(a.sources) ||
    !Array.isArray(a.contexts) ||
    !Array.isArray(a.observations) ||
    !a.observations.length
  )
    throw Error('Unsupported or empty history archive.');
  const contexts = new Set(a.contexts.map((c) => c.id)),
    sources = new Set(a.sources.map((s) => s.id)),
    seen = new Set<string>();
  if (contexts.size !== a.contexts.length || sources.size !== a.sources.length)
    throw Error('Duplicate archive metadata IDs.');
  for (const c of a.contexts)
    if (!sources.has(c.sourceId)) throw Error('Unknown archive source.');
  let previous = '';
  for (const r of a.observations) {
    if (
      !contexts.has(r.contextId) ||
      !/^#[\p{L}\p{M}\p{N}_]+$/u.test(r.hashtag)
    )
      throw Error('Invalid archive context or hashtag.');
    if (
      !Number.isFinite(Date.parse(r.periodStart)) ||
      !Number.isFinite(Date.parse(r.periodEnd)) ||
      r.periodEnd <= r.periodStart ||
      !r.periodStart.endsWith('Z') ||
      !r.periodEnd.endsWith('Z')
    )
      throw Error('Invalid UTC interval.');
    if (
      r.observedAt !== null &&
      (!Number.isFinite(Date.parse(r.observedAt)) ||
        r.observedAt < r.periodStart ||
        r.observedAt >= r.periodEnd)
    )
      throw Error('Evidence timestamp outside interval.');
    if (
      r.value !== null &&
      (typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0)
    )
      throw Error('Invalid archive value.');
    if (
      !Number.isInteger(r.samples) ||
      r.samples < 1 ||
      !r.id ||
      !r.evidenceId ||
      (r.rank !== null && (!Number.isInteger(r.rank) || r.rank < 1))
    )
      throw Error('Invalid evidence metadata.');
    if (r.periodStart < previous) throw Error('Archive must be chronological.');
    previous = r.periodStart;
    const key = [
      r.contextId,
      r.periodStart,
      r.hashtag.normalize('NFC').toLowerCase(),
    ].join('|');
    if (seen.has(key)) throw Error('Duplicate canonical observation.');
    seen.add(key);
  }
  return a;
}
export function archiveDataset(
  archive: HistoryArchive,
  contextId: string,
): Dataset {
  const context = archive.contexts.find((c) => c.id === contextId);
  if (!context) throw Error('Unknown archive context.');
  const source = archive.sources.find((s) => s.id === context.sourceId)!;
  const records: Observation[] = archive.observations
    .filter((r) => r.contextId === contextId)
    .map((r) => ({
      hashtag: r.hashtag.normalize('NFC').toLowerCase(),
      date: r.periodStart,
      validUntil: r.periodEnd,
      value: r.value,
      observedAt: r.observedAt ?? undefined,
      evidenceId: r.evidenceId,
      rank: r.rank ?? undefined,
      source: source.name,
      platform: context.platform,
      region: context.region,
      granularity: 'day',
      measurement: 'count',
      status: 'transformed',
    }));
  const result = dataset(context.label, records);
  const firstSeen = new Map<string, number>();
  for (const r of records)
    if (!firstSeen.has(r.hashtag)) firstSeen.set(r.hashtag, Date.parse(r.date));
  for (const identity of result.identities)
    identity.bornAt = firstSeen.get(identity.id) ?? null;
  return {
    ...result,
    archiveContext: context,
    sourceUrl: source.url,
  };
}
