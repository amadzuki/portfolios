'use client';
import {
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3';
import { useEffect, useRef } from 'react';
import { sampleGlyphPoints } from '../lib/glyph';
import {
  setupCanvas,
  useElementSize,
  usePointer,
  useReducedMotion,
} from '../lib/hooks';
import type { ExperimentProps } from '../lib/types';

interface Node extends SimulationNodeDatum {
  tx: number;
  ty: number;
  r: number;
  hue: number;
}

/** d3-force: nodes sampled from the glyph, linked to neighbours, pushed by the cursor. Click to scatter. */
export default function ForceNetwork({
  glyph,
  palette,
  fontFamily,
  className,
}: ExperimentProps) {
  const [wrap, { width, height }] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = usePointer(wrap);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = canvas.current;
    if (!el || !width || !height) return;
    const ctx = setupCanvas(el, width, height);
    const { points, aspect } = sampleGlyphPoints(glyph, 420, {
      fontFamily,
      resolution: 200,
    });
    const scale = Math.min((height * 0.72) / 2, (width * 0.85) / (2 * aspect));
    const cx = width / 2;
    const cy = height / 2;

    const nodes: Node[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const tx = cx + points[i] * scale;
      const ty = cy - points[i + 1] * scale;
      nodes.push({
        tx,
        ty,
        x: reduced ? tx : cx + (Math.random() - 0.5) * width,
        y: reduced ? ty : cy + (Math.random() - 0.5) * height,
        r: 1.5 + Math.random() * 2.5,
        hue: Math.random(),
      });
    }
    // k-nearest neighbour links, computed once from target positions
    const links: Array<[Node, Node]> = [];
    const maxD = scale * 0.16;
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => ({ b, j, d: Math.hypot(a.tx - b.tx, a.ty - b.ty) }))
        .filter(({ j, d }) => j !== i && d < maxD)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .forEach(({ b, j }) => j > i && links.push([a, b]));
    });

    const cursorForce = (alpha: number) => {
      const p = pointer.current;
      if (!p) return;
      const radius = p.down ? 220 : 110;
      for (const n of nodes) {
        const dx = n.x! - p.x;
        const dy = n.y! - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < radius) {
          const f = ((radius - d) / radius) * (p.down ? 12 : 4) * alpha;
          n.vx! += (dx / d) * f;
          n.vy! += (dy / d) * f;
        }
      }
    };

    const [c0, c1, c2] = palette.colors;
    const draw = () => {
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = `${c1}55`;
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(a.x!, a.y!);
        ctx.lineTo(b.x!, b.y!);
      }
      ctx.stroke();
      for (const n of nodes) {
        ctx.fillStyle = n.hue < 0.45 ? c0 : n.hue < 0.85 ? c2 : '#ffffff';
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const sim = forceSimulation(nodes)
      .force('x', forceX<Node>((d) => d.tx).strength(0.09))
      .force('y', forceY<Node>((d) => d.ty).strength(0.09))
      .force('charge', forceManyBody<Node>().strength(-2).distanceMax(40))
      .force(
        'collide',
        forceCollide<Node>((d) => d.r + 0.8),
      )
      .force('cursor', cursorForce)
      .velocityDecay(0.25)
      .alphaDecay(0)
      .alpha(reduced ? 0 : 0.6)
      .on('tick', draw);
    if (reduced) {
      sim.stop();
      draw();
    }
    return () => {
      sim.stop();
    };
  }, [glyph, palette, fontFamily, width, height, pointer, reduced]);

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
