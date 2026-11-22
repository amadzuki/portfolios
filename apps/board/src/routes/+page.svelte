<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';

  // A looping demo: a messy board, a cursor hits "Tidy up", notes glide into themes.
  const demo = [
    { t: 'Deploys are slow', c: 'peach', a: [8, 14, -6], b: [4, 18, -1] },
    { t: 'Flaky CI again', c: 'rose', a: [58, 6, 5], b: [4, 42, 1] },
    { t: 'Cache the pipeline', c: 'lemon', a: [30, 58, -3], b: [4, 66, -1] },
    { t: 'Too many meetings', c: 'sky', a: [70, 52, 4], b: [37, 18, 1] },
    { t: 'Async standups?', c: 'mint', a: [14, 70, 6], b: [37, 42, -1] },
    { t: 'Pairing with design ❤', c: 'lilac', a: [46, 30, -4], b: [70, 18, 1] },
    { t: 'Shipped search!', c: 'lemon', a: [78, 20, -6], b: [70, 42, -1] },
  ];
  let tidy = $state(false);
  let cursor = $state({ x: 80, y: 90 });
  let reduce = $state(false);

  onMount(() => {
    reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      tidy = true;
      return;
    }
    let alive = true;
    const loop = async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      while (alive) {
        tidy = false;
        cursor = { x: 84, y: 70 };
        await wait(1400);
        cursor = { x: 54, y: 95 };
        await wait(900);
        tidy = true;
        await wait(800);
        cursor = { x: 64, y: 62 };
        await wait(2800);
      }
    };
    loop();
    return () => (alive = false);
  });
</script>

<svelte:head>
  <title>Huddle · a multiplayer board that tidies itself</title>
  <meta
    name="description"
    content="A realtime sticky-note board. Share a link, brainstorm together, then let AI group the notes into themes."
  />
</svelte:head>

<main
  class="min-h-dvh"
  style="background-image: radial-gradient(var(--dot) 1.3px, transparent 1.9px); background-size: 28px 28px;"
>
  <div class="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:min-h-dvh lg:grid-cols-[1fr_1.1fr] lg:py-0">
    <section>
      <div class="flex items-center gap-2">
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="3" y="5" width="17" height="17" rx="3" fill="#ffd84d" transform="rotate(-6 11 13)" />
          <rect x="12" y="11" width="17" height="17" rx="3" fill="#ff9bb3" transform="rotate(5 20 19)" />
        </svg>
        <span class="text-lg font-bold tracking-tight">Huddle</span>
      </div>
      <h1 class="mt-10 text-[clamp(2.6rem,6.5vw,4.6rem)] font-extrabold leading-[0.95] tracking-[-0.035em]">
        Brainstorm together.
        <span class="bg-gradient-to-r from-[#6b4dff] via-[#ff5da2] to-[#ffb347] bg-clip-text text-transparent">Let AI tidy up.</span>
      </h1>
      <p class="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]">
        A sticky-note board that syncs live between everyone holding the link. When the board gets
        messy, one click groups the notes into themes, and everyone watches them glide into place.
      </p>

      <form method="POST" action="?/create" use:enhance class="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button class="btn text-base" data-testid="start">
          Start a board
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" name="seed" checked class="size-4 accent-[#6b4dff]" />
          Start with a messy retro
        </label>
      </form>

      <ul class="mt-10 grid max-w-md gap-2.5 text-sm text-[var(--muted)]">
        <li><b class="text-[var(--ink)]">Live.</b> Yjs CRDTs over WebSockets: cursors, drags and typing merge without conflicts.</li>
        <li><b class="text-[var(--ink)]">Undoable.</b> Every tidy-up is one step on your own undo stack.</li>
        <li><b class="text-[var(--ink)]">Works without a key.</b> No model configured? Notes are grouped by shared keywords instead.</li>
      </ul>
      <p class="mt-8 text-xs text-[var(--muted)]">
        SvelteKit · Svelte 5 runes & springs · Yjs · built by
        <a class="underline hover:text-[var(--ink)]" href="https://ahmadmarzuki.com">Ahmad Marzuki</a>
      </p>
    </section>

    <section aria-hidden="true" class="relative aspect-[5/4] w-full select-none overflow-hidden rounded-[32px] border border-[var(--line)] bg-white/50 shadow-[0_30px_80px_-40px_rgba(60,40,120,.5)]">
      {#each [{ x: 2, l: 'Delivery' }, { x: 35, l: 'Meetings' }, { x: 68, l: 'Wins' }] as f, i (f.l)}
        <div
          class="absolute top-[8%] h-[84%] w-[30%] rounded-3xl border-2 border-dashed transition-opacity duration-700"
          style:left="{f.x}%"
          style:opacity={tidy ? 1 : 0}
          style:border-color={['#6b4dff55', '#ff5da255', '#16a37f55'][i]}
          style:background={['#6b4dff0d', '#ff5da20d', '#16a37f0d'][i]}
        >
          <span class="absolute left-3 top-2 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style:background={['#6b4dff', '#ff5da2', '#16a37f'][i]}>{f.l}</span>
        </div>
      {/each}
      {#each demo as n, i (n.t)}
        {@const p = tidy ? n.b : n.a}
        <div
          class="note-{n.c} absolute w-[26%] rounded-[4px] p-[2%] shadow-[0_12px_20px_-14px_rgba(30,20,60,.5)]"
          style:background="var(--note)"
          style:aspect-ratio="4/3"
          style:left="{p[0]}%"
          style:top="{p[1]}%"
          style:transform="rotate({p[2]}deg)"
          style:transition="all 1.1s cubic-bezier(.3,1.25,.4,1) {tidy ? i * 70 : 0}ms"
        >
          <p class="font-hand text-[clamp(14px,2.2vw,22px)] leading-none text-[#2a2533]">{n.t}</p>
        </div>
      {/each}
      <div
        class="absolute transition-all duration-[900ms] ease-in-out"
        style:left="{cursor.x}%"
        style:top="{cursor.y}%"
      >
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2 L20 11 L12 13 L9 21 Z" fill="#ff5d5d" stroke="white" stroke-width="1.6" stroke-linejoin="round" /></svg>
        <span class="absolute left-4 top-5 whitespace-nowrap rounded-full bg-[#ff5d5d] px-2 py-0.5 text-xs font-semibold text-white">Ayu</span>
      </div>
      <div class="absolute bottom-[4%] left-1/2 -translate-x-1/2">
        <span class="magic inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-lg transition-transform duration-200" style:transform={tidy && cursor.y > 90 ? 'scale(.94)' : 'none'}>✦ Tidy up</span>
      </div>
    </section>
  </div>
</main>
