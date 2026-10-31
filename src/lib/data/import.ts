import { dataset, type Observation, type DataProvider } from './model';
function csv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.trim());
      cell = '';
      if (c === '\n') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== '\r') cell += c;
  }
  if (quoted) throw Error('CSV contains an unclosed quote.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift() ?? [];
  return rows.map((r) =>
    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])),
  );
}
export function parseImport(text: string, filename: string) {
  const raw: unknown = filename.toLowerCase().endsWith('.json')
    ? JSON.parse(text)
    : csv(text);
  if (!Array.isArray(raw) || !raw.length)
    throw Error(
      'Provide a nonempty array of observations or a CSV with a header row.',
    );
  if (raw.length > 100000)
    throw Error('Maximum 100,000 observations per import.');
  const seen = new Set<string>();
  const observations: Observation[] = raw.map((r, i) => {
    const fail = (message: string): never => {
      throw Error(`Row ${i + 1}: ${message}`);
    };
    if (!r || typeof r !== 'object') return fail('expected an observation.');
    for (const k of [
      'hashtag',
      'date',
      'source',
      'platform',
      'granularity',
      'measurement',
      'status',
    ])
      if (typeof r[k] !== 'string' || !r[k].trim()) fail(`missing ${k}.`);
    if (!/^#[\p{L}\p{N}_]+$/u.test(r.hashtag))
      fail(
        'hashtag must start with # and contain letters, numbers or underscores.',
      );
    if (
      !/^\d{4}-\d{2}-\d{2}/.test(r.date) ||
      !Number.isFinite(Date.parse(r.date))
    )
      fail('date must be ISO formatted.');
    if (
      r.value !== null &&
      typeof r.value !== 'number' &&
      typeof r.value !== 'string'
    )
      fail('value must be a number or null.');
    if (
      r.date.slice(0, 10) !==
        new Date(Date.parse(r.date)).toISOString().slice(0, 10) &&
      !r.date.includes('T')
    )
      fail('invalid calendar date.');
    const value = r.value === null || r.value === '' ? null : Number(r.value);
    if (value !== null && (!Number.isFinite(value) || value < 0))
      fail('value must be nonnegative or blank/null for missing.');
    if (
      !['observed', 'transformed', 'estimated', 'simulated'].includes(r.status)
    )
      fail('invalid status.');
    if (!['count', 'frequency'].includes(r.measurement))
      fail('measurement must be count or frequency.');
    if (
      r.bornAt &&
      (typeof r.bornAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}/.test(r.bornAt) ||
        !Number.isFinite(Date.parse(r.bornAt)))
    )
      fail('bornAt must be an ISO date.');
    if (
      r.bornAt &&
      value !== null &&
      value > 0 &&
      Date.parse(r.date) < Date.parse(r.bornAt)
    )
      fail('positive observation precedes bornAt.');
    const key = r.hashtag + Date.parse(r.date);
    if (seen.has(key)) fail('duplicate hashtag/date.');
    seen.add(key);
    return { ...r, value } as Observation;
  });
  const signatures = new Set(
    observations.map((o) =>
      [
        o.source,
        o.platform,
        o.measurement,
        o.granularity,
        o.region ?? '',
        o.language ?? '',
      ].join('|'),
    ),
  );
  if (signatures.size > 1)
    throw Error(
      'Import one compatible source, platform, measurement, granularity, region and language at a time. Normalize mixed sources before importing.',
    );
  for (const tag of new Set(observations.map((o) => o.hashtag))) {
    const records = observations.filter((o) => o.hashtag === tag);
    const births = new Set(
      records.filter((o) => o.bornAt).map((o) => Date.parse(o.bornAt!)),
    );
    if (births.size > 1) throw Error(`${tag}: conflicting bornAt dates.`);
    const birth = [...births][0];
    if (
      birth !== undefined &&
      records.some((o) => (o.value ?? 0) > 0 && Date.parse(o.date) < birth)
    )
      throw Error(`${tag}: positive observation precedes bornAt.`);
  }
  const result = dataset(filename, observations);
  if (result.identities.length > 100)
    throw Error('Maximum 100 hashtags per file.');
  return result;
}
export class LocalFileProvider implements DataProvider {
  constructor(private file: File) {}
  async load() {
    if (this.file.size > 15000000) throw Error('File exceeds 15 MB.');
    return parseImport(await this.file.text(), this.file.name);
  }
}
