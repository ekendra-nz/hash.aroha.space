<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { HTML } from '@threlte/extras';
  import { Group, MeshBasicMaterial, DoubleSide } from 'three';
  import Animal from '../components/Animal.svelte';
  import type { EcosystemEntity } from '../analytics/ecosystem';
  import { visual } from './config';
  let {
    identity,
    point,
    share,
    presence,
    position,
    selected,
    onselect,
    reduced = false,
    label = true,
  }: Pick<
    EcosystemEntity,
    'identity' | 'point' | 'share' | 'presence' | 'position'
  > & {
    selected: boolean;
    onselect: () => void;
    reduced?: boolean;
    label?: boolean;
  } = $props();
  const root = new Group();
  const mountain = new Group(),
    peak = new Group();
  const materials: MeshBasicMaterial[] = [];
  let orb = $state<MeshBasicMaterial>();
  let button: HTMLButtonElement;
  let visibility = 0;
  let scale = 0.01,
    height = 0,
    brightness = 0.4;
  useTask((delta) => {
    const p = Math.sqrt(share),
      m = point?.momentum ?? 0;
    const blend = reduced ? 1 : 1 - Math.exp(-visual.settleRate * delta);
    scale += (p * visual.shareScale - scale) * blend;
    visibility += (presence - visibility) * blend;
    root.position.x += (position[0] - root.position.x) * blend;
    root.position.y += (position[1] - root.position.y) * blend;
    root.position.z += (position[2] - root.position.z) * blend;
    root.visible = visibility > 0.005;
    height += (m * visual.momentumHeight - height) * blend;
    brightness +=
      (visual.baselineBrightness +
        Math.max(0, m) * visual.risingBrightness +
        Math.min(0, m) * visual.fallingBrightness -
        brightness) *
      blend;
    mountain.scale.setScalar(Math.max(0.001, scale * Math.sqrt(visibility)));
    peak.position.y =
      visual.peakBaseline * scale + height - (1 - visibility) * 2;
    if (orb) {
      orb.opacity = Math.min(1, 0.25 + brightness * 0.4) * visibility;
    }
    for (const material of materials)
      if (material) material.opacity = (0.16 + brightness * 0.22) * visibility;
    if (button) {
      button.style.transform = `scale(${0.55 + scale * 0.42})`;
      button.style.opacity = String(
        visibility * (0.4 + Math.min(0.6, brightness * 0.45)),
      );
      button.style.pointerEvents = visibility > 0.08 ? 'auto' : 'none';
      button.style.visibility = visibility > 0.005 ? 'visible' : 'hidden';
      button.style.filter = `drop-shadow(0 0 ${4 + brightness * 12}px ${identity.color}70)`;
    }
  });
</script>

<T is={root}>
  <T is={mountain}>
    {#each Array(visual.contours) as _, i}<T.Mesh
        rotation.x={-Math.PI / 2}
        position.y={i * 0.2}
      >
        <T.RingGeometry
          args={[1.7 - i * 0.23, 1.72 - i * 0.23, 64]}
        /><T.MeshBasicMaterial
          bind:ref={materials[i]}
          color={identity.color}
          transparent
          opacity={0.3}
          side={DoubleSide}
          depthWrite={false}
        />
      </T.Mesh>{/each}
    <T.Mesh rotation.x={-Math.PI / 2} position.y={0.01}
      ><T.CircleGeometry args={[1.72, 48]} /><T.MeshBasicMaterial
        color={identity.color}
        transparent
        opacity={selected ? 0.11 : 0.025}
        depthWrite={false}
      /></T.Mesh
    >
  </T>
  <T is={peak}
    ><T.Mesh scale={0.14}
      ><T.SphereGeometry args={[1, 12, 8]} /><T.MeshBasicMaterial
        bind:ref={orb}
        color={identity.color}
        transparent
        opacity={0.6}
      /></T.Mesh
    ><HTML center zIndexRange={[20, 1]}
      ><button
        bind:this={button}
        class:selected
        class="entity"
        style:color={identity.color}
        onclick={onselect}
        title={`${identity.tag} · ${point?.value?.toFixed(0) ?? 'No data'} ${point?.record.measurement ?? ''} · ${(point?.momentum ?? 0) > 0 ? 'Rising' : 'Falling / steady'} · momentum ${((point?.momentum ?? 0) * 100).toFixed(0)} · ${point ? new Date(point.time).toISOString().slice(0, 10) : 'Outside coverage'} · ${point?.record.source ?? ''} · ${point?.interpolated ? 'Interpolated' : (point?.record.status ?? 'Missing')}`}
        aria-label={`Inspect ${identity.tag}`}
        ><span class="animal"><Animal kind={identity.animal} /></span
        >{#if label || selected}<span class="tag">{identity.tag}</span
          >{/if}{#if selected}<span class="following">FOLLOWING</span
          >{/if}</button
      ></HTML
    ></T
  >
</T>

<style>
  .entity {
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    flex-direction: column;
    cursor: pointer;
    white-space: nowrap;
    transform-origin: center;
    transition: background 0.2s;
    padding: 5px;
    border-radius: 10px;
  }
  .entity:hover,
  .entity:focus-visible,
  .selected {
    background: #071c21cc;
    outline: 1px solid currentColor;
  }
  .animal {
    width: 33px;
    height: 33px;
    display: block;
  }
  .tag {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-shadow: 0 2px 4px #000;
  }
  .following {
    font-size: 7px;
    letter-spacing: 0.2em;
    margin-top: 5px;
  }
</style>
