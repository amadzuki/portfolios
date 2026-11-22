import type { ParseMessage } from './parse.worker';
import type { Dataset } from './types';

/** Parses and profiles a CSV off the main thread. Nothing here touches the network. */
export function parseCsv(
  file: Blob,
  meta: Pick<Dataset, 'id' | 'name' | 'source' | 'description'>,
  onProgress?: (p: number) => void,
): Promise<Dataset> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<ParseMessage>) => {
      const m = e.data;
      if (m.type === 'progress') return onProgress?.(m.value);
      worker.terminate();
      if (m.type === 'error') return reject(new Error(m.message));
      onProgress?.(1);
      resolve({
        ...meta,
        rows: m.result.rows,
        columns: m.result.columns,
        rowCount: m.result.rows.length,
        truncated: m.result.truncated,
        createdAt: Date.now(),
      });
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Could not parse that file.'));
    };
    worker.postMessage({ file, name: meta.name });
  });
}
