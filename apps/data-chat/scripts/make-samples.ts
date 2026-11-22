/**
 * Generates the synthetic sample datasets in public/samples. Deterministic (seeded), so
 * re-running produces identical files. Run with `bun scripts/make-samples.ts`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(import.meta.dirname, '..', 'public', 'samples');

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const csv = (rows: (string | number)[][]) =>
  rows
    .map((r) =>
      r
        .map((v) =>
          typeof v === 'string' && /[",\n]/.test(v)
            ? `"${v.replace(/"/g, '""')}"`
            : v,
        )
        .join(','),
    )
    .join('\n') + '\n';

// 1. Coffee chain sales -------------------------------------------------------------------
{
  const r = rng(7);
  const cities = [
    ['Jakarta', 1.6],
    ['Bandung', 1.1],
    ['Bogor', 0.9],
    ['Surabaya', 1.2],
    ['Yogyakarta', 0.8],
    ['Denpasar', 0.7],
  ] as const;
  const drinks = [
    ['Kopi Susu Gula Aren', 'coffee', 28000, 3],
    ['Americano', 'coffee', 25000, 1.4],
    ['Cafe Latte', 'coffee', 32000, 1.8],
    ['Cappuccino', 'coffee', 32000, 1.2],
    ['Matcha Latte', 'non-coffee', 35000, 1.1],
    ['Es Teh Manis', 'non-coffee', 12000, 1.5],
    ['Chocolate', 'non-coffee', 30000, 0.7],
  ] as const;
  const channels = ['dine-in', 'takeaway', 'delivery'] as const;
  const rows: (string | number)[][] = [
    [
      'date',
      'city',
      'drink',
      'category',
      'size',
      'channel',
      'quantity',
      'unit_price_idr',
      'revenue_idr',
    ],
  ];
  const start = Date.UTC(2024, 0, 1);
  for (let d = 0; d < 731; d++) {
    const t = start + d * day;
    const dow = new Date(t).getUTCDay();
    const growth = 1 + d / 900;
    const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
    const ramadan = d >= 70 && d < 100 ? 0.75 : d >= 435 && d < 465 ? 0.75 : 1;
    for (const [city, cw] of cities) {
      const orders = Math.round(
        (0.7 + r() * 1.1) * cw * growth * weekend * ramadan,
      );
      for (let o = 0; o < orders; o++) {
        let pick = r() * drinks.reduce((s, x) => s + x[3], 0);
        let drink: (typeof drinks)[number] = drinks[0];
        for (const x of drinks)
          if ((pick -= x[3]) <= 0) {
            drink = x;
            break;
          }
        const large = r() < 0.35;
        const qty = 1 + Math.floor(r() ** 2.5 * 6);
        const price = drink[2] + (large ? 6000 : 0);
        const channel =
          channels[r() < 0.42 ? 0 : r() < 0.55 ? 1 : 2] ?? 'dine-in';
        rows.push([
          iso(t),
          city,
          drink[0],
          drink[1],
          large ? 'large' : 'regular',
          channel,
          qty,
          price,
          qty * price,
        ]);
      }
    }
  }
  writeFileSync(join(out, 'kopi-sales.csv'), csv(rows));
  console.log('kopi-sales', rows.length - 1);
}

// 2. Bogor daily weather ------------------------------------------------------------------
{
  const r = rng(11);
  const rows: (string | number)[][] = [
    [
      'date',
      'rainfall_mm',
      'temp_max_c',
      'temp_min_c',
      'humidity_pct',
      'thunderstorm',
      'season',
    ],
  ];
  const start = Date.UTC(2020, 0, 1);
  for (let d = 0; d < 6 * 365 + 1; d++) {
    const t = start + d * day;
    const doy = (d % 365.25) / 365.25;
    // Wet season peaks around Jan; dry around Jul-Aug, but Bogor still rains a lot.
    const wet = 0.5 + 0.5 * Math.cos(doy * Math.PI * 2);
    const month = new Date(t).getUTCMonth();
    const season = month >= 4 && month <= 9 ? 'dry' : 'wet';
    const rains = r() < 0.45 + wet * 0.4;
    const rain = rains ? Math.round(r() ** 1.8 * (25 + wet * 55) * 10) / 10 : 0;
    const tmax =
      Math.round((30.5 + (1 - wet) * 2 - rain / 40 + (r() - 0.5) * 2) * 10) /
      10;
    const tmin = Math.round((21.5 + wet * 0.8 + (r() - 0.5) * 1.6) * 10) / 10;
    const hum = Math.min(
      98,
      Math.round(72 + wet * 14 + rain / 6 + (r() - 0.5) * 8),
    );
    const storm = rain > 20 && r() < 0.7 ? 'yes' : 'no';
    rows.push([iso(t), rain, tmax, tmin, hum, storm, season]);
  }
  writeFileSync(join(out, 'bogor-weather.csv'), csv(rows));
  console.log('bogor-weather', rows.length - 1);
}

// 3. Listening history --------------------------------------------------------------------
{
  const r = rng(23);
  const artists = [
    ['Hindia', 'indie pop', 2.2],
    ['Nadin Amizah', 'folk', 1.8],
    ['Reality Club', 'indie rock', 1.4],
    ['.Feast', 'rock', 1.2],
    ['Raisa', 'pop', 0.9],
    ['Tulus', 'pop', 1.5],
    ['Lomba Sihir', 'indie pop', 1.1],
    ['Ruang Sambat', 'post-rock', 0.6],
    ['Nujabes', 'jazz hop', 1.3],
    ['Bonobo', 'electronic', 1.0],
    ['Tame Impala', 'psychedelic', 1.2],
    ['Phoebe Bridgers', 'folk', 0.8],
  ] as const;
  const devices = ['phone', 'laptop', 'car', 'speaker'] as const;
  const rows: (string | number)[][] = [
    [
      'played_at',
      'hour',
      'weekday',
      'artist',
      'genre',
      'minutes_played',
      'skipped',
      'device',
    ],
  ];
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = Date.UTC(2025, 0, 1);
  const total = artists.reduce((s, a) => s + a[2], 0);
  for (let d = 0; d < 365; d++) {
    const t = start + d * day;
    const dow = new Date(t).getUTCDay();
    const n = Math.round(4 + r() * 8 + (dow === 0 || dow === 6 ? 4 : 0));
    for (let i = 0; i < n; i++) {
      const hourPick = r();
      const hour =
        hourPick < 0.25
          ? 7 + Math.floor(r() * 2)
          : hourPick < 0.55
            ? 13 + Math.floor(r() * 4)
            : 19 + Math.floor(r() * 5);
      let pick = r() * total;
      let a: (typeof artists)[number] = artists[0];
      for (const x of artists)
        if ((pick -= x[2]) <= 0) {
          a = x;
          break;
        }
      const skipped = r() < 0.18;
      const mins = skipped
        ? Math.round(r() * 0.8 * 10) / 10
        : Math.round((2.5 + r() * 3.5) * 10) / 10;
      const device =
        hour < 9 ? 'car' : (devices[Math.floor(r() * 4)] ?? 'phone');
      rows.push([
        `${iso(t)}T${String(hour).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}:00Z`,
        hour,
        wd[dow] ?? 'Mon',
        a[0],
        a[1],
        mins,
        skipped ? 'true' : 'false',
        device,
      ]);
    }
  }
  writeFileSync(join(out, 'listening.csv'), csv(rows));
  console.log('listening', rows.length - 1);
}
