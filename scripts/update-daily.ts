import {
  readFile,
  writeFile,
  mkdir,
  rename,
  open,
  unlink,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateZeitgeist } from '../src/lib/data/zeitgeist.ts';
import {
  collectDaily,
  endpoint,
  type DailyLedger,
} from './lib/daily-history.ts';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await mkdir('data/live/captures', { recursive: true });
const lock = 'data/live/update.lock';
const handle = await open(lock, 'wx').catch(() => {
  throw Error(
    'Daily updater is already running (or a stale data/live/update.lock needs investigation).',
  );
});
const hash = (bytes: string) =>
  createHash('sha256').update(bytes).digest('hex');
async function atomic(path: string, content: string) {
  const tmp = path + `.${process.pid}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, path);
}
try {
  await handle.writeFile(
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  );
  const original = await readFile('static/data/history.json', 'utf8');
  const base = validateZeitgeist(JSON.parse(original));
  let ledger: DailyLedger = { schemaVersion: 1, frames: [], firstSeen: {} };
  try {
    ledger = JSON.parse(await readFile('data/live/frames.json', 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  if (
    ledger.schemaVersion !== 1 ||
    !Array.isArray(ledger.frames) ||
    !ledger.firstSeen
  )
    throw Error('Invalid daily ledger');
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(30000),
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HashtagZeitgeist/1.0 (daily aggregate archive)',
    },
  });
  if (!response.ok)
    throw Error(
      `Trends API returned HTTP ${response.status}; archive unchanged`,
    );
  const raw = await response.text();
  if (raw.length > 2_000_000) throw Error('Unexpectedly large response');
  const capturedAt = new Date().toISOString(),
    sha256 = hash(raw);
  const result = collectDaily(
    base,
    ledger,
    JSON.parse(raw),
    capturedAt,
    sha256,
  );
  const capture = `data/live/captures/${capturedAt.replace(/[:.]/g, '-')}-${sha256.slice(0, 12)}.json`;
  await writeFile(capture, raw, { flag: 'wx' });
  await writeFile(
    capture + '.meta',
    JSON.stringify(
      { url: endpoint, retrievedAt: capturedAt, sha256, path: capture },
      null,
      2,
    ),
  );
  // Ledger first permits recovery after interruption; the public JSON is replaced atomically.
  await atomic('data/live/frames.json', JSON.stringify(result.ledger));
  const output = JSON.stringify(result.history);
  const changed = output !== original;
  if (changed) {
    await writeFile('data/live/historical-baseline.json', original, {
      flag: 'wx',
    }).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    await atomic('static/data/history.json', output);
  }
  await atomic('static/data/history.sha256', hash(output) + '  history.json\n');
  const {
    frames: _,
    captureAudit: __,
    ...summary
  } = result.history as typeof result.history & { captureAudit?: unknown };
  await atomic('data/timeline-summary.json', JSON.stringify(summary, null, 2));
  const expected = new Date(Date.parse(capturedAt.slice(0, 10)) - 86400000)
    .toISOString()
    .slice(0, 10);
  const status = {
    checkedAt: capturedAt,
    source: endpoint,
    appendedDays: result.added.map((f) => f.date),
    end: result.history.coverage.end,
    expectedThrough: expected,
    stale: result.history.coverage.end < expected,
    changed,
    capture,
  };
  await atomic('data/live/status.json', JSON.stringify(status, null, 2));
  console.log(JSON.stringify(status, null, 2));
} finally {
  await handle.close();
  await unlink(lock);
}
