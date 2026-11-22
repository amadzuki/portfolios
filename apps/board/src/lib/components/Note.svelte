<script lang="ts">
  import { Spring } from 'svelte/motion';
  import { tick, untrack } from 'svelte';
  import type * as Y from 'yjs';
  import { COLORS, type Board, type NoteView, type Peer } from '../board.svelte';
  import { NOTE_H, NOTE_W } from '../layout';

  interface Props {
    note: NoteView;
    board: Board;
    zoom: number;
    selected: boolean;
    /** Someone else currently dragging or typing in this note. */
    peer: Peer | null;
    onselect: (id: string | null) => void;
    /** Open the editor right away (a freshly created note). */
    startEditing?: boolean;
    onedited?: () => void;
  }
  let { note, board, zoom, selected, peer, onselect, startEditing = false, onedited }: Props = $props();

  // Remote moves and "Tidy up" glide on a spring; our own drags are instant.
  const pos = new Spring(untrack(() => ({ x: note.x, y: note.y })), { stiffness: 0.12, damping: 0.62 });
  let dragging = $state(false);
  let editing = $state(false);
  let draft = $state('');
  let area = $state<HTMLTextAreaElement>();

  $effect(() => {
    const target = { x: note.x, y: note.y };
    if (!dragging) pos.target = target;
  });

  // ─── Drag vs tap ──────────────────────────────────────────────────────────────────────
  let start: { px: number; py: number; x: number; y: number; moved: boolean; id: number } | null = null;
  let frame = 0;

  function down(e: PointerEvent) {
    if (editing || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start = { px: e.clientX, py: e.clientY, x: pos.current.x, y: pos.current.y, moved: false, id: e.pointerId };
  }
  function move(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return;
    const dx = (e.clientX - start.px) / zoom;
    const dy = (e.clientY - start.py) / zoom;
    if (!start.moved && Math.hypot(dx, dy) * zoom < 4) return;
    if (!start.moved) {
      start.moved = true;
      dragging = true;
      board.raise(note.id);
      board.presence({ dragging: note.id });
      onselect(note.id);
    }
    const p = { x: start.x + dx, y: start.y + dy };
    pos.set(p, { instant: true });
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => board.move(note.id, p.x, p.y));
  }
  function up(e: PointerEvent) {
    if (!start || e.pointerId !== start.id) return;
    const moved = start.moved;
    start = null;
    if (moved) {
      cancelAnimationFrame(frame);
      board.move(note.id, pos.current.x, pos.current.y);
      dragging = false;
      board.presence({ dragging: null });
    } else if (selected) {
      edit();
    } else {
      onselect(note.id);
    }
  }

  // ─── Editing (collaborative: remote inserts shift our caret correctly) ────────────────
  let ytext: Y.Text | undefined;
  const onRemote = (ev: Y.YTextEvent) => {
    if (!area || ev.transaction.local) return;
    let s = area.selectionStart;
    let en = area.selectionEnd;
    let i = 0;
    for (const d of ev.delta) {
      if (d.retain) i += d.retain;
      else if (typeof d.insert === 'string') {
        const n = d.insert.length;
        if (i <= s) s += n;
        if (i <= en) en += n;
        i += n;
      } else if (d.delete) {
        if (i < s) s = Math.max(i, s - d.delete);
        if (i < en) en = Math.max(i, en - d.delete);
      }
    }
    draft = ytext!.toString();
    tick().then(() => area?.setSelectionRange(s, en));
  };

  async function edit() {
    if (editing) return;
    ytext = board.textOf(note.id);
    draft = ytext?.toString() ?? '';
    editing = true;
    ytext?.observe(onRemote);
    board.presence({ editing: note.id });
    await tick();
    area?.focus();
    area?.setSelectionRange(draft.length, draft.length);
  }
  function stopEditing() {
    ytext?.unobserve(onRemote);
    ytext = undefined;
    editing = false;
    board.presence({ editing: null });
  }
  $effect(() => () => ytext?.unobserve(onRemote));
  $effect(() => {
    if (startEditing) {
      edit();
      onedited?.();
    }
  });
  $effect(() => {
    if (!selected && editing) stopEditing();
  });

  const fontSize = $derived(note.text.length > 90 ? 20 : note.text.length > 50 ? 24 : 28);
