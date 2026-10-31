import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const classics = [
  'barcamp',
  'sandiegofire',
  'sxsw',
  'followfriday',
  'ff',
  'iranelection',
  'tcot',
  'p2',
  'music',
  'news',
  'fail',
  'nowplaying',
  'jobs',
  'fb',
  'iranelections',
  'haiti',
  'worldcup',
  'occupywallstreet',
  'ows',
  'egypt',
  'jan25',
  'arab spring',
  'kony2012',
  'sandy',
  'election2012',
  'obama',
  'ferguson',
  'blacklivesmatter',
  'icebucketchallenge',
  'prayforparis',
  'lovewins',
  'jesuischarlie',
  'brexit',
  'maga',
  'metoo',
  'timesup',
  'marchforourlives',
  'climatestrike',
  'fridaysforfuture',
  'hongkong',
  'coronavirus',
  'covid19',
  'stayhome',
  'bts',
  'btsarmy',
  'bitcoin',
  'ukraine',
  'russia',
  'nft',
  'wordle',
  'chatgpt',
  'ai',
  'twitter',
  'superbowl',
  'oscars',
  'olympics',
  'euro2016',
  'euro2020',
  'worldcup2014',
  'worldcup2018',
  'worldcup2022',
  'love',
  'tbt',
  'gameofthrones',
  'eurovision',
  'pokemon',
  'pokemon go',
  'pokemongo',
  'trump',
  'resist',
  'voteblue',
  'freepalestine',
  'gaza',
  'football',
  'f1',
  'nba',
  'happynewyear',
  'christmas',
  'halloween',
  'earthday',
  'pride',
  'photography',
  'art',
  'technology',
  'science',
  'climatechange',
  'cop26',
  'cop27',
  'covid',
  'vaccine',
  'breaking',
  'newsnight',
  'auspol',
  'nzpol',
  'cdnpoli',
];
const tags = [
  ...new Set(classics.filter((t) => !t.includes(' ')).map((t) => '#' + t)),
];
await mkdir('data/raw/storywrangler', { recursive: true });
const manifest: {
  tag: string;
  path: string;
  url: string;
  retrievedAt: string;
  sha256: string;
  rows: number;
}[] = [];
for (const tag of tags) {
  const path = `data/raw/storywrangler/${tag.slice(1)}.json`,
    metaPath = path + '.meta';
  const url =
    'https://api.storywrangler.uvm.edu/storywrangler/term-series?' +
    new URLSearchParams({ domain: 'twitter', dataset: 'ngrams', type: tag });
  try {
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    manifest.push(meta);
    continue;
  } catch {}
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const json = JSON.parse(Buffer.from(bytes).toString());
    if (!Array.isArray(json.series)) throw Error('No series returned');
    await writeFile(path, bytes);
    const meta = {
      tag,
      path,
      url,
      retrievedAt: new Date().toISOString(),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rows: json.series.length,
    };
    await writeFile(metaPath, JSON.stringify(meta));
    manifest.push(meta);
    console.log(`${tag}: ${json.series.length} days`);
  } catch (error) {
    console.error(`${tag}: ${error}`);
  }
}
await writeFile(
  'data/raw/storywrangler/provenance.json',
  JSON.stringify(
    {
      selection:
        'Explicit historical seed vocabulary; not an exhaustive global hashtag ranking.',
      files: manifest,
    },
    null,
    2,
  ),
);
console.log(`Captured ${manifest.length}/${tags.length} series`);
