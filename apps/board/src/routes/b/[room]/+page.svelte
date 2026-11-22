<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Board, COLORS, type NoteColor, type Peer } from '#lib/board.svelte.ts';
  import Cursor from '#lib/components/Cursor.svelte';
  import Note from '#lib/components/Note.svelte';
  import { initials, loadIdentity, saveIdentity, type Identity } from '#lib/identity.ts';
  import { layoutClusters, NOTE_H, NOTE_W } from '#lib/layout.ts';
  import { RETRO_NOTES, scatter } from '#lib/seed.ts';
  import type { TidyResponse } from '../../api/tidy/+server';

  let { data } = $props();

  const board = new Board();
  let me = $state<Identity>({ name: '', color: '#6b4dff' });
  let viewport = $state<HTMLDivElement>();
  let cam = $state({ x: -600, y: -400, z: 1 });
  let selected = $state<string | null>(null);
  let editRequest = $state<string | null>(null);
  let tidying = $state(false);
  let toast = $state<{ text: string; undo?: boolean } | null>(null);
  let renaming = $state(false);
  let nextColor = $state<NoteColor>('lemon');

  const peersWithCursor = $derived(
    board.peers.filter((p): p is Peer & { cursor: { x: number; y: number } } => !!p.cursor),
  );
  const peerOn = (id: string) => board.peers.find((p) => p.dragging === id || p.editing === id) ?? null;
  const busyPeer = $derived(board.peers.find((p) => p.busy));

  onMount(() => {
    me = loadIdentity();
    board.connect(data.room, me);
    return () => board.destroy();
  });
  $effect(() => {
    if (board.synced) queueMicrotask(firstSync);
  });

  let didFirstSync = false;
  function firstSync() {
    if (didFirstSync) return;
    didFirstSync = true;
    if (data.seed)
      board.seedOnce(() => {
        const spots = scatter(RETRO_NOTES.length, 0, 0);
        RETRO_NOTES.forEach((text, i) =>
          board.addNote({ ...spots[i]!, text, color: COLORS[i % COLORS.length], author: 'Huddle' }),
        );
        board.setTitle('Sprint 42 retro');
      });
    requestAnimationFrame(() => fit(false));
  }

  // ─── Camera ───────────────────────────────────────────────────────────────────────────
  const rect = () => viewport!.getBoundingClientRect();
  function toWorld(cx: number, cy: number) {
    const r = rect();
    return { x: (cx - r.left) / cam.z + cam.x, y: (cy - r.top) / cam.z + cam.y };
  }
  function zoomAt(cx: number, cy: number, factor: number) {
    const before = toWorld(cx, cy);
    const z = Math.min(2.5, Math.max(0.15, cam.z * factor));
    const r = rect();
    cam = { z, x: before.x - (cx - r.left) / z, y: before.y - (cy - r.top) / z };
  }
  let camAnim = 0;
  function animateCam(to: typeof cam) {
    cancelAnimationFrame(camAnim);
    const from = { ...cam };
    const t0 = performance.now();
    const stepFn = (t: number) => {
      const k = Math.min(1, (t - t0) / 550);
      const e = 1 - (1 - k) ** 3;
      cam = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z: from.z + (to.z - from.z) * e };
      if (k < 1) camAnim = requestAnimationFrame(stepFn);
    };
    camAnim = requestAnimationFrame(stepFn);
  }
  function fit(animate = true) {
    if (!viewport) return;
    const boxes = [
      ...board.list.map((n) => ({ x: n.x, y: n.y, w: NOTE_W, h: NOTE_H })),
      ...board.frameList.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })),
    ];
    const r = rect();
    if (!boxes.length) {
      const to = { z: 1, x: -r.width / 2, y: -r.height / 2 };
      return animate ? animateCam(to) : (cam = to);
    }
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = r.width < 640 ? 24 : 80;
    const minZ = r.width < 640 ? 0.34 : 0.15;
    const z = Math.min(1.1, Math.max(minZ, Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2 - 140) / (maxY - minY))));
    const to = { z, x: (minX + maxX) / 2 - r.width / 2 / z, y: (minY + maxY) / 2 - (r.height / 2 - 10) / z };
    if (animate) animateCam(to);
    else cam = to;
  }

  // ─── Background gestures: pan, pinch, double-click to add ─────────────────────────────
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; mx: number; my: number } | null = null;
  let panStart = $state<{ x: number; y: number; cx: number; cy: number } | null>(null);

  function bgDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    viewport!.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    selected = null;
    cancelAnimationFrame(camAnim);
    if (pointers.size === 1) panStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      panStart = null;
    }
  }
  let lastCursor = 0;
  function anyMove(e: PointerEvent) {
    const now = performance.now();
    if (now - lastCursor > 33 && e.pointerType === 'mouse') {
      lastCursor = now;
      board.presence({ cursor: toWorld(e.clientX, e.clientY) });
    }
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      zoomAt(mx, my, d / pinch.d);
      cam = { ...cam, x: cam.x - (mx - pinch.mx) / cam.z, y: cam.y - (my - pinch.my) / cam.z };
      pinch = { d, mx, my };
    } else if (panStart) {
      cam = { ...cam, x: panStart.cx - (e.clientX - panStart.x) / cam.z, y: panStart.cy - (e.clientY - panStart.y) / cam.z };
    }
  }
  function bgUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) panStart = null;
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    cancelAnimationFrame(camAnim);
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
    else cam = { ...cam, x: cam.x + e.deltaX / cam.z, y: cam.y + e.deltaY / cam.z };
  }

  function addNoteAt(wx: number, wy: number) {
    const id = board.addNote({ x: wx - NOTE_W / 2, y: wy - NOTE_H / 2, color: nextColor, author: me.name });
    nextColor = COLORS[(COLORS.indexOf(nextColor) + 1) % COLORS.length]!;
    selected = id;
    editRequest = id;
  }
  function addNoteCentre() {
    const r = rect();
    const jitter = () => (Math.random() - 0.5) * 60;
    const c = toWorld(r.left + r.width / 2 + jitter(), r.top + r.height / 2 + jitter());
    addNoteAt(c.x, c.y);
  }

  // ─── AI tidy-up ───────────────────────────────────────────────────────────────────────
  async function tidy() {
    const notes = board.list.filter((n) => n.text.trim());
    if (notes.length < 2) {
      toast = { text: 'Write on at least two notes first.' };
      return;
    }
    tidying = true;
    selected = null;
    board.presence({ busy: 'tidying up…' });
    try {
      const res = await fetch('/api/tidy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ notes: notes.map((n) => ({ id: n.id, text: n.text })) }),
      });
      const out = (await res.json()) as TidyResponse | { error: string };
      if ('error' in out) {
        toast = { text: out.error };
        return;
      }
      const cx = notes.reduce((a, n) => a + n.x, 0) / notes.length + NOTE_W / 2;
      const cy = notes.reduce((a, n) => a + n.y, 0) / notes.length + NOTE_H / 2;
      const r = rect();
      const rowWidth = r.width < 640 ? 700 : Math.max(1200, (r.width / Math.max(cam.z, 0.4)) * 1.1);
      const { frames, positions } = layoutClusters(out.groups, cx, cy, rowWidth);
      board.applyLayout(positions, frames);
      setTimeout(() => fit(), 450);
      toast = {
        text:
          out.source === 'model'
            ? `Grouped into ${out.groups.length} themes by the model.`
            : `${out.note ?? 'Grouped by keywords.'}`,
        undo: true,
      };
    } catch {
      toast = { text: 'Could not reach the server. Try again in a moment.' };
    } finally {
      tidying = false;
      board.presence({ busy: null });
    }
  }

  $effect(() => {
    if (!toast) return;
    const t = setTimeout(() => (toast = null), toast.undo ? 7000 : 3500);
    return () => clearTimeout(t);
  });

  function onKey(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement).closest('input,textarea,[contenteditable]');
    if (typing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) board.undo.redo();
      else board.undo.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      board.undo.redo();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      board.remove(selected);
      selected = null;
    } else if (e.key === 'n' && !mod) {
      e.preventDefault();
      addNoteCentre();
    } else if (e.key === 'Escape') selected = null;
    else if (e.key === '0' && !mod) fit();
  }

  async function share() {
    const url = location.origin + location.pathname;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: board.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast = { text: 'Link copied. Anyone with it can join this board.' };
      }
    } catch {
      /* cancelled */
    }
  }

  function rename(name: string) {
    const n = name.trim().slice(0, 24);
    renaming = false;
    if (!n || n === me.name) return;
    me = { ...me, name: n };
    saveIdentity(me);
    board.presence({ user: me });
  }

  const frameTint = ['#6b4dff', '#ff5da2', '#16a37f', '#f08c00', '#1c7ed6', '#c2255c', '#5f3dc4', '#2b8a3e'];
