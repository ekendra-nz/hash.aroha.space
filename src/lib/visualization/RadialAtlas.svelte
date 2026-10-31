<script lang="ts">
  import { onMount } from 'svelte';
  import {
    placeSignals,
    placeLinearSignals,
    moveSignal,
    type VisualPosition,
    type MovingSignal,
    type PlacedSignal,
  } from './motion';
  let {
    signals,
    selected,
    onselect,
    reduced = false,
    drift = 0,
    mode = 'radial',
  }: {
    signals: MovingSignal[];
    selected: string | null;
    onselect: (tag: string) => void;
    reduced?: boolean;
    drift?: number;
    mode?: 'radial' | 'linear';
  } = $props();
  let width = $state(1000),
    height = $state(600),
    layout = $state.raw<PlacedSignal[]>([]);
  const worldWidth = $derived(mode === 'linear' ? Math.max(960, width) : width);
  const worldHeight = $derived(
    Math.max(120, height - (mode === 'linear' ? 66 : 0)),
  );
  const positions = new Map<string, VisualPosition>();
  const oldest = $derived(
    Math.max(0, ...signals.filter((s) => !s.exiting).map((s) => s.ageDays)),
  );
  const ageLabel = (days: number) =>
    days >= 365
      ? `${(days / 365.25).toFixed(1)} years`
      : `${Math.round(days)} days`;
  function labelSize(tag: string, radius: number) {
    const units = [...tag].reduce(
      (sum, letter) => sum + (letter.codePointAt(0)! > 0x2e80 ? 1 : 0.58),
      0,
    );
    return Math.max(9, Math.min(17, (radius * 1.65) / Math.max(1, units)));
  }
  onMount(() => {
    let frame: number,
      last = performance.now();
    function animate(now: number) {
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      const targets =
          mode === 'linear'
            ? placeLinearSignals(signals, worldWidth, worldHeight)
            : placeSignals(
                signals,
                worldWidth,
                worldHeight,
                reduced ? 0 : drift,
              ),
        active = new Set(targets.map((n) => n.tag));
      layout = targets.map((n) => {
        const { state, node } = moveSignal(
          n,
          positions.get(n.tag),
          dt,
          worldHeight,
          reduced,
        );
        positions.set(n.tag, state);
        return node;
      });
      for (const tag of positions.keys())
        if (!active.has(tag)) positions.delete(tag);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div
  class="radial-viewport"
  class:linear={mode === 'linear'}
  bind:clientWidth={width}
  bind:clientHeight={height}
>
  {#if mode === 'linear'}
    <div class="linear-age-labels" aria-label="Age direction">
      <span>NEWER</span>
      <span>AGE SINCE FIRST SEEN →</span>
      <span>OLDER</span>
    </div>
  {/if}
  <div class="canvas-scroll">
    <svg
      viewBox={`0 0 ${worldWidth} ${worldHeight}`}
      style:width={mode === 'linear' ? `${worldWidth}px` : '100%'}
      style:height={`${worldHeight}px`}
      role="img"
      aria-label={mode === 'linear'
        ? 'Connected age timeline: newer hashtags left, older hashtags right. Circle area shows frequency share and glow shows momentum.'
        : 'Radial map. Circle area shows frequency share; distance shows relative age; brightness shows momentum.'}
    >
      <defs
        ><radialGradient id="atlas-field"
          ><stop stop-color="#173039" stop-opacity=".65" /><stop
            offset="1"
            stop-color="#0a181e"
            stop-opacity="0"
          /></radialGradient
        ></defs
      >
      {#if mode === 'radial'}
        <ellipse
          cx={width / 2}
          cy={height / 2 - 12}
          rx={Math.max(1, width / 2 - 25)}
          ry={Math.max(1, height / 2 - 25)}
          fill="url(#atlas-field)"
        />
        {#each [0.3, 0.65, 1] as fraction}<ellipse
            cx={width / 2}
            cy={height / 2 - 12}
            rx={Math.max(1, width / 2 - 92) * fraction}
            ry={Math.max(1, height / 2 - 80) * fraction}
            fill="none"
            stroke="#29414b"
            stroke-opacity=".6"
            stroke-dasharray={fraction === 1 ? '2 7' : 'none'}
          />{/each}
        <circle cx={width / 2} cy={height / 2 - 12} r="3" fill="#b6cacb" />
        <text x={width / 2} y={height - 8} text-anchor="middle" class="age-note"
          >OLDER TOWARD THE EDGE · {ageLabel(oldest)} OLDEST IN VIEW</text
        >
      {:else}
        <line
          x1="40"
          x2={worldWidth - 40}
          y1={worldHeight / 2 - 15}
          y2={worldHeight / 2 - 15}
          stroke="#91a8b6"
          stroke-opacity=".55"
          stroke-width="1.5"
        />
      {/if}
      {#each layout as signal (signal.tag)}
        {@const tagSize = labelSize(signal.tag, signal.r)}
        <g
          class="signal"
          class:chosen={selected === signal.tag}
          style:--signal={signal.color}
          opacity={signal.opacity}
          style:pointer-events={signal.exiting ? 'none' : 'auto'}
          role="button"
          tabindex={signal.exiting ? -1 : 0}
          aria-label={`Inspect ${signal.tag}`}
          onclick={() => onselect(signal.tag)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onselect(signal.tag);
            }
          }}
        >
          <title
            >{signal.tag} · {(signal.share * 100).toFixed(1)}% · {ageLabel(
              signal.ageDays,
            )} since first seen</title
          >
          {#if mode === 'radial'}
            <line
              x1={width / 2}
              y1={height / 2 - 12}
              x2={signal.x}
              y2={signal.y}
              stroke={signal.color}
              stroke-opacity=".12"
            />
          {/if}
          <g
            transform={`translate(${signal.x},${signal.y - signal.momentum * 8})`}
          >
            <circle
              r={signal.r + 12}
              fill={signal.color}
              opacity={0.025 + signal.glow * 0.32}
              style:filter={`blur(${6 + signal.glow * 15}px)`}
            />
            <circle
              r={signal.r + 4}
              fill="none"
              stroke={signal.color}
              stroke-width={0.8 + signal.glow * 3}
              opacity={0.2 + signal.glow * 0.5}
            />
            <circle
              r={signal.r}
              fill="#10232c"
              stroke={signal.color}
              stroke-width="1.2"
            />
            <circle
              r={signal.r}
              fill={signal.color}
              opacity={0.16 + signal.glow * 0.35}
            />
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              y="0"
              class="tag"
              style:font-size={`${tagSize}px`}>{signal.tag}</text
            >
            {#if signal.r >= 38 && tagSize >= 11}
              <text
                text-anchor="middle"
                y={tagSize / 2 + 15}
                class="node-value"
                style:font-size={`${Math.min(12, tagSize * 0.75)}px`}
              >
                {(signal.share * 100).toFixed(1)}%
              </text>
            {/if}
          </g>
          <text
            x={signal.x}
            y={signal.y + signal.r + 19}
            text-anchor="middle"
            class="trend"
            >{signal.momentum > 0.035
              ? '↗'
              : signal.momentum < -0.035
                ? '↘'
                : '→'}
            {ageLabel(signal.ageDays)}</text
          >
        </g>
      {/each}
    </svg>
  </div>
</div>

<style>
  .radial-viewport {
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .canvas-scroll {
    height: 100%;
  }
  .linear .canvas-scroll {
    height: calc(100% - 48px);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }
  .linear-age-labels {
    height: 48px;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: 0 clamp(8px, 2vw, 32px);
    color: #a8bdc5;
    font: 500 clamp(11px, 1.1vw, 14px) / 1.4 monospace;
    letter-spacing: 0.06em;
  }
  .linear-age-labels span:nth-child(2) {
    text-align: center;
  }
  .linear-age-labels span:last-child {
    text-align: right;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .age-note {
    fill: #6e8b96;
    font: 8px monospace;
    letter-spacing: 1.2px;
  }
  .signal {
    cursor: pointer;
    outline: none;
  }
  .signal:focus .tag,
  .chosen .tag {
    text-decoration: underline;
    fill: white !important;
  }
  .tag {
    font: 12px system-ui;
    font-weight: 600;
    fill: #f0f2ee;
    pointer-events: none;
    paint-order: stroke;
    stroke: #09171c;
    stroke-width: 2px;
    stroke-linejoin: round;
  }
  .trend {
    fill: #8198a4;
    font: 8px monospace;
  }
  .node-value {
    fill: #b5c8cc;
    font-family: monospace;
    font-weight: 500;
    pointer-events: none;
  }
  .chosen circle {
    stroke-width: 2px;
  }
  @media (max-width: 600px) {
    .tag {
      font-size: 10px;
    }
    .trend {
      font-size: 7px;
    }
    .age-note {
      font-size: 7px;
      letter-spacing: 0.4px;
    }
  }
</style>
