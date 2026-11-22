import { createStore, del, entries, get, set } from 'idb-keyval';
import type { ChartSpec } from './spec';
import type { Dataset, DatasetMeta } from './types';

/** A saved answer: the question, the spec that answers it, and where the spec came from. */
export interface Figure {
  id: string;
  question: string;
  spec: ChartSpec;
  notes: string[];
  source: 'model' | 'offline' | 'edited';
  createdAt: number;
}

// Everything lives in this browser's IndexedDB. There is no server-side storage at all.
let stores: {
  data: ReturnType<typeof createStore>;
  meta: ReturnType<typeof createStore>;
  figures: ReturnType<typeof createStore>;
} | null = null;
const db = () =>
  (stores ??= {
    data: createStore('data-chat-rows', 'rows'),
    meta: createStore('data-chat-meta', 'meta'),
    figures: createStore('data-chat-figures', 'figures'),
  });

// Datasets can be large; keep the parsed one in memory so revalidation stays instant.
const memory = new Map<string, Dataset>();

export async function saveDataset(d: Dataset) {
  memory.set(d.id, d);
  const { rows, ...meta } = d;
  await Promise.all([set(d.id, rows, db().data), set(d.id, meta, db().meta)]);
}

export async function loadDataset(id: string): Promise<Dataset | undefined> {
  const hit = memory.get(id);
  if (hit) return hit;
  const [meta, rows] = await Promise.all([
    get<DatasetMeta>(id, db().meta),
    get<Dataset['rows']>(id, db().data),
  ]);
  if (!meta || !rows) return undefined;
  const d = { ...meta, rows };
  memory.set(id, d);
  return d;
}

export async function listDatasets(): Promise<DatasetMeta[]> {
  const all = await entries<string, DatasetMeta>(db().meta);
  return all.map(([, m]) => m).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteDataset(id: string) {
  memory.delete(id);
  await Promise.all([
    del(id, db().data),
    del(id, db().meta),
    del(id, db().figures),
  ]);
}

export async function loadFigures(id: string): Promise<Figure[]> {
  return (await get<Figure[]>(id, db().figures)) ?? [];
}

export async function saveFigures(id: string, figures: Figure[]) {
  await set(id, figures, db().figures);
}

export const newId = () =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
