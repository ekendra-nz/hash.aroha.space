# Initial evidence-source review (schema 1)

**The active application now uses the consolidated schema-2 timeline. See [current timeline methodology](timeline-methodology.md). The country/source selector described by the initial build has been removed. This document preserves the research audit for the auxiliary evidence archive.**

Research and collection: 28 October 2026 (New Zealand). The initial evidence compilation is retained in `data/evidence-archive.json`. This is our versioned compilation of scoped evidence, not a claim to possess the entire internet's trend history. The delivered build contains **245,499 observations, 50,758 canonical hashtags, 3 sources and 13 separate measurement contexts**. Historical coverage spans 2020–April 2023 with source-specific gaps, plus the October 2026 Mastodon capture; intervening years are not filled. Machine-readable provenance and exact coverage are in `data/archive-summary.json` and inside the canonical JSON.

## Sources included

| Source | What it actually measures | Coverage and precision | Access/reuse evidence | Decision |
|---|---|---|---|---|
| [Soncco historical TweetDeck trends](https://huggingface.co/datasets/soncco/historical-twitter-trends-spanish-locations-2020-2021) | Approximate displayed volumes and list positions in 11 national trend lists | July 2020–September 2021; snapshot times reconstructed into UTC using collector offsets | Downloadable Parquet; dataset card states ODC-By 1.0 for compilation | Include every syntactically valid hashtag, consolidate to daily maximum volume per country. Preserve winning timestamp, original record ID, and contributing snapshot count. |
| [Panacea Lab, Zenodo release 160](https://zenodo.org/records/7793560) | Daily hashtag frequencies in a COVID-keyword research collection | January 2020–April 2023; publisher date files, selective early coverage and gaps | Aggregate ZIP; Zenodo metadata identifies `other-pd`; [project methods](https://github.com/thepanacealab/covid19_twitter), [publication](https://doi.org/10.3390/epidemiologia2030024) | Include top 100 valid canonical tags per daily file. Keep this topic-specific sample separate from general trend-list observations. |
| [mastodon.social trends API](https://mastodon.social/api/v1/trends/tags?limit=20) | Daily uses of tags returned by one server's current trends response | Seven recent calendar days in the captured response; newest day may be partial | Public factual aggregates; [official API documentation](https://docs.joinmastodon.org/methods/trends/). No blanket license asserted for users' content | Include the frozen 20-tag capture. This is neither a historical ranking archive nor a fediverse-wide census. |

Soncco attribution: Braulio Andrés Soncco Pimentel (2026), *Historical Twitter Trends Across 11 Spanish-Speaking Locations (2020–2021)*, v1.0.0. Pinned Hugging Face revision: `63a45c4eca5d7f8414d5a22e7ee463c2f50ef4b1`. Country refers to the selected list, not author location. Platform-provided volumes across lists may overlap; they are never summed across countries. Zero-as-missing semantics in the upstream cleaned volume field remain null. Fixed-offset reconstruction has timezone/DST limitations.

Panacea attribution: Banda et al., *A large-scale COVID-19 Twitter chatter dataset for open scientific research—an international collaboration*, Epidemiologia 2(3), 315–324 (2021). DOI above. Release ZIP MD5 checked against Zenodo: `493ca38e95711bedcb20c7d547115cdd`. Original entry basename and line number identify each retained value. ZIP entries are read in memory, never extracted using their relative paths. Its date-only records are displayed in UTC calendar bins without inventing a subdaily timestamp. Inclusion is aggregate factual data only, with no tweet text or user profiles.

Mastodon capture is frozen locally with acquisition time and checksum. Returned current tags have a retrospective daily history; that does not establish that they were trending on each historical day. A fresh fetch from this live URL will naturally produce a different capture. Preserve the bundled JSON/checksum and raw cache for reproducibility.

## Other sources investigated

| Candidate | Evidence found | Decision / next requirement |
|---|---|---|
| [Storywrangler API](https://storywrangler.uvm.edu/api-reference/storywrangler/get-storywrangler-term-series) / [research site](https://storywrangling.org/) | A real API query returned daily hashtag count, rank and relative frequency for a January 2020 sample; see `real-data.md` for exact endpoint and response | Promising broad history. Bulk retention/redistribution terms remain unverified, so no bulk mirror is bundled. Frequency rank is not Twitter's official trending rank. |
| [Stanford SNAP hashtag time series](https://snap.stanford.edu/data/ksc-time-series.html) | 1,000 high-volume hashtags from June–December 2009; 128-hour sequences and temporal metadata | Strong early-history candidate, but resolve sequence alignment, selection bias and reuse terms before merging. Selected event windows cannot stand in for continuous 2009 history. |
| [Twitter trending hashtags 2020–2025](https://huggingface.co/datasets/ronantakizawa/twitter-trending-hashtags) | Annual peak summaries; card describes hashtags **or topics**, removed hash prefixes, approximate peak dates and archive-derived sources | Excluded from time series: cannot reliably recover hashtag identity, daily trajectory or exact evidence timestamp. A row-index timestamp in a converted mirror is not historical time. |
| [tt-history](https://github.com/ilhan-mstf/tt-history) | Source code and claims of Turkish/world trend collection since 2013 | Candidate lead; code is not the observations. Need an actual timestamped export and data reuse terms. |
| [Trends24 archive](https://archive.trends24.in/) | Commercial historical access | Candidate licensed provider. No purchase, paywall bypass or unsupported scrape performed. Need a permitted machine-readable export and provenance contract. |
| [Onurmatik archive](https://onurmatik.github.io/twitter-trending-topics-archive/) | Historical archive/demo references | No reliable full export verified. Not included based on a landing-page claim alone. |
| [Historical Twitter IDs 2006–2009](https://zenodo.org/records/3833781) | Tweet IDs rather than ready hashtag aggregates | IDs alone do not give hashtag counts; hydration/access and coverage would be a separate project. |
| [Bluesky official endpoints](https://endpoints.bsky.app/) | Public search and streaming interfaces | Suitable for prospective collection. Search results are not a complete retrospective census, nor an official hashtag trend history. |
| [Google Trends](https://trends.google.com/trends/) | Search interest | A different metric; do not present it as social hashtag frequency. Could later be a separate contextual layer. |

## Canonical contract

- Dates are explicit UTC intervals, sorted by period start. `observedAt` is present only when the source supplied a snapshot time. A daily file is never promoted to an exact midnight sighting.
- Every observation references a context; every context references a source. Context means source + platform + geography/sample + measurement definition. Incompatible contexts are selectable, never silently pooled.
- Identity normalizes Unicode NFC and lowercase only. It does not translate, strip accents, join synonyms or convert plain trend topics into hashtags.
- Source record IDs are deduplicated before aggregation. Conflicting source IDs fail compilation. A daily Twitter volume is the maximum displayed snapshot value, **not the sum** of snapshots. Different tags' peak times can differ, so the resulting share is a retrospective daily index, not a simultaneous market-share measurement.
- Panacea case-normalization collisions retain the larger value rather than assume disjoint counts. The source ZIP remains the audit trail. Top-100 selection is explicit; missing tags are not recorded as zero.
- No observation means unknown. No interpolation crosses missing calendar days. Momentum resets after gaps. We cannot infer a hashtag's invention date from first appearance in a partial archive.
- A source's coverage span and count of days with retained hashtags are recorded. “Observed day” does not promise every minute was captured, and a day without retained hashtags cannot be distinguished from a collection outage without additional upstream evidence.
- The visualization's area is a ratio within the selected measured cohort. The visible-tag limit never changes that denominator. First-seen age uses the selected context only; the radius scale adapts to its time span and is labeled on the sphere.

## Rebuilding and extending

Node 24+ and pnpm are required. `pnpm data:fetch` acquires the pinned historical files and caches the live capture. `pnpm data:build` compiles the local caches into one chronological JSON, a SHA-256 sidecar and a metadata summary. Raw caches are ignored by Git, but retained locally. Keep their provenance sidecars. Do not delete the Mastodon cache if reproducing this exact capture.

The source checksums and selected source evidence IDs allow the records to be traced back. `pnpm test` checks canonical ordering, duplicate rejection, interval behavior, context separation and the delivered file checksum. The auxiliary evidence is input to the schema-2 timeline compiler; the browser only consumes its consolidated output.

Next coverage priorities: obtain a licensed broad Twitter historical aggregate; align and import the 2009 SNAP event windows; establish an append-only prospective Mastodon/Bluesky collector with immutable raw captures. No automatic recurring collector has been started. Extending the archive requires a documented source context, date semantics, metric, missing-value policy and provenance—not just another list of popular words.
