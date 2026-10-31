import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import {
  canonicalTag,
  isHashtag,
  recordId,
  mergeDaily,
} from './archive-core.ts';
import type {
  HistoryArchive,
  ArchiveRecord,
  ArchiveContext,
  ArchiveSource,
} from '../src/lib/data/archive.ts';
import { readPanacea } from './panacea.ts';
const compiledAt = new Date().toISOString();
const DAY = 86400000;
const records = new Map<string, ArchiveRecord>();
const contexts: ArchiveContext[] = [];
let inputRows = 0,
  hashtagRows = 0,
  duplicates = 0,
  conflicts = 0;
const provenance = JSON.parse(
  await readFile('data/raw/soncco/provenance.json', 'utf8'),
) as {
  files: { path: string; url: string; sha256: string; retrievedAt: string }[];
};
const regions: Record<string, string> = {
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  EC: 'Ecuador',
  ES: 'Spain',
  GT: 'Guatemala',
  MX: 'Mexico',
  PA: 'Panama',
  PE: 'Peru',
  PR: 'Puerto Rico',
  VE: 'Venezuela',
};
const sources: ArchiveSource[] = [
  {
    id: 'soncco-tweetdeck',
    name: 'Braulio Andrés Soncco Pimentel · TweetDeck trends',
    url: 'https://huggingface.co/datasets/soncco/historical-twitter-trends-spanish-locations-2020-2021',
    attribution:
      'Braulio Andrés Soncco Pimentel (2026), Historical Twitter Trends Across 11 Spanish-Speaking Locations (2020–2021), version 1.0.0.',
    license:
      'ODC-By-1.0 (database compilation; platform content remains third-party)',
    retrievedAt: provenance.files[0].retrievedAt,
    files: provenance.files.map(({ url, sha256 }) => ({ url, sha256 })),
    limitations: [
      'UI-displayed approximate volumes, not independently counted posts.',
      'UTC reconstructed using collector fixed offsets; daylight-saving limitations.',
      'Country denotes trend-list location, not tweet origin or language.',
      'Daily peak per hashtag is derived from repeated snapshots; peak times differ.',
      'Unlisted hashtags are unknown, not verified zero.',
    ],
  },
];
for (const [region, label] of Object.entries(regions)) {
  const contextId = `twitter-${region}`;
  const seen = new Map<string, string>();
  for (const year of [2020, 2021]) {
    const rawPath = `data/raw/soncco/${region}-${year}.parquet`;
    const expected = provenance.files.find((f) => f.path === rawPath);
    if (
      !expected ||
      createHash('sha256')
        .update(await readFile(rawPath))
        .digest('hex') !== expected.sha256
    )
      throw Error(`Raw source checksum mismatch: ${rawPath}`);
    const rows = await parquetReadObjects({
      file: await asyncBufferFromFile(
        `data/raw/soncco/${region}-${year}.parquet`,
      ),
      compressors,
    });
    inputRows += rows.length;
    for (const raw of rows) {
      const tag = canonicalTag(String(raw.trend_name));
      if (!raw.is_hashtag || !isHashtag(tag)) continue;
      hashtagRows++;
      const time = (raw.observed_at_utc as Date).toISOString();
      const sourceId = String(raw.source_record_id),
        key = `soncco:${sourceId}`;
      const value = raw.tweet_volume === null ? null : Number(raw.tweet_volume),
        rank = Number(raw.rank);
      const fingerprint = JSON.stringify([tag, time, value, rank]);
      if (seen.has(key)) {
        if (seen.get(key) === fingerprint) duplicates++;
        else conflicts++;
        continue;
      }
      seen.set(key, fingerprint);
      const periodStart = time.slice(0, 10) + 'T00:00:00.000Z';
      const id = recordId(contextId, periodStart, tag);
      const next: ArchiveRecord = {
        id,
        contextId,
        hashtag: tag,
        periodStart,
        periodEnd: new Date(Date.parse(periodStart) + DAY).toISOString(),
        observedAt: time,
        value,
        rank,
        evidenceId: key,
        samples: 1,
      };
      records.set(id, mergeDaily(records.get(id), next));
    }
    console.log(`${label} ${year}: ${rows.length} input rows`);
  }
  contexts.push({
    id: contextId,
    sourceId: 'soncco-tweetdeck',
    label: `Twitter · ${label} · 2020–21`,
    platform: 'Twitter / TweetDeck',
    region,
    metric: 'daily-peak-displayed-volume',
    coverageStart: '',
    coverageEnd: '',
    observedDays: 0,
    missingDays: 0,
    sampling:
      'Every valid hashtag; maximum displayed volume in each UTC day. Original winning timestamp and record ID retained. No cross-country summation.',
  });
}
const mastodonBytes = await readFile('data/raw/mastodon.json');
const mastodonProvenance = JSON.parse(
  await readFile('data/raw/mastodon-provenance.json', 'utf8'),
);
if (
  createHash('sha256').update(mastodonBytes).digest('hex') !==
  mastodonProvenance.sha256
)
  throw Error('Mastodon source checksum mismatch.');
