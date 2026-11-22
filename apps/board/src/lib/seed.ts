/** A messy retro, the kind of board that "Tidy up" was made for. */
export const RETRO_NOTES = [
  'Deploys take forever on Fridays',
  'Flaky deploy pipeline blocked us twice',
  'Pipeline cache would speed up deploys',
  'Too many meetings on Mondays',
  'Standup meetings keep running over',
  'Async updates instead of some meetings?',
  'Great pairing sessions with design',
  'Design reviews caught bugs early',
  'Onboarding docs are out of date',
  'New joiners struggled with local setup docs',
  'Shipped the checkout redesign 🎉',
  'Customers love the new search',
  'On-call alerts are too noisy',
  'Alert fatigue during on-call week',
];

export function scatter(n: number, cx: number, cy: number) {
  const out: { x: number; y: number; rot: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.399963 + Math.random() * 0.4;
    const r = 90 + Math.sqrt(i) * 150 + Math.random() * 40;
    out.push({
      x: cx + Math.cos(a) * r * 1.4 - 100,
      y: cy + Math.sin(a) * r * 0.8 - 75,
      rot: (Math.random() - 0.5) * 6,
    });
  }
  return out;
}
