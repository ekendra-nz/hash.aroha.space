import type { ArchiveContext } from './archive';
export type Status = 'observed' | 'transformed' | 'estimated' | 'simulated';
export interface Observation {
  hashtag: string;
  date: string;
  value: number | null;
  source: string;
  platform: string;
  granularity: string;
  measurement: 'count' | 'frequency';
  status: Status;
  validUntil?: string;
  observedAt?: string;
  evidenceId?: string;
  rank?: number;
  bornAt?: string;
  region?: string;
  language?: string;
}
export interface Identity {
  id: string;
  tag: string;
  color: string;
  animal: string;
  anchor: [number, number, number];
  bornAt: number | null;
  birthBasis: 'declared' | 'first-seen';
  angle: number;
}
export interface Dataset {
  archiveContext?: ArchiveContext;
  sourceUrl?: string;
  name: string;
  observations: Observation[];
  identities: Identity[];
  simulated: boolean;
  start: number;
  end: number;
}
export interface DataProvider {
  load(): Promise<Dataset>;
}
const palette = [
  '#79f1cd',
  '#e7b66d',
  '#ac9cf9',
  '#70cffa',
  '#ef8fae',
  '#cbe786',
];
export const animals = ['fox', 'owl', 'cat', 'rabbit', 'bear', 'bird'];
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function identity(tag: string, index: number, total: number): Identity {
  const h = hash(tag),
    r = 3.3 + Math.sqrt((index + 0.5) / total) * 12;
  const a = index * 2.399963;
  return {
    bornAt: null,
    birthBasis: 'first-seen',
    angle: (h / 4294967296) * Math.PI * 2,
    id: tag,
    tag,
    color: palette[h % palette.length],
    animal: animals[h % animals.length],
    anchor: [Math.cos(a) * r, (-r * r) / 55, Math.sin(a) * r],
  };
}
export function dataset(name: string, observations: Observation[]): Dataset {
  const grouped = new Map<string, Observation[]>();
  for (const o of observations) {
    const list = grouped.get(o.hashtag) ?? [];
    list.push(o);
    grouped.set(o.hashtag, list);
  }
  const tags = [...grouped.keys()].sort();
  const times = observations.map((o) => Date.parse(o.date));
  return {
    name,
    observations,
    identities: tags.map((t, i) => {
      const records = grouped.get(t)!;
      const declared = records.find((o) => o.bornAt)?.bornAt;
      const positive = records
        .filter((o) => o.value !== null && o.value > 0)
        .map((o) => Date.parse(o.date));
      return {
        ...identity(t, i, tags.length),
        bornAt: declared
          ? Date.parse(declared)
          : positive.length
            ? Math.min(...positive)
            : null,
        birthBasis: declared ? ('declared' as const) : ('first-seen' as const),
      };
    }),
    simulated: observations.some((o) => o.status === 'simulated'),
    start: times.reduce((a, b) => Math.min(a, b), Infinity),
    end: observations.reduce(
      (a, o) =>
        Math.max(
          a,
          Date.parse(o.validUntil ?? o.date) - (o.validUntil ? 1 : 0),
        ),
      -Infinity,
    ),
  };
}
