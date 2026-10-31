import type { DataProvider, Dataset } from './model';
/** Deliberately disabled until licensing and measurement schema are verified. */
export class StorywranglerProvider implements DataProvider {
  async load(): Promise<Dataset> {
    throw new Error(
      'Storywrangler sample access is confirmed; redistribution and caching terms remain unverified. Import a legally obtained, normalized local file instead.',
    );
  }
}
