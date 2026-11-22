import type { TimeUnit } from './spec';

const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

export function formatNumber(n: number, opts: { compact?: boolean } = {}) {
  if (!Number.isFinite(n)) return '–';
  if (opts.compact !== false && Math.abs(n) >= 10_000) return compact.format(n);
  return plain.format(n);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatTime(t: number, unit: TimeUnit, short = false) {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  switch (unit) {
    case 'year':
      return String(y);
    case 'quarter':
      return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${short ? `’${String(y).slice(2)}` : y}`;
    case 'month':
      return short ? `${m} ’${String(y).slice(2)}` : `${m} ${y}`;
    case 'hour':
      return `${m} ${day}, ${String(d.getUTCHours()).padStart(2, '0')}:00`;
    case 'week':
      return short ? `${m} ${day}` : `Week of ${m} ${day}, ${y}`;
    default:
      return short ? `${m} ${day}` : `${m} ${day}, ${y}`;
  }
}

export const label = (name: string) => name.replace(/_/g, ' ');
