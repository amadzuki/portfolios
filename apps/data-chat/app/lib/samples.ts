export interface Sample {
  id: string;
  file: string;
  name: string;
  blurb: string;
  rows: string;
  questions: string[];
}

/** Synthetic datasets (see scripts/make-samples.ts), so anyone can try it without a file. */
export const SAMPLES: Sample[] = [
  {
    id: 'kopi-sales',
    file: '/samples/kopi-sales.csv',
    name: 'Kopi sales',
    blurb:
      'Two years of orders across six coffee shops in Indonesia, with a dip every Ramadan.',
    rows: '8.7k rows · 9 columns',
    questions: [
      'Monthly revenue by city',
      'Which drinks bring in the most revenue?',
      'Share of orders by channel',
      'Average quantity per order by drink in Bogor',
    ],
  },
  {
    id: 'bogor-weather',
    file: '/samples/bogor-weather.csv',
    name: 'Bogor weather',
    blurb:
      'Six years of daily rain, temperature and humidity in the City of Rain.',
    rows: '2.2k rows · 7 columns',
    questions: [
      'Total rainfall per month',
      'Rainfall vs humidity',
      'How many thunderstorm days each year?',
      'Average max temperature by season',
    ],
  },
  {
    id: 'listening',
    file: '/samples/listening.csv',
    name: 'Listening history',
    blurb: 'A year of plays: artists, genres, skips and the hour of day.',
    rows: '3.3k rows · 8 columns',
    questions: [
      'Top 5 artists by minutes played',
      'Plays by hour of day',
      'Skip rate by genre',
      'Weekly minutes played by device',
    ],
  },
];

export const getSample = (id: string) => SAMPLES.find((s) => s.id === id);
