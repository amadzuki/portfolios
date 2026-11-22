import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import type { Frame } from './layout';
import type { Identity } from './identity';

export const COLORS = [
  'lemon',
  'peach',
  'mint',
  'sky',
  'lilac',
  'rose',
] as const;
export type NoteColor = (typeof COLORS)[number];

export interface NoteView {
  id: string;
  x: number;
  y: number;
  rot: number;
  z: number;
  color: NoteColor;
  text: string;
  author: string;
}

export interface Peer {
  clientId: number;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  dragging: string | null;
  editing: string | null;
  busy: string | null;
}

/** Changes made by this tab, so undo only reverts our own work. */
const LOCAL = Symbol('local');

/**
 * The board's shared state. Everything lives in one Y.Doc (synced over WebSocket); this class
 * mirrors it into Svelte runes so components stay plain and reactive.
 */
export class Board {
  readonly doc = new Y.Doc();
  readonly notes = this.doc.getMap<Y.Map<unknown>>('notes');
  readonly frames = this.doc.getMap<Frame>('frames');
  readonly meta = this.doc.getMap<unknown>('meta');
  readonly undo: Y.UndoManager;
  provider: WebsocketProvider | null = null;

  list = $state<NoteView[]>([]);
  frameList = $state<Frame[]>([]);
  peers = $state<Peer[]>([]);
  status = $state<'connecting' | 'connected' | 'offline'>('connecting');
  synced = $state(false);
  title = $state('Untitled board');
  canUndo = $state(false);
  canRedo = $state(false);
  private zTop = 0;

  constructor() {
    this.undo = new Y.UndoManager([this.notes, this.frames], {
      trackedOrigins: new Set([LOCAL]),
      captureTimeout: 400,
    });
    const refreshUndo = () => {
      this.canUndo = this.undo.canUndo();
      this.canRedo = this.undo.canRedo();
    };
    this.undo.on('stack-item-added', refreshUndo);
    this.undo.on('stack-item-popped', refreshUndo);
    this.undo.on('stack-cleared', refreshUndo);
    this.notes.observeDeep(() => this.refreshNotes());
    this.frames.observe(() => (this.frameList = [...this.frames.values()]));
    this.meta.observe(
      () =>
        (this.title = (this.meta.get('title') as string) || 'Untitled board'),
    );
  }