</script>

<svelte:head>
  <title>{board.title} · Huddle</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="fixed inset-0 overflow-hidden">
  <!-- Canvas -->
  <div
    bind:this={viewport}
    class="absolute inset-0 touch-none {panStart ? 'cursor-grabbing' : 'cursor-default'}"
    style:background-image="radial-gradient(var(--dot) {Math.max(1, 1.3 * cam.z)}px, transparent {Math.max(1, 1.3 * cam.z) + 0.6}px)"
    style:background-size="{28 * cam.z}px {28 * cam.z}px"
    style:background-position="{-cam.x * cam.z}px {-cam.y * cam.z}px"
    onpointerdown={bgDown}
    onpointermove={anyMove}
    onpointerup={bgUp}
    onpointercancel={bgUp}
    onpointerleave={() => board.presence({ cursor: null })}
    onwheel={wheel}
    ondblclick={(e) => {
      if (e.target !== viewport && !(e.target as HTMLElement).dataset['world']) return;
      const w = toWorld(e.clientX, e.clientY);
      addNoteAt(w.x, w.y);
    }}
    role="application"
    aria-label="Whiteboard. Double-click to add a note, drag to pan, pinch or ctrl-scroll to zoom."
    data-testid="canvas"
  >
    <div
      class="absolute left-0 top-0 origin-top-left"
      style:transform="scale({cam.z}) translate({-cam.x}px, {-cam.y}px)"
      data-world="1"
    >
      {#each board.frameList as f (f.id)}
        <div
          class="group absolute rounded-[28px] border-2 border-dashed"
          style:left="{f.x}px"
          style:top="{f.y}px"
          style:width="{f.w}px"
          style:height="{f.h}px"
          style:border-color="{frameTint[f.color % frameTint.length]}55"
          style:background="{frameTint[f.color % frameTint.length]}0d"
          in:fade={{ duration: 400, delay: 150 }}
          out:fade={{ duration: 200 }}
          data-testid="frame"
        >
          <div class="absolute bottom-full left-4 mb-2 flex origin-bottom-left items-center gap-2" style:transform="scale({Math.min(2.2, Math.max(1, 0.8 / cam.z))})">
            <span
              class="whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold text-white shadow-sm"
              style:background={frameTint[f.color % frameTint.length]}>{f.label}</span
            >
            <button
              class="rounded-full px-2 text-xs text-[var(--muted)] opacity-0 transition-opacity hover:text-[var(--ink)] group-hover:opacity-100"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={() => board.removeFrame(f.id)}
              aria-label="Remove group {f.label}">✕</button
            >
          </div>
        </div>
      {/each}

      {#each board.list as note (note.id)}
        <Note
          {note}
          {board}
          zoom={cam.z}
          selected={selected === note.id}
          peer={peerOn(note.id)}
          startEditing={editRequest === note.id}
          onedited={() => (editRequest = null)}
          onselect={(id) => (selected = id)}
        />
      {/each}

      {#each peersWithCursor as p (p.clientId)}
        <Cursor peer={p} zoom={cam.z} />
      {/each}
    </div>

    {#if board.synced && board.list.length === 0}
      <div class="pointer-events-none absolute inset-0 grid place-items-center p-6" transition:fade>
        <div class="text-center">
          <p class="font-hand text-5xl text-[var(--muted)]">An empty board.</p>
          <p class="mt-2 text-sm text-[var(--muted)]">Double-click anywhere (or press <kbd class="rounded bg-white px-1.5 font-mono">N</kbd>) to add a note.</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Top left: brand + title -->
  <div class="panel pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100vw-11rem)] items-center gap-2 rounded-2xl py-1.5 pl-2 pr-3 sm:left-4 sm:top-4">
    <a href="/" class="tool !h-8 !min-w-8 !px-1.5" aria-label="Huddle home">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3" y="5" width="17" height="17" rx="3" fill="#ffd84d" transform="rotate(-6 11 13)" />
        <rect x="12" y="11" width="17" height="17" rx="3" fill="#ff9bb3" transform="rotate(5 20 19)" />
      </svg>
    </a>
    <input
      class="min-w-0 flex-1 truncate bg-transparent text-[15px] font-semibold outline-none sm:w-56"
      value={board.title}
      aria-label="Board title"
      onchange={(e) => board.setTitle(e.currentTarget.value)}
      onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
    <span
      class="size-2 shrink-0 rounded-full {board.status === 'connected' ? 'bg-[#2fb36d]' : board.status === 'connecting' ? 'animate-pulse bg-[#f0b429]' : 'bg-[#e03131]'}"
      title={board.status}
      data-testid="status"
      data-status={board.status}
    ></span>
  </div>

  <!-- Top right: people + share -->
  <div class="panel absolute right-3 top-3 flex items-center gap-1 rounded-2xl p-1.5 sm:right-4 sm:top-4">
    <div class="flex -space-x-2 pl-1" data-testid="presence">
      {#each board.peers.slice(0, 4) as p (p.clientId)}
        <span
          class="grid size-8 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white"
          style:background={p.color}
          title={p.name}
          transition:fly={{ y: -6, duration: 200 }}>{initials(p.name)}</span
        >
      {/each}
      {#if board.peers.length > 4}
        <span class="grid size-8 place-items-center rounded-full border-2 border-white bg-[var(--ink)] text-[11px] font-bold text-white">+{board.peers.length - 4}</span>
      {/if}
      <button
        class="grid size-8 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white ring-2 ring-[var(--accent)]/30"
        style:background={me.color}
        title="You ({me.name}). Click to rename."
        onclick={() => (renaming = !renaming)}>{initials(me.name || '?')}</button
      >
    </div>
    <button class="tool !h-8" onclick={share}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>
      <span class="hidden sm:inline">Share</span>
    </button>
    {#if renaming}
      <form
        class="panel absolute right-0 top-12 w-60 rounded-2xl p-3"
        transition:fly={{ y: -6, duration: 150 }}
        onsubmit={(e) => {
          e.preventDefault();
          rename(new FormData(e.currentTarget).get('name') as string);
        }}
      >
        <label class="text-xs font-medium text-[var(--muted)]" for="name">Your name on this board</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input id="name" name="name" autofocus value={me.name} maxlength="24" class="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]" />
      </form>
    {/if}
  </div>

  <!-- Bottom toolbar -->
  <div class="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center px-3">
    <div class="panel flex items-center gap-1 rounded-2xl p-1.5" role="toolbar" aria-label="Board tools">
      <button class="tool" onclick={addNoteCentre} title="New note (N)">
        <span class="note-{nextColor} size-4 rounded-[3px] shadow-sm" style:background="var(--note)"></span>
        <span>Note</span>
      </button>
      <button class="tool magic relative overflow-hidden !px-4" onclick={tidy} disabled={tidying || board.list.length < 2} data-testid="tidy">
        {#if tidying}<span class="thinking absolute inset-0"></span>{/if}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 2 2 .7-2 .7L5 20.4l-.7-2-2-.7 2-.7z" /></svg>
        {tidying ? 'Tidying…' : 'Tidy up'}
      </button>
      <span class="mx-1 h-6 w-px bg-[var(--line)]"></span>
      <button class="tool" onclick={() => board.undo.undo()} disabled={!board.canUndo} aria-label="Undo" title="Undo (⌘Z)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
      </button>
      <button class="tool hidden sm:inline-flex" onclick={() => board.undo.redo()} disabled={!board.canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
      </button>
      <button class="tool font-mono text-xs tabular-nums" onclick={() => fit()} title="Fit to screen (0)" aria-label="Fit to screen">
        {Math.round(cam.z * 100)}%
      </button>
    </div>
  </div>

  {#if busyPeer}
    <div class="panel absolute left-1/2 top-16 -translate-x-1/2 rounded-full px-3 py-1.5 text-sm sm:top-5" transition:fly={{ y: -8 }}>
      <span class="font-semibold" style:color={busyPeer.color}>{busyPeer.name}</span> is {busyPeer.busy}
    </div>
  {/if}

  {#if toast}
    <div
      class="absolute inset-x-0 bottom-24 flex justify-center px-3"
      transition:fly={{ y: 12, duration: 200 }}
      role="status"
    >
      <div class="flex items-center gap-3 rounded-2xl bg-[var(--ink)] py-2.5 pl-4 pr-2 text-sm text-white shadow-xl" data-testid="toast">
        <span>{toast.text}</span>
        {#if toast.undo}
          <button
            class="rounded-xl bg-white/15 px-3 py-1 font-medium hover:bg-white/25"
            onclick={() => {
              board.undo.undo();
              toast = null;
              setTimeout(() => fit(), 400);
            }}>Undo</button
          >
        {/if}
      </div>
    </div>
  {/if}
</div>
