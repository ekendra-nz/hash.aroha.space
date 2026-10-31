import { validateZeitgeist, type ZeitgeistHistory } from './zeitgeist';
export function historyURL(configured: string | undefined) {
  if (!configured?.trim()) return '/data/history.json';
  const url = new URL(configured.trim());
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'raw.githubusercontent.com' ||
    !url.pathname.endsWith('/static/data/history.json') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error(
      'VITE_HISTORY_URL must be a public raw.githubusercontent.com URL ending in /static/data/history.json',
    );
  return url.toString();
}
/** Check a small manifest first; only download the archive when its checksum changes. */
export async function loadHistory(
  url: string,
  previous: string | null,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<{ history: ZeitgeistHistory; checksum: string } | null> {
  const version = Math.floor(Date.now() / 60000);
  const options: RequestInit = { signal, cache: 'no-store' };
  const manifest = await request(
    url.replace(/history\.json$/, 'history.sha256') + `?check=${version}`,
    options,
  );
  if (!manifest.ok)
    throw Error(`History update check failed (${manifest.status})`);
  const checksum = (await manifest.text()).trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw Error('Invalid history checksum');
  if (checksum === previous) return null;
  const response = await request(url + `?version=${checksum}`, options);
  if (!response.ok) throw Error(`History unavailable (${response.status})`);
  const bytes = await response.arrayBuffer();
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
  if (digest !== checksum)
    throw Error('History is being updated; retry shortly');
  return {
    history: validateZeitgeist(JSON.parse(new TextDecoder().decode(bytes))),
    checksum,
  };
}
