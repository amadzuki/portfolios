/**
 * Pulls the component source out of a model response: strips markdown fences and any
 * prose before the first import/export, which models sometimes add despite instructions.
 */
export function extractCode(raw: string): string {
  let s = raw.trim();
  const fence = s.match(
    /```(?:tsx|jsx|typescript|ts|javascript|js)?\s*\n([\s\S]*?)(?:```|$)/,
  );
  if (fence) s = fence[1];
  const start = s.search(/^(import|export|const|function)\b/m);
  if (start > 0) s = s.slice(start);
  return s.trim() + '\n';
}
