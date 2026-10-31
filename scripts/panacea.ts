import { createReadStream } from 'node:fs';
import { Unzip, UnzipInflate } from 'fflate';
import { canonicalTag, isHashtag } from './archive-core.ts';
/** Read entries in memory, never extract upstream relative paths to disk. */
export async function readPanacea(
  path: string,
  accept: (
    date: string,
    filename: string,
    rows: { tag: string; value: number; line: number }[],
    input: number,
  ) => void,
) {
  let failure: Error | undefined;
  const unzip = new Unzip((file) => {
    if (!/\d{4}-\d{2}-\d{2}_clean-hash?tags\.tsv$/.test(file.name)) return;
    const date = file.name.match(/\d{4}-\d{2}-\d{2}/)![0];
    const chunks: Uint8Array[] = [];
    file.ondata = (err, chunk, final) => {
      if (err) {
        failure = err;
        return;
      }
      chunks.push(chunk);
      if (!final) return;
      const text = Buffer.concat(chunks).toString('utf8');
      const rows = new Map<
        string,
        { tag: string; value: number; line: number }
      >();
      let input = 0;
      for (const [index, line] of text.split('\n').entries()) {
        if (!line.trim() || line.trim() === '0\t1') continue;
        input++;
        const [raw, count] = line.trim().split('\t');
        const tag = canonicalTag(raw),
          value = Number(count);
        if (!isHashtag(tag) || !Number.isSafeInteger(value) || value < 0)
          continue;
        // Case variants may overlap; retain maximum rather than fabricate a total.
        if (!rows.has(tag) || rows.get(tag)!.value < value)
          rows.set(tag, { tag, value, line: index + 1 });
      }
      accept(
        date,
        file.name,
        [...rows.values()]
          .sort((a, b) => b.value - a.value || a.tag.localeCompare(b.tag))
          .slice(0, 100),
        input,
      );
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for await (const chunk of createReadStream(path)) {
    unzip.push(new Uint8Array(chunk));
    if (failure) throw failure;
  }
  unzip.push(new Uint8Array(), true);
  if (failure) throw failure;
}