const mastodon = JSON.parse(mastodonBytes.toString()) as {
  id: string;
  name: string;
  history: { day: string; uses: string; accounts: string }[];
}[];
sources.push({
  id: 'mastodon-social',
  name: 'mastodon.social · public trending-tag history',
  url: 'https://mastodon.social/api/v1/trends/tags?limit=20',
  attribution:
    'mastodon.social public trends API; Mastodon API documentation https://docs.joinmastodon.org/methods/trends/',
  license:
    'Public API factual aggregate observations; no blanket license asserted for user content.',
  retrievedAt: mastodonProvenance.retrievedAt,
  files: [
    {
      url: 'https://mastodon.social/api/v1/trends/tags?limit=20',
      sha256: createHash('sha256').update(mastodonBytes).digest('hex'),
    },
  ],
  limitations: [
    'One server’s visible history, not the whole fediverse.',
    'Only tags returned by the captured trends endpoint; selection bias.',
    'Recent daily history; latest day may be partial.',
    'No historical trend rank inferred from current response order.',
  ],
});
for (const tag of mastodon) {
  const hashtag = canonicalTag('#' + tag.name);
  if (!isHashtag(hashtag)) continue;
  for (const day of tag.history) {
    inputRows++;
    hashtagRows++;
    const start = new Date(Number(day.day) * 1000).toISOString(),
      id = recordId('mastodon-social', start, hashtag);
    records.set(id, {
      id,
      contextId: 'mastodon-social',
      hashtag,
      periodStart: start,
      periodEnd: new Date(Date.parse(start) + DAY).toISOString(),
      observedAt: null,
      value: Number(day.uses),
      rank: null,
      evidenceId: `mastodon:${tag.id}:${day.day}`,
      samples: 1,
    });
  }
}
contexts.push({
  id: 'mastodon-social',
  sourceId: 'mastodon-social',
  label: 'Mastodon · mastodon.social · recent capture',
  platform: 'Mastodon',
  region: 'mastodon.social',
  metric: 'daily-hashtag-uses',
  coverageStart: '',
  coverageEnd: '',
  observedDays: 0,
  missingDays: 0,
  sampling:
    'Daily uses for tags returned by one trends API capture. Not a full historical trending list.',
});
const panaceaPath = 'data/raw/panacea-hashtags.zip';
const panaceaBytes = await readFile(panaceaPath);
if (
  createHash('md5').update(panaceaBytes).digest('hex') !==
  '493ca38e95711bedcb20c7d547115cdd'
)
  throw Error('Panacea release checksum mismatch.');
