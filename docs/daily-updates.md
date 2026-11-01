# Daily hashtag updates

Run `pnpm data:update` from this project (Node 24+). It fetches the public [mastodon.social trending-tags endpoint](https://mastodon.social/api/v1/trends/tags?limit=20), using the documented [daily tag history](https://docs.joinmastodon.org/entities/Tag/). No credentials are required. The request is bounded by a 30-second timeout. HTTP failures, malformed data, and empty responses leave the public history untouched.

The same `static/data/history.json` schema version 2 continues to drive both presentations. Each new frame contains up to ten hashtags, ordered by daily uses. Shares are normalized across all eligible tags in that capture/day, rather than just the displayed ten. Only completed UTC days newer than the archive end are appended. The in-progress UTC day is excluded. Existing historical frames are never revised by the updater. Repeated runs do not duplicate observations or add counts together. Normalized duplicate hashtags use their maximum observed count.

This is the sample selected by one Mastodon server's current trending list, with its recent daily history; it is not a global top ten or an exhaustive measure of Mastodon activity. Tags that disappear from the trends endpoint are not measured zeros. Retrospective buckets reflect the vocabulary trending at capture time. The source is distinct from historical evidence; momentum resets at that boundary and after gaps. First-seen dates retain earlier captured evidence, including candidates from prior daily runs, but do not imply invention dates.

The updater captures a rolling week, so it can recover a few missed dates. A longer outage can leave a gap, which remains a gap rather than fabricated observations. `data/live/status.json` reports when the latest available date is older than the last completed UTC day. A successful request may legitimately have no new usable observations.

## Storage and recovery

- `data/live/captures/`: timestamped raw responses and URL, acquisition time, SHA-256 metadata. The hash in each signal's evidence ID identifies its capture.
- `data/live/frames.json`: durable daily extension and candidate first-seen dates. Historical rebuilds merge this extension afterward, so `pnpm data:build` retains new days beyond the rebuilt archive end. Rebuilt historical evidence takes priority on overlapping dates.
- `data/live/historical-baseline.json`: one backup of the public archive before the first daily append.
- `static/data/history.sha256`: checksum of the published JSON.
- `data/timeline-summary.json`: updated coverage summary.

A lock prevents concurrent daily updaters. The ledger is written first and JSON files are replaced atomically, so a rerun repairs an interruption between ledger and public JSON writes. After a process crash, investigate the PID in `data/live/update.lock` before removing a stale lock. Do not run the historical compiler concurrently with the daily updater. Never discard the daily ledger or captures when deploying or rebuilding.

The daily schedule now runs in GitHub Actions, independently of this computer. See [GitHub updates](github-updates.md) for the public repository, schedule and verified activation. The previous local Codex automation has been removed. The browser checks GitHub on visits and periodically while open; its default source is the public repository. Deploy the updated application once to activate that loader on a hosted site. Subsequent daily JSON updates do not require a site redeployment. Manual local updates remain available with `pnpm data:update`; avoid publishing a divergent local archive over newer remote data.
