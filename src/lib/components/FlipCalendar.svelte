<script lang="ts">
  let { time }: { time: number } = $props();
  let date = $derived(new Date(time));
  let parts = $derived([
    date
      .toLocaleString('en', { month: 'short', timeZone: 'UTC' })
      .toUpperCase(),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCFullYear()),
  ]);
</script>

<div class="calendar" aria-label={date.toISOString().slice(0, 10)}>
  {#each parts as part, i}<div class="unit">
      <span class="caption">{['MONTH', 'DAY', 'YEAR'][i]}</span>
      <div class="flap">
        {#key part}<span class="digit">{part}</span>{/key}<i></i><b></b>
      </div>
    </div>{/each}
</div>

<style>
  .calendar {
    display: flex;
    gap: 8px;
  }
  .unit {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }
  .caption {
    font-size: 8px;
    letter-spacing: 0.25em;
    color: #90a5a7;
  }
  .flap {
    position: relative;
    background: linear-gradient(#283338 49%, #0a1013 50%, #202b30 52%);
    box-shadow:
      0 5px 10px #0008,
      inset 0 1px #ffffff14;
    border: 1px solid #394246;
    border-radius: 5px;
    min-width: 76px;
    height: 60px;
    perspective: 250px;
    display: grid;
    place-items: center;
  }
  .digit {
    font-family: Georgia, serif;
    font-size: 35px;
    letter-spacing: 0.03em;
    color: #f3e8d2;
    text-shadow: 0 2px #000;
    animation: flip 0.38s ease-out;
    transform-origin: center;
  }
  .flap:after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: #0009;
  }
  .flap i,
  .flap b {
    position: absolute;
    top: 45%;
    height: 8px;
    width: 3px;
    background: #697477;
    z-index: 1;
    left: -2px;
  }
  .flap b {
    left: auto;
    right: -2px;
  }
  @keyframes flip {
    from {
      transform: rotateX(-75deg);
      opacity: 0.4;
    }
    to {
      transform: rotateX(0);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .digit {
      animation: none;
    }
  }
  @media (max-width: 600px) {
    .flap {
      min-width: 55px;
      height: 46px;
    }
    .digit {
      font-size: 26px;
    }
  }
</style>
