import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const sha = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
await mkdir('data/raw/discovery', { recursive: true });
const dates: string[] = ['2008-10-01'];
for (let year = 2009; year <= 2023; year++) {
  dates.push(`${year}-01-01`);
  if (year < 2023) dates.push(`${year}-07-01`);
}
for (const [domain, folder, anchors] of [
  ['twitter', 'storywrangler', dates],
  [
    'bluesky',
    'bluesky',
    ['2024-12-15', '2025-01-01', '2025-07-01', '2026-01-01', '2026-07-01'],
  ],
] as const) {
  const known = new Set<string>();
  for (const f of await readdir(`data/raw/${folder}`)) {
    if (f.endsWith('.json.meta'))
      known.add(
        JSON.parse(await readFile(`data/raw/${folder}/${f}`, 'utf8')).tag,
      );
  }
  const discovered = new Set<string>();
  for (const date of anchors) {
    const params = new URLSearchParams({
      domain,
      dataset: 'ngrams',
      dates: date,
      limit: '3000',
    });
    if (domain === 'bluesky') {
      params.set('n', '1');
      params.set('lang', 'en');
    }
    const url =
      'https://api.storywrangler.uvm.edu/storywrangler/top-ngrams?' + params;
    const path = `data/raw/discovery/${domain}-${date}.json`;
    let response;
    try {
      response = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) {
        console.log(`${domain} ${date}: ${r.status}`);
        if (r.status === 429) throw Error('Rate limited; resume later.');
        continue;
      }
      const bytes = new Uint8Array(await r.arrayBuffer());
      response = JSON.parse(Buffer.from(bytes).toString());
      await writeFile(path, bytes);
      await writeFile(
        path + '.meta',
        JSON.stringify({
          url,
          retrievedAt: new Date().toISOString(),
          sha256: sha(bytes),
        }),
      );
    }
    const tags = (response.data ?? [])
      .filter((r: { types: string }) => /^#[\p{L}\p{M}\p{N}_]+$/u.test(r.types))
      .slice(0, 10)
      .map((r: { types: string }) => r.types);
    for (const tag of tags) discovered.add(tag);
    console.log(`${domain} ${date}: discovered ${tags.length}`);
  }
  for (const tag of discovered) {
    if (known.has(tag)) continue;
    const path = `data/raw/${folder}/discovered-${sha(tag).slice(0, 16)}.json`;
    const params = new URLSearchParams({
      domain,
      dataset: 'ngrams',
      type: tag,
    });
    if (domain === 'bluesky') {
      params.set('n', '1');
      params.set('lang', 'en');
    }
    const url =
      'https://api.storywrangler.uvm.edu/storywrangler/term-series?' + params;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) {
        if (r.status === 429) throw Error('Rate limited; resume later.');
        console.log(`${tag}: ${r.status}`);
        continue;
      }
      const bytes = new Uint8Array(await r.arrayBuffer()),
        json = JSON.parse(Buffer.from(bytes).toString());
      if (!Array.isArray(json.series)) continue;
      await writeFile(path, bytes);
      await writeFile(
        path + '.meta',
        JSON.stringify({
          tag,
          path,
          url,
          retrievedAt: new Date().toISOString(),
          sha256: sha(bytes),
          rows: json.series.length,
          selection:
            'Top ten actual hashtags among top 3000 ngrams on Jan/Jul anchor dates; discovery evidence in data/raw/discovery.',
        }),
      );
      console.log(`${domain} ${tag}: ${json.series.length} days`);
    } catch (e) {
      console.error(`${tag}: ${e}`);
      if (String(e).includes('Rate limited')) throw e;
    }
  }
}
