import { appendFrames, type DailyLedger } from './lib/daily-history.ts';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { HistoryArchive } from '../src/lib/data/archive.ts';
import type {
  Signal,
  HistoryFrame,
  ZeitgeistHistory,
} from '../src/lib/data/zeitgeist.ts';
type Candidate = {
  tag: string;
  value: number;
  frequency: number | null;
  sourceId: string;
  evidenceId: string;
  family: string;
};
const archive = JSON.parse(
  await readFile('data/evidence-archive.json', 'utf8'),
) as HistoryArchive;
const byDay = new Map<string, Map<string, Map<string, Candidate>>>();
const firstSeen = new Map<string, string>();
function add(date: string, candidate: Candidate) {
  if (
    !/^#[\p{L}\p{M}\p{N}_]+$/u.test(candidate.tag) ||
    candidate.value <= 0 ||
    !Number.isFinite(candidate.value)
  )
    return;
  const prior = firstSeen.get(candidate.tag);
  if (!prior || date < prior) firstSeen.set(candidate.tag, date);
  const day = byDay.get(date) ?? new Map<string, Map<string, Candidate>>();
  const family = day.get(candidate.family) ?? new Map<string, Candidate>();
  const old = family.get(candidate.tag);
  if (!old || old.value < candidate.value) family.set(candidate.tag, candidate);
  day.set(candidate.family, family);
  byDay.set(date, day);
}
for (const row of archive.observations) {
  const context = archive.contexts.find((c) => c.id === row.contextId)!;
  add(row.periodStart.slice(0, 10), {
    tag: row.hashtag,
    value: row.value ?? 0,
    frequency: null,
    sourceId: context.sourceId,
    evidenceId: row.evidenceId,
    family: context.sourceId,
  });
}
const sources: ZeitgeistHistory['sources'] = archive.sources.map((s) => ({
  id: s.id,
  name: s.name,
  url: s.url,
  attribution: s.attribution,
  reuse: s.license,
}));
const captureAudit: {
  sourceId: string;
  url: string;
  sha256: string;
  retrievedAt: string;
}[] = [];
for (const [folder, sourceId, domain] of [
  ['storywrangler', 'story-twitter', 'twitter'],
  ['bluesky', 'story-bluesky', 'bluesky'],
]) {
  let files: string[] = [];
  try {
    files = await readdir(`data/raw/${folder}`);
  } catch {
    continue;
  }
  let used = 0;
  for (const filename of files.filter((f) => f.endsWith('.json.meta'))) {
    const meta = JSON.parse(
      await readFile(`data/raw/${folder}/${filename}`, 'utf8'),
    );
    const bytes = await readFile(meta.path);
    if (createHash('sha256').update(bytes).digest('hex') !== meta.sha256)
      throw Error(`Checksum mismatch: ${meta.path}`);
    const response = JSON.parse(bytes.toString());
    for (const row of response.series) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
      add(row.date, {
        tag: meta.tag.normalize('NFC').toLowerCase(),
        value: row.counts,
        frequency: Number.isFinite(row.freq) ? row.freq : null,
        sourceId,
        evidenceId: `${domain}:${meta.tag}:${row.date}`,
        family: sourceId,
      });
      used++;
    }
    captureAudit.push({
      sourceId,
      url: meta.url,
      sha256: meta.sha256,
      retrievedAt: meta.retrievedAt,
    });
  }
  if (used)
    sources.unshift({
      id: sourceId,
      name:
        domain === 'twitter'
          ? 'Storywrangler · historical Twitter sample'
          : 'Storywrangler · English Bluesky sample',
      url:
        domain === 'twitter'
          ? 'https://storywrangling.org/about'
          : 'https://storywrangler.uvm.edu/api-reference/storywrangler/get-storywrangler-term-series',
      attribution:
        'Computational Story Lab, University of Vermont. Alshaabi et al., Storywrangler, Science Advances (2021), doi:10.1126/sciadv.abe6534. Public aggregate API export.',
      reuse:
        'Publisher provides downloadable aggregate time series. Attribution retained; no individual posts or user records. No blanket underlying-platform content license asserted.',
    });
}
const priorities = [
  'story-twitter',
  'story-bluesky',
  'soncco-tweetdeck',
  'panacea-covid',
  'mastodon-social',
];
const frames: HistoryFrame[] = [];
const eligibleTags = new Set<string>();
let previousDate = '',
  previousFamily = '',
  previous = new Map<string, number>();
