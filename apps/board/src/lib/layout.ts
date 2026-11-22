import type { Cluster } from './cluster';

export const NOTE_W = 200;
export const NOTE_H = 150;
const GAP = 16;
const PAD = 20;
const HEADER = 20;
const FRAME_GAP = 56;

export interface Frame {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

/**
 * Lays clusters out as labelled frames in rows, each frame a small grid of notes, centred
 * on (cx, cy). Pure, so it can be tested and computed once by whoever pressed the button.
 */
export function layoutClusters(
  clusters: Cluster[],
  cx: number,
  cy: number,
  maxRowWidth = 1800,
): { frames: Frame[]; positions: Map<string, { x: number; y: number }> } {
  const positions = new Map<string, { x: number; y: number }>();
  const sized = clusters.map((c, i) => {
    const cols = c.noteIds.length > 6 ? 3 : c.noteIds.length > 1 ? 2 : 1;
    const rows = Math.ceil(c.noteIds.length / cols);
    return {
      c,
      i,
      cols,
      w: PAD * 2 + cols * NOTE_W + (cols - 1) * GAP,
      h: HEADER + PAD + rows * NOTE_H + (rows - 1) * GAP,
    };
  });

  // Greedy row packing.
  const rows: (typeof sized)[] = [];
  let row: typeof sized = [];
  let width = 0;
  for (const s of sized) {
    if (row.length && width + s.w > maxRowWidth) {
      rows.push(row);
      row = [];
      width = 0;
    }
    row.push(s);
    width += s.w + FRAME_GAP;
  }
  if (row.length) rows.push(row);

  const rowWidths = rows.map(
    (r) => r.reduce((a, s) => a + s.w, 0) + (r.length - 1) * FRAME_GAP,
  );
  const rowHeights = rows.map((r) => Math.max(...r.map((s) => s.h)));
  const totalH =
    rowHeights.reduce((a, b) => a + b, 0) + (rows.length - 1) * FRAME_GAP;

  const frames: Frame[] = [];
  let y = Math.round(cy - totalH / 2);
  rows.forEach((r, ri) => {
    let x = Math.round(cx - rowWidths[ri]! / 2);
    for (const s of r) {
      frames.push({
        id: `frame-${s.i}`,
        label: s.c.label,
        x,
        y,
        w: s.w,
        h: s.h,
        color: s.i,
      });
      s.c.noteIds.forEach((id, k) => {
        const col = k % s.cols;
        const rr = Math.floor(k / s.cols);
        positions.set(id, {
          x: x + PAD + col * (NOTE_W + GAP),
          y: y + HEADER + rr * (NOTE_H + GAP),
        });
      });
      x += s.w + FRAME_GAP;
    }
    y += rowHeights[ri]! + FRAME_GAP;
  });
  return { frames, positions };
}
