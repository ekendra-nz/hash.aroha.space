<script lang="ts">
  import { onMount } from 'svelte';
  import { historyURL, loadHistory } from '../lib/data/history-loader';
  import { SignalMotion, type MovingSignal } from '../lib/visualization/motion';
  import RadialAtlas from '../lib/visualization/RadialAtlas.svelte';
  import {
    frameAt,
    advancePosition,
    positionForDate,
    type ZeitgeistHistory,
  } from '../lib/data/zeitgeist';
  let history = $state.raw<ZeitgeistHistory | null>(null),
    position = $state(0),
    playing = $state(false),
    speed = $state(0.25),
    selected = $state<string | null>(null),
    about = $state(false),
    error = $state(''),
    reduced = $state(false);
  let presentation = $state<'radial' | 'linear'>('radial');
  const motion = new SignalMotion();
  let moving = $state.raw<MovingSignal[]>([]);
  let drift = $state(0);
  const view = $derived(history ? frameAt(history, position) : null);
  const signals = $derived(view?.signals ?? []);
  const date = $derived(new Date(view?.time ?? Date.UTC(2020, 0, 1)));
  const chosen = $derived(moving.find((s) => s.tag === selected));
  const years = $derived(
    history ? [...new Set(history.frames.map((f) => +f.date.slice(0, 4)))] : [],
  );
  const source = $derived(
    history?.sources.find(
      (s) => s.id === (chosen?.sourceId ?? signals[0]?.sourceId),
    ),
  );
  function seek(value: number) {
    if (!history || !Number.isFinite(value)) return;
    position = Math.max(0, Math.min(history.frames.length - 1, value));
    playing = false;
  }
  function play() {
    if (!history) return;
    if (position >= history.frames.length - 1) position = 0;
    playing = !playing;
  }
  function wheel(event: WheelEvent) {
    if (
      window.innerWidth <= 900 ||
      (presentation === 'linear' &&
        (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)))
    )
      return;
    event.preventDefault();
    seek(position + event.deltaY * 0.035);
  }
  const age = (days: number) =>
    days >= 365
      ? `${(days / 365.25).toFixed(1)} years`
      : `${Math.round(days)} days`;
  onMount(() => {
    const controller = new AbortController();
    let checksum: string | null = null;
    let checking = false;
    let lastCheck = 0;
    async function refreshHistory() {
      if (checking || document.hidden) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const result = await loadHistory(
          historyURL(import.meta.env.VITE_HISTORY_URL),
          checksum,
          controller.signal,
        );
        if (!result || controller.signal.aborted) return;
        const currentTime = view?.time ?? Date.UTC(2017, 9, 17);
        history = result.history;
        checksum = result.checksum;
        position = positionForDate(history, currentTime);
        error = '';
      } catch (e) {
        if (!controller.signal.aborted && !history)
          error = e instanceof Error ? e.message : 'History unavailable';
        // Keep the last validated archive during network outages or publication races.
      } finally {
        checking = false;
      }
    }
    void refreshHistory();
    const refreshTimer = window.setInterval(
      () => void refreshHistory(),
      15 * 60 * 1000,
    );
    const revisit = () => {
      if (Date.now() - lastCheck > 60000) void refreshHistory();
    };
    window.addEventListener('focus', revisit);
    document.addEventListener('visibilitychange', revisit);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    reduced = media.matches;
    const change = () => {
      reduced = media.matches;
      if (reduced) playing = false;
    };
    media.addEventListener('change', change);
    let frame: number,
      last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing && history) {
        position = advancePosition(history, position, dt, speed);
        if (position >= history.frames.length - 1) playing = false;
      }
      moving = motion.step(signals, dt, reduced);
      if (playing && !reduced) drift += dt;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      controller.abort();
      clearInterval(refreshTimer);
      window.removeEventListener('focus', revisit);
      document.removeEventListener('visibilitychange', revisit);
      cancelAnimationFrame(frame);
      media.removeEventListener('change', change);
    };
  });
</script>

<svelte:head
  ><title>The Hashtag Zeitgeist — A living atlas of attention</title><meta
    name="description"
    content="Follow ten hashtags through time in a luminous radial atlas of frequency, age and momentum."
  /></svelte:head
