# The Hashtag Zeitgeist

A responsive, two-dimensional radial atlas of ten hashtags through time. Built with Svelte 5, SvelteKit 3 and SVG. The active view has **no animal icons, sphere, WebGL requirement or source selector**.

- Circle area and the ranked bars show frequency share within the compiled candidate vocabulary. Circle area uses an absolute share scale, so the leader grows as its share grows.
- Distance from the center compares first-seen age, scaled to the oldest visible signal. The age bands expand to the viewport; gentle drift and collision relief keep older and growing signals readable.
- Ten muted rainbow colors identify visible signals and match their bars. Momentum changes glow and lift rather than changing identity color.
- Playback defaults to one day per four seconds, with a slower one-day/eight-second option. It always goes forward. Restart, date input, year markers and scrubbing navigate the same timeline; wheel scrubbing is desktop-only so phones/tablets can scroll the page.
- Short gaps interpolate smoothly. Long uncovered breaks crossfade between available dates without presenting invented years of observations.

## Run

Node 24+ and pnpm:

```sh
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

Open http://localhost:5173 in Firefox (Safari fallback). Chrome is not used. For deployment choose a SvelteKit adapter appropriate to the target host.

## One application JSON

`static/data/history.json` is the **only history file fetched by the application**. Schema version 2 stores chronological dated frames, each with up to ten hashtags, source counts/frequency, normalized share, momentum, first-seen date and evidence reference. It also retains source attribution, methodology, coverage and raw-capture checksums. `history.sha256` checks the delivered file.

The compilation spans **9 September 2008–27 October 2026**, with a substantial uncovered interval between the end of the Twitter series and the beginning of the Bluesky series. It is not complete from hashtag inception in 2007, nor a certified worldwide top-ten ranking. See [timeline methodology](docs/timeline-methodology.md), [source research](docs/data-research.md), and `data/timeline-summary.json`.

Historical Twitter and recent Bluesky aggregate series provide the primary history. The compiler automatically chooses one evidence family per day; national trend-list observations, COVID research aggregates and a Mastodon capture supply fallback evidence where available. It never sums overlapping country lists or mixes platform counts into a claimed global total. Source details live behind “About the archive,” not in the main controls.

```sh
pnpm data:fetch    # cached acquisition, including historical vocabulary discovery
pnpm data:evidence # rebuild the detailed auxiliary evidence archive
pnpm data:build    # compile the single application timeline
```

Raw captures remain in `data/raw/` with metadata and SHA-256 hashes; they are ignored by Git. Acquisition is cached and finite. No scheduler, paid service, account or recurring collector was created. The live Mastodon URL changes over time: keep its frozen cache to reproduce this capture.

The large auxiliary `data/evidence-archive.json` preserves the first compilation's 245,499 dated observations, country/sample distinctions and source IDs. The UI does not download it. Legacy 3D/demo modules remain available in the repository but are not used or bundled by the active page.

## Validation

Tests cover canonical evidence, checksums, source isolation, chronological top-ten frames, short-gap interpolation, long-gap handling, forward playback and source-record immutability. The radial view and forward/pause controls were checked in Firefox. Production builds no longer include Three.js in the active page.

Visual motion uses persistent identities with damped percentage, ranking, position and size updates. Departures fade rather than unmount abruptly; new arrivals ease in. Reduced-motion settings disable interpolation and drift. Responsive Firefox checks include a 390×844 phone and a 1024×768 tablet landscape; rankings stay available below the map on narrower screens.

The Radial / Linear presentation switch keeps the current date, playback, selection and signal identities. Linear mode connects age-ordered circles from newer on the left to older on the right; spacing is adjusted for readability, rather than an exact duration scale. Circles settle on one baseline, with size-aware horizontal spacing. Active circles remain visible while repositioning. Departures hold their horizontal position and accelerate downward as they fade; returns enter visibly just above their age position, without bouncing. On small screens the linear diagram scrolls horizontally. Both views retain centered hashtags, optional smaller percentages and age below, without drop shadows. The calendar uses day–month–year order, with matching day/month typography.

Daily updates: `pnpm data:update` appends completed UTC days from the public mastodon.social trending-tag sample to the existing schema-v2 JSON. Captures, checksums, historical preservation, recovery and scheduling are documented in [daily updates](docs/daily-updates.md). `pnpm data:build` retains the saved daily extension.
