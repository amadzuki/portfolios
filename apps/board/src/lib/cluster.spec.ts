import { describe, expect, it } from 'vitest';
import { clusterByKeywords, normalizeClusters, stem, tokens } from './cluster';
import { layoutClusters, NOTE_H, NOTE_W } from './layout';

const notes = [
  { id: 'a', text: 'Deploys take too long on Fridays' },
  { id: 'b', text: 'Flaky deploy pipeline again' },
  { id: 'c', text: 'Standup meetings run over' },
  { id: 'd', text: 'Too many meetings on Monday' },
  { id: 'e', text: 'Great pairing session with design' },
  { id: 'f', text: 'Pipeline caching would speed up deploys' },
];

describe('clusterByKeywords', () => {
  it('stems and drops stop words', () => {
    expect(stem('meetings')).toBe('meeting');
    expect(stem('deploys')).toBe('deploy');
    expect(tokens('The deploys are FLAKY!')).toEqual(['deploy', 'flaky']);
  });

  it('groups notes sharing a word and keeps every note once', () => {
    const groups = clusterByKeywords(notes);
    const byLabel = Object.fromEntries(
      groups.map((g) => [g.label, g.noteIds.sort()]),
    );
    expect(byLabel['Deploy']).toEqual(['a', 'b', 'f']);
    expect(byLabel['Meeting']).toEqual(['c', 'd']);
    expect(groups.flatMap((g) => g.noteIds).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });
});

describe('normalizeClusters', () => {
  it('drops unknown and duplicate ids and collects missing notes', () => {
    const out = normalizeClusters(
      [
        { label: 'Ops', noteIds: ['a', 'b', 'zzz'] },
        { label: 'Dupes', noteIds: ['a'] },
      ],
      ['a', 'b', 'c'],
    );
    expect(out).toEqual([
      { label: 'Ops', noteIds: ['a', 'b'] },
      { label: 'Everything else', noteIds: ['c'] },
    ]);
  });
});

describe('layoutClusters', () => {
  it('places notes inside their frames without overlap', () => {
    const { frames, positions } = layoutClusters(
      clusterByKeywords(notes),
      0,
      0,
    );
    expect(positions.size).toBe(6);
    const rects = [...positions.values()];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!,
          b = rects[j]!;
        const overlap =
          a.x < b.x + NOTE_W &&
          b.x < a.x + NOTE_W &&
          a.y < b.y + NOTE_H &&
          b.y < a.y + NOTE_H;
        expect(overlap).toBe(false);
      }
    for (const f of frames) expect(f.w).toBeGreaterThan(NOTE_W);
  });
});
