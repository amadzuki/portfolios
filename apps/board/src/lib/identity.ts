const ADJ = [
  'Curious',
  'Sunny',
  'Brave',
  'Quiet',
  'Swift',
  'Clever',
  'Gentle',
  'Bold',
  'Witty',
  'Calm',
  'Lucky',
  'Merry',
];
const ANIMAL = [
  'Otter',
  'Heron',
  'Lynx',
  'Panda',
  'Gecko',
  'Badger',
  'Koala',
  'Falcon',
  'Tapir',
  'Quokka',
  'Orca',
  'Ibis',
];
export const CURSOR_COLORS = [
  '#ff5d5d',
  '#ff9f1c',
  '#2ec4b6',
  '#3a86ff',
  '#8338ec',
  '#ff006e',
  '#06a77d',
  '#e76f51',
];

export interface Identity {
  name: string;
  color: string;
}

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

export function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem('board:identity');
    if (raw) {
      const v = JSON.parse(raw) as Identity;
      if (v?.name && v?.color) return v;
    }
  } catch {
    /* private mode */
  }
  const id = {
    name: `${pick(ADJ)} ${pick(ANIMAL)}`,
    color: pick(CURSOR_COLORS),
  };
  saveIdentity(id);
  return id;
}

export function saveIdentity(id: Identity) {
  try {
    localStorage.setItem('board:identity', JSON.stringify(id));
  } catch {
    /* ignore */
  }
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
