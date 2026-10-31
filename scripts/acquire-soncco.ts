import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const repo = 'soncco/historical-twitter-trends-spanish-locations-2020-2021';
const revision = '63a45c4eca5d7f8414d5a22e7ee463c2f50ef4b1';
await mkdir('data/raw/soncco', { recursive: true });
let cached: {
  files: { path: string; url: string; retrievedAt: string; sha256: string }[];
} = { files: [] };
try {
  cached = JSON.parse(
    await readFile('data/raw/soncco/provenance.json', 'utf8'),
  );
} catch {}
const provenance: {
  path: string;
  url: string;
  retrievedAt: string;
  sha256: string;
}[] = [];
for (const region of [
  'AR',
  'CL',
  'CO',
  'EC',
  'ES',
  'GT',
  'MX',
  'PA',
  'PE',
  'PR',
  'VE',
]) {
  for (const year of [2020, 2021]) {
    const path = `data/raw/soncco/${region}-${year}.parquet`;
    const url = `https://huggingface.co/datasets/${repo}/resolve/${revision}/data/${region}/trends-${year}.parquet`;
    try {
      await access(path);
    } catch {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw Error(`${url}: ${r.status}`);
      await writeFile(path, new Uint8Array(await r.arrayBuffer()));
    }
    const bytes = await readFile(path);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const existing = cached.files.find((f) => f.path === path);
    if (existing && existing.sha256 !== sha256)
      throw Error(`Cached source checksum mismatch: ${path}`);
    provenance.push({
      path,
      url,
      retrievedAt: existing?.retrievedAt ?? new Date().toISOString(),
      sha256,
    });
    console.log(`${region} ${year}: ${bytes.length} bytes`);
  }
}
await writeFile(
  'data/raw/soncco/provenance.json',
  JSON.stringify({ repo, revision, files: provenance }, null, 2),
);
