import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateArchive, archiveDataset, type ArchiveRecord } from './archive';
import {
  mergeDaily,
  recordId,
  canonicalTag,
} from '../../../scripts/archive-core';
import { prepare, sample } from '../analytics/pipeline';
const bytes = readFileSync('data/evidence-archive.json');
const archive = JSON.parse(bytes.toString());
const DAY = 86400000;
describe('canonical evidence archive', () => {
  it('validates the shipped archive, exact stats and checksum', () => {
    expect(validateArchive(archive).observations.length).toBe(
      archive.stats.outputRows,
    );
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      readFileSync('data/evidence-archive.sha256', 'utf8').split(' ')[0],
    );
    expect(archive.sources.length).toBeGreaterThanOrEqual(3);
    expect(archive.stats.conflicts).toBe(0);
  });
  it('preserves an independently checked upstream daily value', () => {
    const record = archive.observations.find(
      (r: ArchiveRecord) =>
        r.contextId === 'panacea-covid' &&
        r.hashtag === '#covid19' &&
        r.periodStart === '2021-01-01T00:00:00.000Z',
    );
    expect(record.value).toBe(30129);
    expect(record.evidenceId).toBe(
      'zenodo:7793560:2021-01-01_clean-hashtags.tsv:line-2',
    );
    expect(record.observedAt).toBeNull();
  });
  it('rejects duplicate evidence buckets and invalid dates', () => {
    expect(() =>
      validateArchive({
        ...archive,
        observations: [archive.observations[0], archive.observations[0]],
      }),
    ).toThrow('Duplicate canonical');
    expect(() =>
      validateArchive({
        ...archive,
        observations: [{ ...archive.observations[0], periodEnd: 'bad' }],
      }),
    ).toThrow('UTC');
  });
  it('keeps countries and platforms isolated', () => {
    const d = archiveDataset(archive, 'twitter-MX');
    expect(new Set(d.observations.map((o) => o.region))).toEqual(
      new Set(['MX']),
    );
    expect(d.simulated).toBe(false);
    expect(d.observations.every((o) => o.validUntil && o.evidenceId)).toBe(
      true,
    );
  });
  it('holds daily values only inside their interval and leaves a gap empty', () => {
    const d = archiveDataset(archive, 'mastodon-social');
    const tag = d.identities[0].tag;
    const rows = d.observations.filter((o) => o.hashtag === tag);
    d.observations = [
      rows[0],
      {
        ...rows[0],
        date: new Date(Date.parse(rows[0].date) + 3 * DAY).toISOString(),
        validUntil: new Date(Date.parse(rows[0].date) + 4 * DAY).toISOString(),
      },
    ];
    const points = prepare(d).get(tag)!;
    const t = points[0].time;
    expect(sample(points, t + DAY / 2)?.value).toBe(rows[0].value);
    expect(sample(points, t + DAY)?.value).toBeUndefined();
    expect(sample(points, t + 2 * DAY)).toBeNull();
    expect(points[1].momentum).toBe(0);
    expect(sample(points, t + 4 * DAY)).toBeNull();
  });
  it('retains peak evidence without summing overlapping snapshots', () => {
    const base = {
      ...archive.observations.find((r: ArchiveRecord) => r.value !== null),
      value: 100,
      samples: 1,
    } as ArchiveRecord;
    const next = { ...base, value: 80, evidenceId: 'different' };
    const merged = mergeDaily(base, next);
    expect(merged.value).toBe(100);
    expect(merged.samples).toBe(2);
    expect(merged.evidenceId).toBe(base.evidenceId);
    expect(() =>
      mergeDaily(base, { ...next, contextId: 'another-country' }),
    ).toThrow('incompatible');
  });
  it('normalizes case and Unicode without conflating dates or contexts', () => {
    expect(canonicalTag(' #CAFÉ ')).toBe('#café');
    expect(recordId('a', '2020-01-01', '#CAFÉ')).toBe(
      recordId('a', '2020-01-01', '#cafe\u0301'),
    );
    expect(recordId('a', '2020-01-01', '#x')).not.toBe(
      recordId('b', '2020-01-01', '#x'),
    );
  });
});
