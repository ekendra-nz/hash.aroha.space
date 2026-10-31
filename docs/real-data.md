# Early API probe — 2026-10-28

Update: the later investigation found the publisher’s explicit offer of downloadable aggregate series. The new compiler now uses attributed aggregate exports; see [current methodology](timeline-methodology.md). This note preserves the initial probe and its then-unresolved questions.

A real, unauthenticated Storywrangler request succeeded (HTTP 200):

```sh
curl -G 'https://api.storywrangler.uvm.edu/storywrangler/term-series' \
  --data-urlencode 'domain=twitter' \
  --data-urlencode 'dataset=ngrams' \
  --data-urlencode 'type=#music' \
  --data-urlencode 'dates=2020-01-01,2020-01-07'
```

It returned seven daily records with `date`, `counts`, `rank`, and `freq`. The response reported `latest_available_date: 2023-06-01`. That is the endpoint-reported limit for this term/query, not proof of complete coverage for every hashtag. The raw response was not bundled or cached into the application.

The public registry `/registry/twitter/ngrams?full=true` identifies the owner group as `vcsi` and contact as `compstorylab@uvm.edu`. Its returned metadata did not include an explicit license or caching/redistribution grant. The legacy project's descriptions discuss downloadable aggregates, but we have not established applicable terms for this current API. No email has been sent.

## Practical integration path

1. Confirm aggregate reuse, attribution, request limits and cache duration with the data owner or an explicit license. Distinguish use in this local prototype from public deployment.
2. Fetch a bounded cohort of hashtags using the documented term-series or batch endpoint; verify requested dates, language, count definition and completeness. Keep source coverage visible.
3. Map `counts` to compatible daily observations, retaining source and platform. Do not mix `freq` and `counts`, retweet-inclusive and exclusive measures, or mismatched language slices. The UI already formats fractional frequencies without rounding them to zero.
4. Do not declare real birth dates from a narrow extraction. Import without `bornAt` for honest “first seen” age, or obtain a wider archive / separately evidenced birth dates. Missing responses are null, not zero.
5. Add a server-only provider with schema validation, timeouts, bounded concurrency and caching within the confirmed terms. Keep the deterministic offline demo as a fallback, clearly labelled.

Sources: [term-series API](https://storywrangler.uvm.edu/api-reference/storywrangler/get-storywrangler-term-series), [batch API](https://storywrangler.uvm.edu/api-reference/storywrangler/get-storywrangler-term-series-batch), [legacy project background](https://storywrangling.org/about).

`StorywranglerProvider` stays disabled until reuse terms are verified. Local CSV/JSON imports are already compatible with the lifecycle model and can carry declared birth dates or derive clearly labelled first-seen dates.
