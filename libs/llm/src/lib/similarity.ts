export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length)
    throw new Error('Vectors must have the same length');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Top-k nearest items by cosine similarity. Fine for a few thousand vectors in memory. */
export function topK<T extends { embedding: readonly number[] }>(
  query: readonly number[],
  items: readonly T[],
  k = 5,
): Array<T & { score: number }> {
  return items
    .map((item) => ({
      ...item,
      score: cosineSimilarity(query, item.embedding),
    }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
