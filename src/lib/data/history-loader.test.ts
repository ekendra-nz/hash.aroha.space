import { it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { historyURL, loadHistory } from './history-loader';
const content = JSON.stringify({
  schemaVersion: 2,
  frames: [
    {
      date: '2026-10-30',
      signals: [
        {
          tag: '#a',
          share: 1,
          value: 1,
          momentum: 0,
          firstSeen: '2026-10-30',
          sourceId: 'test',
        },
      ],
    },
  ],
  sources: [{ id: 'test' }],
});
const checksum = createHash('sha256').update(content).digest('hex');
it('uses a configured public repository and rejects credentials or other hosts', () => {
  expect(historyURL('')).toBe('/data/history.json');
  expect(
    historyURL(
      'https://raw.githubusercontent.com/me/site/main/static/data/history.json',
    ),
  ).toContain('raw.githubusercontent.com');
  expect(() =>
    historyURL(
      'https://user:token@raw.githubusercontent.com/me/site/main/static/data/history.json',
    ),
  ).toThrow();
  expect(() =>
    historyURL('https://example.com/static/data/history.json'),
  ).toThrow();
});
it('checks the manifest without downloading unchanged history', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(new Response(checksum + '  history.json'));
  expect(
    await loadHistory(
      '/data/history.json',
      checksum,
      new AbortController().signal,
      request,
    ),
  ).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
});
it('loads and verifies a new archive from the same remote location', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response(checksum))
    .mockResolvedValueOnce(new Response(content));
  const url = historyURL(
    'https://raw.githubusercontent.com/me/site/main/static/data/history.json',
  );
  const result = await loadHistory(
    url,
    null,
    new AbortController().signal,
    request,
  );
  expect(result?.checksum).toBe(checksum);
  expect(result?.history.frames[0].date).toBe('2026-10-30');
  expect(request.mock.calls[1][0]).toBe(url + '?version=' + checksum);
});
it('rejects mismatched bytes during an incomplete publication', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response(checksum))
    .mockResolvedValueOnce(new Response('{}'));
  await expect(
    loadHistory(
      '/data/history.json',
      null,
      new AbortController().signal,
      request,
    ),
  ).rejects.toThrow('being updated');
});
it('reports an unavailable repository without silently substituting bundled history', async () => {
  const request = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
  await expect(
    loadHistory(
      '/data/history.json',
      null,
      new AbortController().signal,
      request,
    ),
  ).rejects.toThrow('404');
});
