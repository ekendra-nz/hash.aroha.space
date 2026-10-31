import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateZeitgeist } from '../src/lib/data/zeitgeist.ts';
const bytes = await readFile('static/data/history.json', 'utf8');
const history = validateZeitgeist(JSON.parse(bytes));
const expected = (await readFile('static/data/history.sha256', 'utf8'))
  .trim()
  .split(/\s+/)[0];
if (createHash('sha256').update(bytes).digest('hex') !== expected)
  throw Error('History checksum mismatch');
if (process.env.BEFORE_PATH) {
  const before = validateZeitgeist(
    JSON.parse(await readFile(process.env.BEFORE_PATH, 'utf8')),
  );
  if (
    JSON.stringify(history.frames.slice(0, before.frames.length)) !==
    JSON.stringify(before.frames)
  )
    throw Error('Historical observations changed');
}
console.log(
  `Verified ${history.frames.length} frames through ${history.coverage.end}`,
);
