<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls, HTML } from '@threlte/extras';
  import { DoubleSide } from 'three';
  import Entity from './Entity.svelte';
  import type { EcosystemEntity } from '../analytics/ecosystem';
  import { ageRadius } from '../analytics/ecosystem';
  let {
    entities,
    selected,
    onselect,
    reduced,
    reset,
    ageYears = 7,
  }: {
    entities: EcosystemEntity[];
    selected: string | null;
    onselect: (id: string) => void;
    reduced: boolean;
    reset: number;
    ageYears?: number;
  } = $props();
  const labeled = $derived.by(() => {
    const accepted: EcosystemEntity[] = [];
    for (const entity of [...entities]
      .filter((e) => e.presence > 0.08)
      .sort((a, b) => b.share - a.share)) {
      if (accepted.length >= 24) break;
      if (
        accepted.every(
          (other) =>
            Math.hypot(
              entity.position[0] - other.position[0],
              entity.position[2] - other.position[2],
            ) > 2.6,
        )
      )
        accepted.push(entity);
    }
    return new Set(accepted.map((e) => e.identity.id));
  });
</script>

{#key reset}<T.PerspectiveCamera makeDefault position={[0, 30, 24]} fov={48}
    ><OrbitControls
      target={[0, -1, 0]}
      enableZoom={false}
      enablePan={false}
      minPolarAngle={0.3}
      maxPolarAngle={1.05}
      minAzimuthAngle={-0.6}
      maxAzimuthAngle={0.6}
      enableDamping
    /></T.PerspectiveCamera
  >{/key}
<T.Color attach="background" args={['#061217']} /><T.Fog
  attach="fog"
  args={['#061217', 38, 85]}
/>
<T.AmbientLight intensity={1.4} /><T.DirectionalLight
  position={[0, 20, 10]}
  intensity={2}
  color="#91d8d2"
/>
<T.Mesh position={[0, -29, 0]}
  ><T.SphereGeometry
    args={[29, 80, 40, 0, Math.PI * 2, 0, 0.65]}
  /><T.MeshStandardMaterial
    color="#102c31"
    roughness={0.95}
    metalness={0.3}
    side={DoubleSide}
  /></T.Mesh
>
<T.Mesh position={[0, -29.02, 0]}
  ><T.SphereGeometry
    args={[29.05, 48, 24, 0, Math.PI * 2, 0, 0.65]}
  /><T.MeshBasicMaterial
    color="#4d8d8b"
    wireframe
    transparent
    opacity={0.09}
  /></T.Mesh
>
<!-- Age guide rings sit exactly above the spherical surface. -->
{#each [ageYears / 7, (ageYears * 3) / 7, ageYears, ageYears * 2] as year}
  {@const r = ageRadius(year * 365.25, ageYears)}
  <T.Group position.y={Math.sqrt(29 ** 2 - r ** 2) - 29 + 0.03}>
    <T.Mesh rotation.x={-Math.PI / 2}
      ><T.RingGeometry args={[r, r + 0.025, 128]} /><T.MeshBasicMaterial
        color="#73a6a1"
        transparent
        opacity={0.28}
        side={DoubleSide}
      /></T.Mesh
    >
    <T.Group position={[0, 0.05, -r]}
      ><HTML center pointerEvents="none" zIndexRange={[1, 0]}
        ><span class="age-guide"
          >{year >= 1
            ? `${year.toFixed(1)}Y`
            : `${Math.round(year * 365.25)}D`}</span
        ></HTML
      ></T.Group
    >
  </T.Group>
{/each}
<T.Group position={[0, 0.12, 0]}>
  <T.Mesh rotation.x={-Math.PI / 2}
    ><T.RingGeometry args={[0.35, 0.4, 64]} /><T.MeshBasicMaterial
      color="#c8ffe7"
      transparent
      opacity={0.85}
      side={DoubleSide}
    /></T.Mesh
  >
  <T.Mesh
    ><T.SphereGeometry args={[0.13, 16, 12]} /><T.MeshBasicMaterial
      color="#c8ffe7"
    /></T.Mesh
  >
  <HTML center pointerEvents="none" zIndexRange={[1, 0]}
    ><span class="origin">ORIGIN<br /><small>NEW SIGNALS</small></span></HTML
  >
</T.Group>
{#each entities as entity, i (entity.identity.id)}<Entity
    {...entity}
    selected={selected === entity.identity.id}
    onselect={() => onselect(entity.identity.id)}
    {reduced}
    label={labeled.has(entity.identity.id)}
  />{/each}

<style>
  .age-guide {
    font: 9px monospace;
    letter-spacing: 0.15em;
    color: #8babaa;
  }
  .origin {
    display: block;
    transform: translateY(28px);
    text-align: center;
    font: 9px monospace;
    letter-spacing: 0.2em;
    color: #bcebd4;
    white-space: nowrap;
  }
  .origin small {
    font-size: 6px;
    color: #7da99e;
  }
</style>