</script>

<div
  class="note-{note.color} group absolute left-0 top-0 touch-none select-none"
  style:transform="translate({pos.current.x}px, {pos.current.y}px) rotate({dragging ? 0 : note.rot}deg) scale({dragging ? 1.04 : 1})"
  style:z-index={dragging ? 100000 : selected ? 99999 : note.z}
  style:width="{NOTE_W}px"
  style:height="{NOTE_H}px"
  data-note={note.id}
  role="button"
  tabindex="0"
  aria-label="Sticky note: {note.text || 'empty'}"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  ondblclick={(e) => {
    e.stopPropagation();
    edit();
  }}
  onkeydown={(e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onselect(note.id);
      edit();
    }
  }}
>
  <div
    class="relative h-full w-full rounded-[4px] p-4 pt-5"
    style:background="var(--note)"
    style:box-shadow={dragging
      ? '0 28px 50px -18px rgba(30,20,60,.45), 0 2px 4px rgba(30,20,60,.08)'
      : '0 14px 22px -16px rgba(30,20,60,.45), 0 1px 2px rgba(30,20,60,.08)'}
    style:outline={selected ? '2.5px solid var(--accent)' : peer ? `2.5px solid ${peer.color}` : 'none'}
    style:outline-offset="3px"
    style:animation="pop .35s cubic-bezier(.2,1.4,.4,1) both"
  >
    <!-- Paper fold and tape -->
    <span class="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-[4px] bg-gradient-to-b from-black/[.05] to-transparent"></span>
    <span class="pointer-events-none absolute bottom-0 right-0 size-5 bg-gradient-to-tl from-black/10 to-transparent [clip-path:polygon(100%_0,100%_100%,0_100%)]"></span>

    {#if editing}
      <textarea
        bind:this={area}
        bind:value={draft}
        oninput={() => board.editText(note.id, draft)}
        onblur={stopEditing}
        onpointerdown={(e) => e.stopPropagation()}
        onkeydown={(e) => {
          if (e.key === 'Escape') area?.blur();
          e.stopPropagation();
        }}
        maxlength="400"
        aria-label="Note text"
        class="font-hand h-full w-full resize-none bg-transparent leading-[1.05] text-[#2a2533] outline-none"
        style:font-size="{fontSize}px"
      ></textarea>
    {:else}
      <p
        class="font-hand line-clamp-5 h-full overflow-hidden break-words leading-[1.05] text-[#2a2533]"
        style:font-size="{fontSize}px"
      >
        {#if note.text}{note.text}{:else}<span class="opacity-40">Tap twice to write…</span>{/if}
      </p>
    {/if}

    {#if peer}
      <span
        class="absolute -top-3 left-3 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow"
        style:background={peer.color}
      >
        {peer.name}{peer.editing === note.id ? ' is typing…' : ''}
      </span>
    {/if}

    {#if selected && !dragging}
      <div
        class="panel absolute -bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1.5"
        style:transform="translateX(-50%) rotate({-note.rot}deg) scale({Math.min(1.7, Math.max(1, 0.75 / zoom))})"
        style:transform-origin="top center"
        onpointerdown={(e) => e.stopPropagation()}
        role="toolbar"
        tabindex="-1"
        aria-label="Note actions"
      >
        {#each COLORS as c (c)}
          <button
            class="note-{c} size-5 rounded-full border border-black/10 transition-transform hover:scale-125"
            style:background="var(--note)"
            style:outline={note.color === c ? '2px solid var(--ink)' : 'none'}
            style:outline-offset="1px"
            aria-label="Colour {c}"
            onclick={() => board.setColor(note.id, c)}
          ></button>
        {/each}
        <span class="mx-1 h-4 w-px bg-black/10"></span>
        <button class="rounded-full px-1.5 text-xs font-medium hover:bg-black/5" onclick={edit}>Edit</button>
        <button
          class="rounded-full px-1.5 text-xs font-medium text-[#d6336c] hover:bg-black/5"
          onclick={() => {
            onselect(null);
            board.remove(note.id);
          }}>Delete</button
        >
      </div>
    {/if}
  </div>
</div>
