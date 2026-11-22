import { z } from 'zod';

export const generateRequest = z.object({
  prompt: z.string().trim().min(3).max(1200),
  /** Current code when iterating on an existing component. */
  code: z.string().max(20_000).optional(),
});
export type GenerateRequest = z.infer<typeof generateRequest>;

export const SYSTEM = `You are a senior UI engineer generating a single React component file.

Output rules (strict):
- Output ONLY TypeScript/TSX source. No markdown fences, no explanations.
- Exactly one default export: a React function component that takes no props and renders a complete, self-contained demo.
- Allowed imports: "react" (hooks) and "lucide-react" (icons). Nothing else. No CSS files, no images from the internet; use gradients, SVG or emoji instead.
- Style exclusively with Tailwind CSS v4 utility classes. Make it polished: good spacing, hierarchy, subtle shadows, rounded corners, hover/focus states, responsive from 360px wide.
- Make it interactive where it makes sense (state, toggles, inputs) and accessible (labels, roles, keyboard support, sufficient contrast).
- Use realistic placeholder content, never lorem ipsum.
- Keep it under 220 lines.`;

export function buildMessages(req: GenerateRequest) {
  if (!req.code) return [{ role: 'user' as const, content: req.prompt }];
  return [
    {
      role: 'user' as const,
      content: `Here is the current component:\n\n${req.code}\n\nApply this change and return the full updated file: ${req.prompt}`,
    },
  ];
}
