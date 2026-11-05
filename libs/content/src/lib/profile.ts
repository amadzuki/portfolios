/** Source of truth for who Ahmad is. Used by the website and as the Ask Ahmad knowledge base. */

export interface Role {
  id: string;
  company: string;
  title: string;
  start: string;
  end: string | null;
  location: string;
  summary: string;
  highlights: string[];
  tech?: string[];
  link?: string;
}

export const profile = {
  name: 'Ahmad Marzuki',
  headline: 'Senior Software Engineer',
  company: 'Trans Optima Perkasa',
  location: 'Bogor, West Java, Indonesia',
  email: 'contact@ahmadmarzuki.com',
  website: 'https://ahmadmarzuki.com',
  github: 'https://github.com/amadzuki',
  linkedin: 'https://www.linkedin.com/in/amadzuki',
  summary:
    'Frontend-focused software engineer working with JavaScript, TypeScript, React, Next.js and Redux, comfortable on the backend with Node.js, Express, MongoDB and PostgreSQL. Spent five years at ProSpace shipping and maintaining production web apps across several concurrent projects, and now works as a Senior Software Engineer at Trans Optima Perkasa. Cares about efficiency, problem solving and learning fast, and keeps experimenting with new tools.',
  topSkills: [
    'Next.js',
    'React',
    'TypeScript',
    'Monorepos',
    'Supabase',
    'Node.js',
    'PostgreSQL',
  ],
} as const;

export const experience: Role[] = [
  {
    id: 'exp-trans-optima',
    company: 'Trans Optima Perkasa',
    title: 'Senior Software Engineer',
    start: '2026-09',
    end: null,
    location: 'Jakarta, Indonesia',
    summary:
      'Recently joined Trans Optima Perkasa as a Senior Software Engineer.',
    highlights: [],
  },
  {
    id: 'exp-prospace',
    company: 'ProSpace',
    title: 'Frontend Developer',
    start: '2021-11',
    end: '2026-10',
    location: 'Singapore (remote)',
    summary:
      'Five years building and maintaining production frontends, from the company website to large long-running products.',
    highlights: [
      'Built the company website with a modern stack, plus marketing tooling for SEO adjustments and strategy.',
      'Maintained a large project, performing upgrades for better performance while continuously shipping new features.',
      'Managed 4 concurrent projects and delivered them to production on time.',
    ],
    tech: ['React', 'Next.js', 'TypeScript', 'Redux'],
  },
  {
    id: 'exp-grosirparts',
    company: 'GrosirParts Motor',
    title: 'Software Engineer',
    start: '2020-12',
    end: '2021-10',
    location: 'Indonesia',
    summary:
      'Built a new marketplace platform for automotive parts end to end.',
    highlights: ['Frontend in Next.js, backend in Node.js with PostgreSQL.'],
    tech: ['Next.js', 'Node.js', 'PostgreSQL'],
  },
  {
    id: 'exp-freelance',
    company: 'Freelance',
    title: 'Freelance Web Developer',
    start: '2020-08',
    end: '2020-12',
    location: 'Jakarta, Indonesia',
    summary:
      'Built saikou, a social network for anime and manga fans, front to back on the MERN stack.',
    highlights: [],
    tech: ['MongoDB', 'Express', 'React', 'Node.js'],
    link: 'https://saikou.ahmadmarzuki.com',
  },
  {
    id: 'exp-catamyst',
    company: 'Catamyst',
    title: 'Frontend Web Developer',
    start: '2020-01',
    end: '2020-08',
    location: 'Remote',
    summary: 'Developed a social media platform for Japanese pop culture.',
    highlights: [],
  },
];

/** Life before software, condensed. */
export const earlier = {
  id: 'earlier',
  summary:
    'Before software Ahmad studied Materials Engineering at Institut Teknologi Bandung (B.E., 2011–2016), interned at PT Timah analysing jaw-crusher wear as a materials engineer, managed CSR programmes at elcorps (2017), ran two e-commerce businesses selling local clothing and exporting Indonesian crafts like batik through Amazon FBA (2018–2019), and tutored chemistry for junior and senior high-school students (2019–2020).',
};

export const education = {
  id: 'education',
  items: [
    {
      school: 'Institut Teknologi Bandung (ITB)',
      detail: 'Bachelor of Engineering, Materials Engineering',
      years: '2011–2016',
    },
    { school: 'Catamyst', detail: 'Full Stack Web Development', years: '2020' },
    {
      school: 'Open Source Society University',
      detail: 'Self-directed computer science curriculum',
      years: '',
    },
  ],
};

/** Formats "2021-11" as "Nov 2021". */
export function formatMonth(ym: string | null): string {
  if (!ym) return 'Present';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
