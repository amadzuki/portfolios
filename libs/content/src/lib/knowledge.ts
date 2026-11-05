import {
  earlier,
  education,
  experience,
  formatMonth,
  profile,
} from './profile';
import { projects } from './projects';

export interface KnowledgeDoc {
  id: string;
  title: string;
  /** Where the source lives on the site, for citation links. */
  href: string;
  text: string;
}

/** The profile flattened into citable documents. Small enough to fit in a prompt whole. */
export function knowledgeBase(): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = [
    {
      id: 'about',
      title: 'About',
      href: '/#about',
      text: `${profile.name} is a ${profile.headline} at ${profile.company}, based in ${profile.location}. ${profile.summary} Top skills: ${profile.topSkills.join(', ')}. Contact: ${profile.email}. GitHub: ${profile.github}. LinkedIn: ${profile.linkedin}.`,
    },
    ...experience.map((r) => ({
      id: r.id,
      title: `${r.title}, ${r.company}`,
      href: `/#${r.id}`,
      text: [
        `${r.title} at ${r.company} (${formatMonth(r.start)} – ${formatMonth(r.end)}, ${r.location}).`,
        r.summary,
        ...r.highlights,
        r.tech ? `Tech: ${r.tech.join(', ')}.` : '',
        r.link ? `Link: ${r.link}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    })),
    {
      id: earlier.id,
      title: 'Before software',
      href: '/#earlier',
      text: earlier.summary,
    },
    {
      id: education.id,
      title: 'Education',
      href: '/#earlier',
      text: education.items
        .map(
          (e) => `${e.detail}, ${e.school}${e.years ? ` (${e.years})` : ''}.`,
        )
        .join(' '),
    },
    ...projects.map((p) => ({
      id: p.id,
      title: p.title,
      href: '/#work',
      text: `Project "${p.title}" (${p.status}): ${p.blurb} Stack: ${p.stack.join(', ')}.${p.href ? ` Link: ${p.href}` : ''}`,
    })),
  ];
  return docs;
}

/** Renders the knowledge base for a system prompt, each doc tagged with its citation id. */
export function knowledgeContext(docs = knowledgeBase()): string {
  return docs.map((d) => `[${d.id}] ${d.title}\n${d.text}`).join('\n\n');
}

export type Segment =
  { type: 'text'; text: string } | { type: 'cite'; doc: KnowledgeDoc };

/** Splits model output into text and citation chips, dropping unknown or repeated ids. */
export function parseCitations(
  text: string,
  docs = knowledgeBase(),
): Segment[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const out: Segment[] = [];
  const re = /\[([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const ids = m[1].split(',').map((s) => s.trim());
    const found = ids
      .map((id) => byId.get(id))
      .filter((d): d is KnowledgeDoc => !!d);
    if (!found.length) continue;
    if (m.index > last)
      out.push({ type: 'text', text: text.slice(last, m.index) });
    for (const doc of found) out.push({ type: 'cite', doc });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}
