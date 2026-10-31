# Auxiliary evidence format, version 1

The active application uses version 2, described in [timeline methodology](timeline-methodology.md).

The auxiliary evidence file is `data/evidence-archive.json`. It contains `schemaVersion`, `compiledAt`, `title`, `sources`, `contexts`, `observations`, `policy`, and `stats`. TypeScript contracts and runtime validation live in `src/lib/data/archive.ts`.

Each source records its ID, attribution, license statement, limitations, original URL, acquisition time and SHA-256 checksums of raw inputs. Each context records its source ID, platform, geography/sample, metric, sampling rule, coverage span, observed-day count and missing-day count.

Observation fields:

| Field | Meaning |
|---|---|
| `id` | Stable hash of context + period start + canonical hashtag |
| `contextId` | Reference to one compatible measurement context |
| `hashtag` | Unicode NFC, lowercase, leading `#`; plain topics excluded |
| `periodStart`, `periodEnd` | ISO-8601 UTC, half-open daily interval `[start,end)` |
| `observedAt` | Original winning snapshot timestamp, or null for date-only aggregates |
| `value` | Nonnegative count/approximate displayed volume, or null when unknown |
| `rank` | Original trend-list position if supplied, otherwise null; not a synthesized global rank |
| `evidenceId` | Upstream record ID or release + file + line reference |
| `samples` | Number of source snapshots contributing to a daily bucket; never used as a volume multiplier |

Records are sorted chronologically, then by context and hashtag. Unique key: `(contextId, periodStart, canonical hashtag)`. A gap has no record. A known measured zero is distinct from a null value and from absence. Do not convert unknowns to zero or interpolate across missing dates.

`stats.inputRows` counts nonempty upstream observations considered; `hashtagRows` counts hashtag records admitted by the source adapters (before daily consolidation; Panacea is explicitly top-100 selected). `outputRows` is the final record count. `duplicates` and `conflicts` concern repeated upstream source IDs. Compilation fails on conflicts. These counters are not estimates of global social activity.

To add a source: preserve the raw snapshot and checksum, register attribution/terms and a separate context, implement a TypeScript adapter with honest date resolution, retain evidence references, run validation/tests, and rebuild. Add a reconciliation method before combining sources that could cover the same posts. Source overlap is not additive merely because timestamps match.
