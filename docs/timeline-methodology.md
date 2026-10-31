# One timeline: evidence, interpretation and display

This supersedes the initial source-selector design. The application reads only `static/data/history.json` (schema 2). The original schema-1 compilation is retained at `data/evidence-archive.json` for audit, not as a competing user-facing view.

## Historical reach

We acquired full daily aggregate series through the [Storywrangler API](https://storywrangler.uvm.edu/api-reference/storywrangler/get-storywrangler-term-series). The [publisher's explanation](https://storywrangling.org/about) explicitly offers downloadable aggregate frequencies, and describes the sampled Twitter corpus. Attribution is retained to Alshaabi et al., *Storywrangler*, Science Advances (2021), [DOI 10.1126/sciadv.abe6534](https://doi.org/10.1126/sciadv.abe6534). We store aggregate counts/frequencies only, not posts or user records. The article's license is not treated as a blanket license for all underlying platform content.

Twitter samples start in September 2008; the fetched series end in 2023. English Bluesky aggregate series extend from December 2024 into October 2026. The frozen Mastodon capture supplies the newest available dates. The current compilation has **6,050 observed frames**, with **302 Twitter series and 141 Bluesky series** captured. The main uncovered interval is **2 June 2023–1 December 2024** (549 days). The exact frame count, coverage and source list are generated in `data/timeline-summary.json`. There is no verified frequency coverage for 2007, and the 2023–2024 interval is not silently filled with fictional daily counts.

## Vocabulary discovery

The first pass acquired 93 historical seed terms and 108 Bluesky terms. A second pass queried the [top-ngram endpoint](https://storywrangler.uvm.edu/api-reference/storywrangler/get-storywrangler-top-ngrams) at dated anchors: October 2008, January/July 2009–2022, January 2023, and five recent Bluesky dates. From each response's top 3,000 ngrams, it selected the first ten actual hashtags and acquired their full time series, preserving case in the API query. This adds source-discovered popular tags rather than relying entirely on hand-picked examples.

This remains a bounded candidate vocabulary, not an exhaustive census. Annual anchors miss short-lived events between those dates. The resulting top ten means **top ten within the available compiled candidates for that day**, not the official platform trending algorithm. A complete historical top-ten product would require a permitted daily hashtag-distribution export, ideally from the same corpus for the entire period. The discovery snapshots and request metadata are retained in `data/raw/discovery/`.

## Consolidation

For each date, select one available evidence family in this priority order: historical Twitter aggregates, Bluesky aggregates, consolidated TweetDeck lists, COVID research sample, Mastodon capture. The latter families fill only dates not served by the primary families. Source transitions remain auditable inside the JSON; they are not presented as source-choice chores in the interface.

Normalize hashtag identity using Unicode NFC and lowercase. Retain the highest observed value when national lists or case variants collide; never sum potentially overlapping measurements. For a given date/family, normalize relative frequencies when all candidates provide them, otherwise normalize counts. Share is each candidate's measure divided by the total of that family's available candidate measures. Select the ten greatest shares. The top ten need not total 100% because the denominator includes the rest of the tracked vocabulary.

Counts from different measurement families are not comparable in absolute terms. Changes in source coverage or candidate vocabulary can affect normalized share. The JSON retains the original `value`, `frequency`, `sourceId`, `evidenceId`, and `firstSeen` alongside derived `share` and `momentum`. No country or platform aggregate is claimed to represent the whole internet.

Momentum is a bounded log change in share between adjacent available observations, with a small pseudocount. It resets across source-family changes and breaks longer than 14 days. First-seen age is inferred from our captured evidence; it is not an assertion about the invention of a hashtag or the birth of a later movement using it.

## Smooth playback

The evidence JSON contains observed frames. The browser linearly interpolates shares, values and momentum between nearby frames at display time; it does not write estimates back over the evidence. A two-day missing interval blends to the next observation over the corresponding calendar duration. There are no missing-day alerts.

For breaks longer than 14 days, the view crossfades from one available frame to the next and changes the calendar at the midpoint. It does not create intermediate dates that look like measured history. The timeline compresses these uncovered intervals, and year-marker positions follow that same timeline. Date jumps within a long break select the nearer actual frame.

A tag absent from the next top ten fades out visually; this is a transition convention, not an observed zero. New entrants fade in. Up to ten active signals are ranked during the transition; outgoing SVG elements may briefly remain while fading. First-seen age controls radius relative to the oldest visible signal, with a small inner spacing floor for legibility. Circle area is proportional to share, apart from a tiny minimum dot size. Glow amplifies positive momentum visually, while numeric momentum remains unchanged.

## Reproduction and checks

`pnpm data:fetch` caches finite upstream requests. `pnpm data:evidence` rebuilds the auxiliary source archive. `pnpm data:build` compiles the application JSON and checksum. All programs are TypeScript, run by Node 24. Raw responses are checksum-checked before compilation. Do not discard live-source captures when reproducing the same build.

Tests verify chronological ordering, maximum ten records per frame, one source family per frame, share bounds, exact file checksum, missing-day interpolation, forward calendar speed, long-gap behavior and unmodified underlying observations. Firefox testing verifies the rendered radial view, source-selector removal and forward/pause behavior.

## Presentation iteration: 29 October 2026

The evidence and history file are unchanged. Visible signals now have ten distinct pastel identities, matching their ranking bars. Identity slots persist across rank changes; new arrivals claim a free slot, and departures fade. A returning signal can receive a different slot/color if its previous one is occupied.

Display shares, momentum and bar positions use time-based exponential damping (roughly half to three-quarters of a second). The source values remain untouched. Circle area now scales with share against a viewport-based unit, rather than normalizing every frame's largest circle to a fixed radius. Small dots retain a legibility floor. Local collision relaxation moves smaller neighbors more than larger circles; this makes radial age an approximate spatial cue rather than an exact ruler. Exact age remains in the label.

Elliptical age bands use the full map panel. A small, slow angular oscillation adds drift while playback runs; this is decorative movement, not an additional data measurement. Pausing stops the drift while existing transitions settle. The default is one calendar day per four real seconds, with one day per eight seconds available. Reduced-motion mode applies changes immediately and suppresses drift.

On narrow screens the rankings stack below the map and playback controls stay reachable. Wheel events scroll the page rather than changing time. Desktop retains wheel scrubbing.
