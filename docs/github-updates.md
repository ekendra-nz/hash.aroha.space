# Public GitHub history updates

Netlify's deployed static files are immutable deployment artifacts: they cannot acquire write permissions so a visitor can append to them. Netlify supports separate writable stores such as Blobs, but this implementation uses a public GitHub repository as requested.

## Activation

1. Push this project to a **public** GitHub repository, including `.github/workflows/update-history.yml`, `static/data/history.json`, `static/data/history.sha256`, `data/live/frames.json`, existing `data/live/captures`, `scripts`, and `src/lib/data/zeitgeist.ts`. The workflow must be on the repository's default branch. Raw historical acquisition files and the baseline backup need not be published.
2. Enable Actions and allow the workflow's `contents: write` permission. Its built-in `GITHUB_TOKEN` commits the updates; no personal token belongs in the website or environment file. If branch protections prohibit bot pushes, use an approved branch/rules configuration; do not bypass protections with a personal token.
3. Run **Update hashtag history** manually from Actions once and verify the successful commit. Then it runs daily at **01:17 UTC** (14:17 NZDT / 13:17 NZST). GitHub can delay scheduled jobs; this is not a real-time feed.
4. Set Netlify's build environment variable `VITE_HISTORY_URL` to `https://raw.githubusercontent.com/OWNER/REPOSITORY/BRANCH/static/data/history.json`, substituting the real public repository and default branch. Redeploy once to apply this setting. A branch containing slashes can be used directly in this URL.
5. Once the remote workflow is confirmed healthy, retire the existing local Codex daily automation to avoid separate local and remote histories. Until activation is confirmed, the local automation remains enabled.

The browser checks the repository's small checksum file on each visit, every fifteen minutes while visible, and when returning to a tab after at least a minute. It downloads the JSON only when the checksum changes, verifies its bytes and schema, and retains the current timeline date and view. Queries reduce stale-cache reuse, but GitHub's CDN can still briefly delay visibility. An already-loaded valid history remains visible if a refresh fails. Without `VITE_HISTORY_URL`, local development reads the bundled JSON. With it configured, the app reads directly from GitHub and does not silently substitute a stale local copy.

Visitors do not write to GitHub or trigger privileged workflows. The scheduled Action collects new observations; page visits check what has been published. The data remains daily, completed-UTC-day observations from the existing Mastodon source. No source or dating assumptions change.

The Action uses Node 24 and requires no package installation for the collector. It validates the checksum and confirms the old frame prefix is unchanged before committing only the archive, summary, ledger, captures, and status. Concurrent scheduled/manual collectors are serialized; a concurrent unrelated repository push can make this run fail safely rather than force-pushing. Inspect failed Actions runs and rerun when needed. Daily status/capture commits also record successful checks with no new dates. GitHub may disable schedules in inactive public repositories after 60 days.

This workspace currently has no Git remote. Adding the files alone does not activate GitHub Actions or configure Netlify; the destination repository must be supplied and connected first.

Sources: [Netlify atomic deploys](https://docs.netlify.com/deploy/deploy-overview/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).
