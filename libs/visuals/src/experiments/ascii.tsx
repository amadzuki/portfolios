'use client';
import { interpolateRgbBasis } from 'd3';
import { useEffect, useMemo, useRef } from 'react';
import { glyphGrid } from '../lib/glyph';
import {
  setupCanvas,
  useAnimationFrame,
  useElementSize,
  usePointer,
  useReducedMotion,
} from '../lib/hooks';
import { noise3 } from '../lib/noise';
import type { ExperimentProps } from '../lib/types';

const RAMP = ' .:-=+*#%@';
const SCRAMBLE = '01<>/\\{}[]#$%&?!';

/** Canvas 2D: the glyph rendered as a live ASCII field. Cursor scrambles it; typing injects your keys. */
export default function Ascii({
  glyph,
  palette,
  fontFamily,
  className,
}: ExperimentProps) {
  const [wrap, { width, height }] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointer = usePointer(wrap);
  const reduced = useReducedMotion();
  const typed = useRef('');

  const cell = width < 640 ? 9 : 12;
  const cols = Math.max(1, Math.floor(width / (cell * 0.62)));
  const rows = Math.max(1, Math.floor(height / cell));
  const grid = useMemo(
    () =>
      width && height
        ? glyphGrid(glyph, cols, rows, { fontFamily, resolution: 256 })
        : null,
    [glyph, fontFamily, cols, rows, width, height],
  );
  const color = useMemo(() => interpolateRgbBasis(palette.colors), [palette]);

  useEffect(() => {
    if (canvas.current && width && height)
      ctxRef.current = setupCanvas(canvas.current, width, height);
  }, [width, height]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length === 1 && e.key.trim())
        typed.current = (typed.current + e.key).slice(-12);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useAnimationFrame(
    (t) => {
      const ctx = ctxRef.current;
      if (!ctx || !grid) return;
      const cw = width / cols;
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${cell}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = 'top';
      const p = pointer.current;
      const extra = typed.current;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const g = grid[y * cols + x];
          const n = noise3(x * 0.08, y * 0.12, t * 0.6);
          let v = g * (0.55 + n * 0.6) + n * 0.12;
          let ch: string;
          const px = x * cw;
          const py = y * cell;
          const near = p ? Math.hypot(px - p.x, py - p.y) < 90 : false;
          if (near && g > 0.2) {
            const pool = extra || SCRAMBLE;
            ch = pool[Math.floor(Math.random() * pool.length)];
            v = 1;
          } else {
            ch = RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
          }
          if (ch === ' ') continue;
          ctx.fillStyle = near
            ? '#ffffff'
            : color(Math.min(1, (x / cols) * 0.7 + n * 0.5));
          ctx.globalAlpha = Math.min(1, 0.25 + v);
          ctx.fillText(ch, px, py);
        }
      }
      ctx.globalAlpha = 1;
    },
    !reduced,
    [grid, width, height],
  );

  return (
    <div
      ref={wrap}
      className={className}
      style={{ background: palette.background, touchAction: 'none' }}
    >
      <canvas
        ref={canvas}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
