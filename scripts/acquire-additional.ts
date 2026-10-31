import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
await mkdir('data/raw', { recursive: true });
for (const item of [
  {
    name: 'mastodon',
    path: 'data/raw/mastodon.json',
    url: 'https://mastodon.social/api/v1/trends/tags?limit=20',
  },
  {
    name: 'panacea',
    path: 'data/raw/panacea-hashtags.zip',
    url: 'https://zenodo.org/api/records/7793560/files/hashtags.zip/content',
  },
]) {
  try {
    await access(item.path);
    await access(`data/raw/${item.name}-provenance.json`);
    console.log(`Using frozen cache: ${item.name}`);
    continue;
  } catch {}
  const response = await fetch(item.url, {
    signal: AbortSignal.timeout(900000),
  });
  if (!response.ok || !response.body)
    throw Error(`${item.url}: ${response.status}`);
  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
    createWriteStream(item.path),
  );
  const bytes = await readFile(item.path);
  await writeFile(
    `data/raw/${item.name}-provenance.json`,
    JSON.stringify(
      {
        url: item.url,
        retrievedAt: new Date().toISOString(),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      null,
      2,
    ),
  );
  console.log(`Captured ${item.name}: ${bytes.length} bytes`);
}
