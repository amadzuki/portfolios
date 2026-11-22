<script lang="ts">
  import { untrack } from 'svelte';
  import { Spring } from 'svelte/motion';
  import type { Peer } from '../board.svelte';

  let { peer, zoom }: { peer: Peer & { cursor: { x: number; y: number } }; zoom: number } = $props();
  // Cursor updates arrive ~30 times a second; a spring makes them look 60fps-smooth.
  const pos = new Spring(untrack(() => ({ ...peer.cursor })), { stiffness: 0.3, damping: 0.8 });
  $effect(() => {
    pos.target = { ...peer.cursor };
  });
</script>

<div
  class="pointer-events-none absolute left-0 top-0 z-[200000]"
  style:transform="translate({pos.current.x}px, {pos.current.y}px) scale({1 / zoom})"
  style:transform-origin="0 0"
  aria-hidden="true"
>
  <svg width="22" height="22" viewBox="0 0 24 24" class="drop-shadow-[0_2px_3px_rgba(0,0,0,.25)]">
    <path d="M3 2 L20 11 L12 13 L9 21 Z" fill={peer.color} stroke="white" stroke-width="1.6" stroke-linejoin="round" />
  </svg>
  <span
    class="absolute left-4 top-5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-md"
    style:background={peer.color}
  >
    {peer.name}{peer.busy ? ` · ${peer.busy}` : ''}
  </span>
</div>
