'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function useElementSize<T extends HTMLElement>(): [
  RefObject<T | null>,
  { width: number; height: number },
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) =>
        s.width === width && s.height === height ? s : { width, height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** Calls `frame(timeSeconds, dtSeconds)` every animation frame while `active`; when inactive, renders one static frame (re-run when `deps` change). */
export function useAnimationFrame(
  frame: (t: number, dt: number) => void,
  active = true,
  deps: readonly unknown[] = [],
) {
  const cb = useRef(frame);
  cb.current = frame;
  useEffect(() => {
    if (!active) {
      cb.current(0, 0);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const start = last;
    const loop = (now: number) => {
      cb.current((now - start) / 1000, Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

/** Pointer position relative to an element, in CSS px, or null when outside. */
export function usePointer(ref: RefObject<HTMLElement | null>) {
  const pos = useRef<{ x: number; y: number; down: boolean } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pos.current = {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        down: e.buttons > 0,
      };
    };
    const leave = () => (pos.current = null);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerup', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', move);
      el.removeEventListener('pointerup', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [ref]);
  return pos;
}

/** Sets up a HiDPI 2D canvas matching its CSS size. */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