  connect(room: string, me: Identity) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.provider = new WebsocketProvider(
      `${proto}://${location.host}/sync`,
      room,
      this.doc,
      {
        maxBackoffTime: 4000,
      },
    );
    this.provider.on('status', (e: { status: string }) => {
      this.status =
        e.status === 'connected'
          ? 'connected'
          : e.status === 'connecting'
            ? 'connecting'
            : 'offline';
    });
    this.provider.on('sync', (s: boolean) => (this.synced = s));
    const aw = this.provider.awareness;
    aw.setLocalState({
      user: me,
      cursor: null,
      dragging: null,
      editing: null,
      busy: null,
    });
    aw.on('change', () => {
      const out: Peer[] = [];
      aw.getStates().forEach((s, clientId) => {
        if (clientId === this.doc.clientID || !s['user']) return;
        const user = s['user'] as Identity;
        out.push({
          clientId,
          name: user.name,
          color: user.color,
          cursor: (s['cursor'] as Peer['cursor']) ?? null,
          dragging: (s['dragging'] as string) ?? null,
          editing: (s['editing'] as string) ?? null,
          busy: (s['busy'] as string) ?? null,
        });
      });
      this.peers = out;
    });
  }

  presence(
    patch: Partial<Omit<Peer, 'clientId' | 'name' | 'color'>> & {
      user?: Identity;
    },
  ) {
    const aw = this.provider?.awareness;
    if (!aw) return;
    const cur = aw.getLocalState() ?? {};
    aw.setLocalState({ ...cur, ...patch });
  }

  destroy() {
    this.provider?.destroy();
    this.undo.destroy();
    this.doc.destroy();
  }

  private refreshNotes() {
    const out: NoteView[] = [];
    this.notes.forEach((m, id) => {
      const z = (m.get('z') as number) ?? 0;
      if (z > this.zTop) this.zTop = z;
      out.push({
        id,
        x: (m.get('x') as number) ?? 0,
        y: (m.get('y') as number) ?? 0,
        rot: (m.get('rot') as number) ?? 0,
        z,
        color: (m.get('color') as NoteColor) ?? 'lemon',
        text: (m.get('text') as Y.Text | undefined)?.toString() ?? '',
        author: (m.get('author') as string) ?? '',
      });
    });
    this.list = out;
  }

  textOf(id: string): Y.Text | undefined {
    return this.notes.get(id)?.get('text') as Y.Text | undefined;
  }

  transact(fn: () => void) {
    this.doc.transact(fn, LOCAL);
  }

  addNote(p: {
    x: number;
    y: number;
    color?: NoteColor;
    text?: string;
    rot?: number;
    author: string;
  }) {
    const id = crypto.randomUUID().slice(0, 8);
    this.transact(() => {
      const m = new Y.Map<unknown>();
      m.set('x', Math.round(p.x));
      m.set('y', Math.round(p.y));
      m.set('rot', p.rot ?? Math.round((Math.random() - 0.5) * 50) / 10);
      m.set('z', ++this.zTop);
      m.set(
        'color',
        p.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
      );
      m.set('text', new Y.Text(p.text ?? ''));
      m.set('author', p.author);
      this.notes.set(id, m);
    });
    return id;
  }

  move(id: string, x: number, y: number) {
    const m = this.notes.get(id);
    if (!m) return;
    this.transact(() => {
      m.set('x', Math.round(x));
      m.set('y', Math.round(y));
    });
  }

  raise(id: string) {
    const m = this.notes.get(id);
    if (m && (m.get('z') as number) !== this.zTop)
      this.transact(() => m.set('z', ++this.zTop));
  }

  setColor(id: string, color: NoteColor) {
    const m = this.notes.get(id);
    if (m) this.transact(() => m.set('color', color));
  }

  remove(id: string) {
    this.transact(() => this.notes.delete(id));
  }

  /** Applies a text edit as a minimal diff, so concurrent typing in one note merges. */
  editText(id: string, next: string) {
    const t = this.textOf(id);
    if (!t) return;
    const prev = t.toString();
    if (prev === next) return;
    let start = 0;
    while (
      start < prev.length &&
      start < next.length &&
      prev[start] === next[start]
    )
      start++;
    let endPrev = prev.length;
    let endNext = next.length;
    while (
      endPrev > start &&
      endNext > start &&
      prev[endPrev - 1] === next[endNext - 1]
    ) {
      endPrev--;
      endNext--;
    }
    this.transact(() => {
      if (endPrev > start) t.delete(start, endPrev - start);
      if (endNext > start) t.insert(start, next.slice(start, endNext));
    });
  }

  setTitle(title: string) {
    this.doc.transact(() => this.meta.set('title', title.slice(0, 80)));
  }

  /** Moves notes and replaces frames in one transaction, so one undo restores the mess. */
  applyLayout(
    positions: Map<string, { x: number; y: number }>,
    frames: Frame[],
  ) {
    this.undo.stopCapturing();
    this.transact(() => {
      for (const [id, p] of positions) {
        const m = this.notes.get(id);
        if (!m) continue;
        m.set('x', p.x);
        m.set('y', p.y);
        m.set('rot', Math.round((Math.random() - 0.5) * 16) / 10);
      }
      this.frames.clear();
      for (const f of frames) this.frames.set(f.id, f);
    });
    this.undo.stopCapturing();
  }

  removeFrame(id: string) {
    this.transact(() => this.frames.delete(id));
  }

  /** Seeds an empty board once, even if several people open it at the same moment. */
  seedOnce(fn: () => void) {
    if (this.meta.get('seeded') || this.notes.size) return;
    this.doc.transact(() => {
      this.meta.set('seeded', true);
      fn();
    });
  }
}