const panaceaProvenance = JSON.parse(
  await readFile('data/raw/panacea-provenance.json', 'utf8'),
);
sources.push({
  id: 'panacea-covid',
  name: 'Panacea Lab · COVID-19 Twitter research collection',
  url: 'https://zenodo.org/records/7793560',
  attribution:
    'Banda et al., A large-scale COVID-19 Twitter chatter dataset for open scientific research — an international collaboration. Epidemiologia 2021, 2(3), 315–324. doi:10.3390/epidemiologia2030024. Zenodo v160.',
  license:
    'Zenodo release metadata: other-pd (Other / Public Domain); use factual aggregate files only, no tweets or user profiles.',
  retrievedAt: panaceaProvenance.retrievedAt,
  files: [
    {
      url: panaceaProvenance.url,
      sha256: createHash('sha256').update(panaceaBytes).digest('hex'),
    },
  ],
  limitations: [
    'COVID-keyword research sample, not general Twitter trends or a platform census.',
    'Top 100 valid canonical hashtags per daily file retained; absence is not zero.',
    'Day from publisher filename; no subdaily observation time is asserted.',
    'Early collection is selective and coverage has gaps.',
    'Case/Unicode collisions retain the maximum, never sum potentially overlapping counts.',
  ],
});
await readPanacea(panaceaPath, (date, filename, rows, input) => {
  inputRows += input;
  hashtagRows += rows.length;
  for (const row of rows) {
    const contextId = 'panacea-covid',
      periodStart = date + 'T00:00:00.000Z',
      id = recordId(contextId, periodStart, row.tag);
    if (records.has(id)) throw Error('Duplicate Panacea day/tag');
    records.set(id, {
      id,
      contextId,
      hashtag: row.tag,
      periodStart,
      periodEnd: new Date(Date.parse(periodStart) + DAY).toISOString(),
      observedAt: null,
      value: row.value,
      rank: null,
      evidenceId: `zenodo:7793560:${filename.split('/').at(-1)}:line-${row.line}`,
      samples: 1,
    });
  }
});
contexts.push({
  id: 'panacea-covid',
  sourceId: 'panacea-covid',
  label: 'Twitter · COVID research sample · 2020–23',
  platform: 'Twitter research sample',
  region: 'Multilingual COVID-keyword collection',
  metric: 'daily-hashtag-uses',
  coverageStart: '',
  coverageEnd: '',
  observedDays: 0,
  missingDays: 0,
  sampling:
    'Top 100 canonical hashtags per publisher daily aggregate file. Date resolution only; UTC calendar bins are display intervals, not known snapshot times.',
});
if (conflicts)
  throw Error(
    `Conflicting source IDs: ${conflicts}. Resolve before publishing.`,
  );
const observations = [...records.values()].sort(
  (a, b) =>
    a.periodStart.localeCompare(b.periodStart) ||
    a.contextId.localeCompare(b.contextId) ||
    a.hashtag.localeCompare(b.hashtag),
);
for (const c of contexts) {
  const rows = observations.filter((r) => r.contextId === c.id);
  c.coverageStart = rows[0].periodStart;
  c.coverageEnd = rows.at(-1)!.periodEnd;
  c.observedDays = new Set(rows.map((r) => r.periodStart)).size;
  c.missingDays =
    Math.round(
      (Date.parse(c.coverageEnd) - Date.parse(c.coverageStart)) / DAY,
    ) - c.observedDays;
}
const archive: HistoryArchive = {
  schemaVersion: 1,
  title: 'The Hashtag Zeitgeist · canonical evidence archive',
  compiledAt,
  sources,
  contexts,
  observations,
  policy: {
    deduplication:
      'Deduplicate source record IDs. Normalize hashtag Unicode NFC and case only. Group by source context + UTC day + canonical hashtag. Keep highest displayed volume, never sum overlapping snapshots. Separate incompatible contexts.',
    missing:
      'No record means unknown. Subsets and daily maxima are explicitly described per context. Never fabricate zeroes, birthdays, ranks, or fill uncovered dates.',
    time: 'UTC ISO-8601 intervals sorted by periodStart; original observation time retained where provided. Daily aggregates never masquerade as exact midnight sightings.',
    scope:
      'Single canonical file, multiple separately selectable measurement contexts. No blending of platforms, countries or incompatible metrics.',
  },
  stats: {
    inputRows,
    hashtagRows,
    outputRows: observations.length,
    duplicates,
    conflicts,
  },
};
await mkdir('static/data', { recursive: true });
await writeFile('data/evidence-archive.json', JSON.stringify(archive));
await writeFile(
  'data/archive-summary.json',
  JSON.stringify({ ...archive, observations: undefined }, null, 2),
);
await writeFile(
  'data/evidence-archive.sha256',
  createHash('sha256').update(JSON.stringify(archive)).digest('hex') +
    '  history.json\n',
);
console.log(JSON.stringify(archive.stats));
