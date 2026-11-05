import { describe, expect, it } from 'vitest';
import { knowledgeBase, knowledgeContext, parseCitations } from './knowledge';

describe('knowledge base', () => {
  it('has unique ids and every doc appears in the prompt context', () => {
    const docs = knowledgeBase();
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    const ctx = knowledgeContext(docs);
    for (const d of docs) expect(ctx).toContain(`[${d.id}]`);
  });

  it('turns known [ids] into citations and leaves other brackets alone', () => {
    const segs = parseCitations(
      'He led 4 projects [exp-prospace]. See [note] and [about, exp-grosirparts].',
    );
    expect(
      segs
        .filter((s) => s.type === 'cite')
        .map((s) => (s.type === 'cite' ? s.doc.id : '')),
    ).toEqual(['exp-prospace', 'about', 'exp-grosirparts']);
    expect(
      segs.map((s) => (s.type === 'text' ? s.text : '')).join(''),
    ).toContain('[note]');
  });
});
