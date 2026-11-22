/**
 * A small y-websocket compatible sync server. One Y.Doc per room, kept in memory and
 * optionally snapshotted to disk. Shared by the Vite dev server and the production server.
 *
 * Written with erasable TypeScript only, so Node runs it directly (type stripping).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocketServer, type WebSocket } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const ROOM = /^[a-z0-9-]{3,48}$/;
const MAX_ROOMS = 300;
const MAX_PEERS = 40;
const MAX_DOC_BYTES = 2_000_000;
const IDLE_MS = 10 * 60_000;

interface Room {
  name: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;
  idle?: ReturnType<typeof setTimeout>;
  save?: ReturnType<typeof setTimeout>;
}

export interface SyncOptions {
  /** URL prefix to accept upgrades on, e.g. "/sync". */
  path?: string;
  /** Directory for snapshots. Without it, boards live only in memory. */
  dataDir?: string;
  log?: (msg: string) => void;
}

export function createSyncServer(opts: SyncOptions = {}) {
  const prefix = opts.path ?? '/sync';
  const rooms = new Map<string, Room>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 });
  if (opts.dataDir) mkdirSync(opts.dataDir, { recursive: true });
  const file = (name: string) => join(opts.dataDir!, `${name}.ybin`);

  function getRoom(name: string): Room | null {
    const existing = rooms.get(name);
    if (existing) return existing;
    if (rooms.size >= MAX_ROOMS) evictIdle();
    if (rooms.size >= MAX_ROOMS) return null;
    const doc = new Y.Doc({ gc: true });
    if (opts.dataDir) {
      try {
        Y.applyUpdate(doc, readFileSync(file(name)));
      } catch {
        /* new board */
      }
    }
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    const room: Room = { name, doc, awareness, conns: new Map() };

    doc.on('update', (update: Uint8Array) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      broadcast(room, encoding.toUint8Array(enc));
      scheduleSave(room);
    });
    awareness.on(
      'update',
      (
        {
          added,
          updated,
          removed,
        }: { added: number[]; updated: number[]; removed: number[] },
        conn: WebSocket | null,
      ) => {
        const changed = added.concat(updated, removed);
        if (conn) {
          const ids = room.conns.get(conn);
          if (ids) {
            added.forEach((id) => ids.add(id));
            removed.forEach((id) => ids.delete(id));
          }
        }
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          enc,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
        );
        broadcast(room, encoding.toUint8Array(enc));
      },
    );
    rooms.set(name, room);
    return room;
  }

  function scheduleSave(room: Room) {
    if (!opts.dataDir) return;
    clearTimeout(room.save);
    room.save = setTimeout(() => {
      try {
        writeFileSync(file(room.name), Y.encodeStateAsUpdate(room.doc));
      } catch (err) {
        opts.log?.(`[sync] could not save ${room.name}: ${String(err)}`);
      }
    }, 1500);
  }

  function evictIdle() {
    for (const [name, r] of rooms)
      if (!r.conns.size) {
        clearTimeout(r.idle);
        r.doc.destroy();
        rooms.delete(name);
      }
  }

  function broadcast(room: Room, msg: Uint8Array) {
    for (const conn of room.conns.keys()) send(room, conn, msg);
  }

  function send(room: Room, conn: WebSocket, msg: Uint8Array) {
    if (conn.readyState !== conn.OPEN) return close(room, conn);
    conn.send(msg, (err) => err && close(room, conn));
  }

  function close(room: Room, conn: WebSocket) {
    const ids = room.conns.get(conn);
    if (!ids) return;
    room.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(room.awareness, [...ids], null);
    conn.terminate();
    if (!room.conns.size) {
      clearTimeout(room.idle);
      room.idle = setTimeout(() => {
        if (room.conns.size) return;
        if (opts.dataDir)
          writeFileSync(file(room.name), Y.encodeStateAsUpdate(room.doc));
        room.doc.destroy();
        rooms.delete(room.name);
      }, IDLE_MS);
    }
  }

  function onConnection(conn: WebSocket, room: Room) {
    conn.binaryType = 'arraybuffer';
    room.conns.set(conn, new Set());
    clearTimeout(room.idle);

    conn.on('message', (data: ArrayBuffer) => {
      try {
        const dec = decoding.createDecoder(new Uint8Array(data));
        const enc = encoding.createEncoder();
        const type = decoding.readVarUint(dec);
        if (type === MESSAGE_SYNC) {
          if (Y.encodeStateAsUpdate(room.doc).byteLength > MAX_DOC_BYTES) {
            // Board is full: still answer sync requests, but ignore new updates.
            const peek = decoding.clone(dec);
            if (decoding.readVarUint(peek) !== syncProtocol.messageYjsSyncStep1)
              return;
          }
          encoding.writeVarUint(enc, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(dec, enc, room.doc, conn);
          if (encoding.length(enc) > 1)
            send(room, conn, encoding.toUint8Array(enc));
        } else if (type === MESSAGE_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(dec),
            conn,
          );
        }
      } catch (err) {
        opts.log?.(`[sync] bad message: ${String(err)}`);
      }
    });
    conn.on('close', () => close(room, conn));
    conn.on('error', () => close(room, conn));

    // Send our state vector, then everyone's presence.
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    send(room, conn, encoding.toUint8Array(enc));
    const states = room.awareness.getStates();
    if (states.size) {
      const a = encoding.createEncoder();
      encoding.writeVarUint(a, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        a,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [
          ...states.keys(),
        ]),
      );
      send(room, conn, encoding.toUint8Array(a));
    }
  }

  /** Call from an HTTP server's "upgrade" event. Returns false if the URL isn't ours. */
  function handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): boolean {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith(`${prefix}/`)) return false;
    const name = url.pathname.slice(prefix.length + 1);
    const room = ROOM.test(name) ? getRoom(name) : null;
    if (!room || room.conns.size >= MAX_PEERS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, room));
    return true;
  }

  return {
    handleUpgrade,
    stats: () => ({
      rooms: rooms.size,
      peers: [...rooms.values()].reduce((a, r) => a + r.conns.size, 0),
    }),
    close: () => {
      for (const r of rooms.values())
        for (const c of r.conns.keys()) c.terminate();
      wss.close();
    },
  };
}

export const isRoomName = (s: string) => ROOM.test(s);
