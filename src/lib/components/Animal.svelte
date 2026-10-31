<script lang="ts">
  let { kind = 'fox' }: { kind?: string } = $props();
</script>

<svg
  viewBox="0 0 40 40"
  fill="none"
  stroke="currentColor"
  stroke-width="1.65"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === 'bird'}<path
      d="M7 27c1-11 6-17 13-12 3-10 13-7 12 0l5 4-6 2c-2 11-14 14-24 6Z"
    /><path d="m11 24 11-5-5 10M22 32l-2 4m7-6 1 5" /><circle
      cx="27"
      cy="14"
      r="1"
      fill="currentColor"
    />
  {:else if kind === 'rabbit'}<path
      d="M13 19C0-5 16-5 17 17M23 17C25-7 38 0 28 21M11 21c-7 17 25 19 20 1-3-9-17-9-20-1Z"
    /><path d="m17 26 3 3 3-3m-3 3v3" /><circle cx="14" cy="24" r="1" /><circle
      cx="26"
      cy="24"
      r="1"
    />
  {:else if kind === 'owl'}<path
      d="m8 8 10 4h4l10-4-2 10c9 25-28 25-20 0Z"
    /><circle cx="14" cy="21" r="6" /><circle cx="26" cy="21" r="6" /><path
      d="m18 26 2 4 2-4M14 34l-2 3m14-3 2 3"
    /><circle cx="14" cy="21" r="1" /><circle cx="26" cy="21" r="1" />
  {:else if kind === 'bear'}<circle cx="10" cy="11" r="6" /><circle
      cx="30"
      cy="11"
      r="6"
    /><path d="M7 19c0-17 26-17 26 0v6c0 15-26 15-26 0Z" /><ellipse
      cx="20"
      cy="27"
      rx="7"
      ry="5"
    /><path d="m18 25 2 2 2-2m-2 2v4" /><circle cx="13" cy="20" r="1" /><circle
      cx="27"
      cy="20"
      r="1"
    />
  {:else}<path d="m7 4 12 8h3L34 4l-2 21-12 12L8 25Z" /><path
      d={kind === 'cat'
        ? 'M8 21h7m10 0h7M5 27l10 1m10 0 10-1M18 29l2 2 2-2'
        : 'm8 18 10 10m14-10L22 28M16 30l4 3 4-3'}
    /><path d="m12 19 3 2m13-2-3 2" />{/if}</svg
>
