/// <reference lib="webworker" />
import Papa from 'papaparse';
import { buildDataset } from './profile';

export const MAX_ROWS = 250_000;

export type ParseRequest = { file: File | Blob; name: string };
export type ParseMessage =
  | { type: 'progress'; value: number }
  | {
      type: 'done';
      result: ReturnType<typeof buildDataset> & { truncated: boolean };
    }
  | { type: 'error'; message: string };

const post = (m: ParseMessage) =>
  (self as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const { file } = e.data;
  const raw: Record<string, string>[] = [];
  let fields: string[] = [];
  let truncated = false;
  let last = 0;
  Papa.parse<Record<string, string>>(file as File, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
    chunkSize: 1024 * 256,
    chunk(res, parser) {
      if (!fields.length) fields = res.meta.fields ?? [];
      for (const r of res.data) {
        if (raw.length >= MAX_ROWS) {
          truncated = true;
          parser.abort();
          break;
        }
        raw.push(r);
      }
      const progress = Math.min(
        0.95,
        (res.meta.cursor ?? 0) / (file.size || 1),
      );
      if (progress - last > 0.02)
        post({ type: 'progress', value: (last = progress) });
    },
    complete() {
      try {
        if (!fields.length || !raw.length)
          throw new Error('That file has no rows I can read.');
        const result = buildDataset(fields, raw);
        post({ type: 'done', result: { ...result, truncated } });
      } catch (err) {
        post({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    error(err) {
      post({ type: 'error', message: err.message });
    },
  });
};
