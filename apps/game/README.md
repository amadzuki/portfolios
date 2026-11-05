# Lumen Drift

A small WebGL flying game: thread light gates to raise your multiplier, gather motes, avoid the shards.

Built with **plain three.js + Vite, no UI framework**, to show low-level rendering work:

- custom GLSL sky (gradient, sun, twinkling stars) also baked into a PMREM environment map so the
  iridescent shards reflect the sunset
- procedural dunes displaced in the vertex shader, with derivative-antialiased contour lines,
  an orb light pool and hand-rolled fog
- pooled entities, frame-rate independent trail, spark bursts, UnrealBloom + custom vignette /
  grain / chromatic aberration pass
- generative WebAudio pad and pentatonic chimes that climb with your combo
- pure, unit-tested game rules in `src/game/logic.ts`

```bash
bunx nx dev game      # http://localhost:4300
bunx nx test game
bunx nx build game
```

Append `?debug` to the URL to expose `window.__lumen()` with live stats.
