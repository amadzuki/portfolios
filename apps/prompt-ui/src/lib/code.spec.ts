import { describe, expect, it } from 'vitest';
import { buildSrcDoc, compile } from './code';
import { extractCode } from './extract';
import { buildMessages, generateRequest } from './prompt';
import { decodeShare, encodeShare } from './share';

const sample = `import { useState } from 'react';
import { Heart } from 'lucide-react';
export default function App() {
  const [n, setN] = useState<number>(0);
  return <button onClick={() => setN(n + 1)}><Heart /> {n}</button>;
}`;

describe('extractCode', () => {
  it('strips fences and leading prose', () => {
    expect(
      extractCode('Sure! Here it is:\n```tsx\n' + sample + '\n```\nEnjoy'),
    ).toBe(sample + '\n');
  });
  it('handles an unterminated fence while streaming', () => {
    expect(
      extractCode('```tsx\nimport x from "react";\nexport default'),
    ).toContain('export default');
  });
});

describe('compile', () => {
  it('turns TSX into ESM with the automatic runtime', () => {
    const r = compile(sample);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.js).toContain('react/jsx-runtime');
      expect(r.js).not.toContain('<number>');
    }
  });
  it('rejects unknown imports and missing default exports', () => {
    expect(
      compile(`import x from 'lodash';\nexport default () => null;`),
    ).toMatchObject({ ok: false });
    expect(compile(`export const A = () => null;`)).toMatchObject({
      ok: false,
    });
  });
  it('reports syntax errors', () => {
    expect(
      compile('export default function () { return <div> }'),
    ).toMatchObject({ ok: false });
  });
});

describe('buildSrcDoc', () => {
  it('embeds code safely inside a script tag', () => {
    const doc = buildSrcDoc(
      'export default () => "</script><script>alert(1)</script>";',
    );
    expect(doc.match(/<\/script>/g)?.length).toBe(4); // only our own closing tags
    expect(doc).toContain('"importmap"');
  });
});

describe('share links', () => {
  it('round-trip', async () => {
    const enc = await encodeShare(sample);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShare(enc)).toBe(sample);
  });
});

describe('requests', () => {
  it('validates and builds iteration messages with the current code', () => {
    expect(generateRequest.safeParse({ prompt: 'x' }).success).toBe(false);
    const msgs = buildMessages({ prompt: 'make it blue', code: sample });
    expect(msgs[0].content).toContain('make it blue');
    expect(msgs[0].content).toContain(sample);
  });
});

describe('examples', async () => {
  const { examples } = await import('./examples');
  it.each(examples.map((e) => [e.id, e.code]))('%s compiles', (_id, code) => {
    expect(compile(code)).toMatchObject({ ok: true });
  });
});