>
<main>
  <header>
    <div class="brand">
      <div class="eyebrow"><b>#</b> AN ATLAS OF COLLECTIVE ATTENTION</div>
      <h1>The Hashtag <em>Zeitgeist.</em></h1>
    </div>
    <div class="calendar" aria-label={date.toISOString().slice(0, 10)}>
      <span class="calendar-day">{date.getUTCDate()}</span>
      <span class="calendar-month"
        >{date.toLocaleDateString('en-NZ', {
          month: 'long',
          timeZone: 'UTC',
        })}</span
      >
      <span>{date.getUTCFullYear()}<small>HISTORICAL TIME · UTC</small></span>
    </div>
    <button class="about-button" onclick={() => (about = true)}
      >About the archive <span>↗</span></button
    >
  </header>
  <section class="workspace">
    <div class="map-column">
      <div class="presentation-tools">
        <div class="view-switch" role="group" aria-label="Presentation">
          <button
            aria-pressed={presentation === 'radial'}
            onclick={() => (presentation = 'radial')}>Radial</button
          >
          <button
            aria-pressed={presentation === 'linear'}
            onclick={() => (presentation = 'linear')}>Linear</button
          >
        </div>
        {#if presentation === 'linear'}<span class="linear-hint"
            >Newer → older <span>· scroll sideways on smaller screens</span
            ></span
          >{/if}
      </div>
      <div
        class="map"
        onwheel={wheel}
        role="region"
        aria-label="Interactive attention map"
      >
        {#if history && view}<RadialAtlas
            mode={presentation}
            signals={moving}
            {drift}
            {selected}
            {reduced}
            onselect={(tag) => (selected = selected === tag ? null : tag)}
          />{:else}<div class="loading" role="status">
            {error || 'Gathering the threads of history…'}
          </div>{/if}
      </div>
      <div class="legend">
        <span><i class="size-key"></i> Area <b>frequency share</b></span><span
          ><i class="age-key"></i>
          {presentation === 'radial' ? 'Distance' : 'Left → right'}
          <b>relative age</b></span
        ><span><i class="glow-key"></i> Glow & lift <b>momentum</b></span>
      </div>
    </div>
    <aside>
      <div class="ranking-heading">
        <span class="eyebrow">THE TEN IN FOCUS</span><span>SHARE</span>
      </div>
      <p class="aside-note">The strongest signals in the compiled archive.</p>
      <div
        class="rankings"
        style:height={`${Math.max(10, signals.length) * 40}px`}
      >
        {#each moving as signal (signal.tag)}<button
            class="rank-row"
            class:active={selected === signal.tag}
            style:transform={`translateY(${signal.order * 40}px)`}
            style:opacity={signal.opacity}
            style:z-index={20 - signal.rank}
            style:pointer-events={signal.exiting ? 'none' : 'auto'}
            tabindex={signal.exiting ? -1 : 0}
            onclick={() =>
              (selected = selected === signal.tag ? null : signal.tag)}
          >
            <span class="rank">{String(signal.rank).padStart(2, '0')}</span
            ><span class="rank-body"
              ><span class="tag-name">{signal.tag}</span><span class="bar"
                ><i
                  style:width={`${(signal.share / Math.max(0.001, ...moving.filter((s) => !s.exiting).map((s) => s.share))) * 100}%`}
                  style:background={signal.color}
                  class:rising={signal.momentum > 0.035}
                  class:falling={signal.momentum < -0.035}
                ></i></span
              ></span
            ><span class="share"
              >{(signal.share * 100).toFixed(1)}<small>%</small></span
            >
          </button>{/each}
      </div>
      <div class="insight">
        {#if chosen}<span class="eyebrow">FOLLOWING {chosen.tag}</span>
          <div class="insight-metrics">
            <div>
              <strong>{age(chosen.ageDays)}</strong><small
                >SINCE FIRST SEEN</small
              >
            </div>
            <div>
              <strong class:positive={chosen.momentum > 0}
                >{chosen.momentum > 0 ? '+' : ''}{(
                  chosen.momentum * 100
                ).toFixed(0)}</strong
              ><small>MOMENTUM INDEX</small>
            </div>
          </div>
        {:else}<span class="eyebrow">AGE IN PERSPECTIVE</span>
          <p>
            {presentation === 'radial'
              ? 'Younger near the center. Older toward the edge. The scale follows the ten in view.'
              : 'Newer on the left. Older on the right. Circles settle on the line. Departing signals drop away; returning signals enter above their age position.'}
          </p>
          <small>Select a signal to follow its story.</small>{/if}
      </div>
    </aside>
  </section>
  <footer>
    <div class="transport">
      <div class="play-controls">
        <button
          class="play"
          onclick={play}
          disabled={!history}
          aria-label={playing ? 'Pause timeline' : 'Play timeline forward'}
          >{playing ? 'Ⅱ' : '▶'}</button
        ><button
          class="restart"
          onclick={() => seek(0)}
          aria-label="Restart timeline">↺</button
        ><select aria-label="Playback speed" bind:value={speed}
          ><option value={0.125}>1 day / 8 sec · slow</option><option
            value={0.25}>1 day / 4 sec · gentle</option
          ><option value={1}>1 day / sec</option><option value={1.75}
            >1 week / 4 sec</option
          ><option value={7}>1 week / sec · fast</option><option value={30}
            >1 month / sec · skim</option
          ></select
        ><span class="play-state">{playing ? 'PLAYING FORWARD' : 'PAUSED'}</span
        >
      </div>
      <label class="date-jump"
        >JUMP TO <input
          aria-label="Jump to date"
          type="date"
          value={date.toISOString().slice(0, 10)}
          min={history?.coverage.start}
          max={history?.coverage.end}
          onchange={(e) => {
            if (history)
              seek(positionForDate(history, Date.parse(e.currentTarget.value)));
          }}
        /></label
      >
    </div>
    <input
      class="timeline"
      aria-label="Timeline"
      type="range"
      min="0"
      max={Math.max(1, (history?.frames.length ?? 1) - 1)}
      step=".01"
      value={position}
      disabled={!history}
      oninput={(e) => seek(+e.currentTarget.value)}
      style:--progress={`${(position / Math.max(1, (history?.frames.length ?? 1) - 1)) * 100}%`}
    />
    <div class="years">
      {#each years.filter((year, i) => i === 0 || year % 2 === 0) as year}<button
          style:left={`${history ? (positionForDate(history, Date.UTC(year, 0, 1)) / (history.frames.length - 1)) * 100 : 0}%`}
          onclick={() =>
            history && seek(positionForDate(history, Date.UTC(year, 0, 1)))}
          >{year}</button
        >{/each}
    </div>
    <div class="footer-note">
      <span>Ten signals · relative frequency within the archive</span><span
        >{history?.coverage.start.slice(0, 4) ??
          '…'}—{history?.coverage.end.slice(0, 4) ?? '…'} <b> / </b> THE HASHTAG ZEITGEIST</span
      >
    </div>
  </footer>
  {#if about}<div
      class="modal-backdrop"
      role="presentation"
      onclick={(e) => {
        if (e.target === e.currentTarget) about = false;
      }}
    >
      <div
        class="about"
        role="dialog"
        aria-modal="true"
        aria-label="About the archive"
        tabindex="-1"
      >
        <button
          class="close"
          aria-label="Close about"
          onclick={() => (about = false)}>×</button
        ><span class="eyebrow">ONE HISTORY · TRACEABLE EVIDENCE</span>
        <h2>The shape of collective attention.</h2>
        <p>
          Ten hashtags are shown at a time, ranked within our compiled
          observations. Circle area and bars show relative frequency share;
          radial distance compares their ages since first seen. Brightness and
          lift reveal momentum.
        </p>
        <p>
          Short gaps blend smoothly. Long breaks move between the available
          observations without inventing years of activity. The date follows the
          archived history; playback always starts forward.
        </p>
        <p>
          These are the strongest tags in our captured vocabulary, not a
          certified global top ten. Different platforms measure different
          populations. The compiler chooses one evidence family per day and
          retains provenance instead of adding overlapping counts.
        </p>
        {#each history?.methodology ?? [] as note}<p>{note}</p>{/each}<a
          href="/data/history.json"
          download>Download the single timeline JSON ↧</a
        >
        <h3>Evidence behind the timeline</h3>
        {#each history?.sources ?? [] as item}<p>
            <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a
            ><br /><small>{item.attribution}<br />{item.reuse}</small>
          </p>{/each}
        <p class="source-note">
          Current day: {source?.name ?? '—'}. {history?.coverage.observedDays.toLocaleString()}
          archived days. {history?.coverage.limitations.join(' ')}
        </p>
      </div>
    </div>{/if}
</main>