for (const [date, families] of [...byDay.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  const family = priorities.find((f) => families.has(f))!;
  const all = [...families.get(family)!.values()];
  for (const candidate of all) eligibleTags.add(candidate.tag);
  // Frequency is comparable only within one measurement family/day. Never sum overlapping country volumes.
  const usesFrequency = all.every((s) => s.frequency !== null);
  const measure = (s: Candidate) => (usesFrequency ? s.frequency! : s.value);
  const total = all.reduce((sum, s) => sum + measure(s), 0);
  if (total <= 0) continue;
  const continuous =
    previousFamily === family &&
    Date.parse(date) - Date.parse(previousDate) <= 14 * 86400000;
  const next = new Map(all.map((s) => [s.tag, measure(s) / total]));
  const signals: Signal[] = all
    .sort((a, b) => measure(b) - measure(a) || a.tag.localeCompare(b.tag))
    .slice(0, 10)
    .map((s) => {
      const share = measure(s) / total,
        old = previous.get(s.tag);
      const momentum =
        continuous && old !== undefined
          ? Math.tanh(Math.log((share + 0.0001) / (old + 0.0001)) / 0.9)
          : 0;
      return {
        tag: s.tag,
        share,
        value: s.value,
        frequency: s.frequency,
        momentum,
        firstSeen: firstSeen.get(s.tag)!,
        sourceId: s.sourceId,
        evidenceId: s.evidenceId,
      };
    });
  frames.push({ date, signals });
  previous = next;
  previousDate = date;
  previousFamily = family;
}
let history: ZeitgeistHistory & { captureAudit: typeof captureAudit } = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  title: 'The Hashtag Zeitgeist · one chronological attention timeline',
  sources: sources.filter((s) =>
    frames.some((f) => f.signals[0].sourceId === s.id),
  ),
  frames,
  captureAudit,
  methodology: [
    'Each dated frame contains up to ten strongest hashtags in the available candidate vocabulary. This is not an exhaustive or official worldwide trending ranking.',
    'Broad historical Twitter aggregate series take priority, followed by Bluesky, national trend-list evidence, the COVID research sample, then the captured Mastodon history. One evidence family is used per day; values from different platforms are never added.',
    'Repeated national trend observations are deduplicated by hashtag and day using their maximum displayed volume, not summed. Share is normalized within all available candidates in the chosen family for that day.',
    'The aggregate API vocabulary combines historical seed hashtags and any acquired discovery candidates. It is incomplete and selection-biased. Source frequency, original count, evidence reference and first-seen date are retained.',
    'Visual interpolation bridges adjacent observations up to 14 days apart. Larger breaks crossfade between available dates without inventing dated measurements. Off-screen or unlisted tags fade visually; that is not an observed zero.',
    'Age is first seen in this captured evidence, not the invention date. Radius is scaled relative to the oldest signal currently displayed. Momentum resets when evidence families change or long gaps occur.',
  ],
  coverage: {
    start: frames[0].date,
    end: frames.at(-1)!.date,
    observedDays: frames.length,
    candidateTags: eligibleTags.size,
    limitations: [
      'No complete continuous global archive from hashtag inception in 2007 is available in this build.',
      'Coverage gaps and vocabulary selection remain; full raw evidence is retained locally for audit.',
    ],
  },
};
// Preserve the append-only daily extension when rebuilding historical evidence.
try {
  const daily = JSON.parse(
    await readFile('data/live/frames.json', 'utf8'),
  ) as DailyLedger;
  history = {
    ...appendFrames(history, daily.frames, new Date().toISOString()),
    captureAudit,
  };
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
const json = JSON.stringify(history);
await writeFile('static/data/history.json', json);
await writeFile(
  'static/data/history.sha256',
  createHash('sha256').update(json).digest('hex') + '  history.json\n',
);
await writeFile(
  'data/timeline-summary.json',
  JSON.stringify(
    { ...history, frames: undefined, captureAudit: undefined },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    frames: frames.length,
    start: history.coverage.start,
    end: history.coverage.end,
    sources: history.sources.length,
    bytes: json.length,
    captures: captureAudit.length,
  }),
);
