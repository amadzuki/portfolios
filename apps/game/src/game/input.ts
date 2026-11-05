import { BOUNDS } from './logic';

/** Maps pointer/touch position or keyboard to a steering target inside the flight bounds. */
export function createInput(el: HTMLElement) {
  const target = { x: 0, y: (BOUNDS.yMin + BOUNDS.yMax) / 2 };
  const keys = new Set<string>();
  let usingPointer = false;

  const fromPointer = (cx: number, cy: number) => {
    const r = el.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1;
    const ny = 1 - (cy - r.top) / r.height;
    target.x = Math.max(-1, Math.min(1, nx * 1.25)) * BOUNDS.x;
    target.y =
      BOUNDS.yMin +
      Math.max(0, Math.min(1, (ny - 0.15) * 1.4)) * (BOUNDS.yMax - BOUNDS.yMin);
    usingPointer = true;
  };

  el.addEventListener('pointermove', (e) => fromPointer(e.clientX, e.clientY));
  el.addEventListener('pointerdown', (e) => fromPointer(e.clientX, e.clientY));
  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(
        e.key.toLowerCase(),
      )
    )
      e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  return {
    target,
    update(dt: number) {
      const k = (a: string, b: string) => (keys.has(a) || keys.has(b) ? 1 : 0);
      const dx = k('arrowright', 'd') - k('arrowleft', 'a');
      const dy = k('arrowup', 'w') - k('arrowdown', 's');
      if (dx || dy) usingPointer = false;
      if (!usingPointer) {
        target.x = Math.max(
          -BOUNDS.x,
          Math.min(BOUNDS.x, target.x + dx * dt * 11),
        );
        target.y = Math.max(
          BOUNDS.yMin,
          Math.min(BOUNDS.yMax, target.y + dy * dt * 8),
        );
      }
    },
  };
}
