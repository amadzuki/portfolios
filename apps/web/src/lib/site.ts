export const site = {
  name: 'Ahmad Marzuki',
  url: 'https://ahmadmarzuki.com',
  role: 'Frontend Engineer',
  tagline:
    'I build interfaces that move: typed, tested, and occasionally in 3D.',
  email: 'hello@ahmadmarzuki.com',
  socials: [
    { label: 'GitHub', href: 'https://github.com/amadzuki' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/amadzuki' },
  ],
};

export interface Project {
  title: string;
  blurb: string;
  stack: string[];
  href?: string;
  status: 'live' | 'building' | 'planned';
}

export const projects: Project[] = [
  {
    title: 'Ask Ahmad',
    blurb:
      'A RAG chat that answers questions about my work from my own writing, with streamed answers and citations.',
    stack: ['Next.js', 'AI SDK', 'embeddings'],
    status: 'building',
  },
  {
    title: 'Prompt-to-UI Playground',
    blurb:
      'Describe a component, watch an LLM write React + Tailwind, and iterate on it in a live sandbox.',
    stack: ['TanStack Start', 'CodeMirror', 'sandboxed iframe'],
    status: 'planned',
  },
  {
    title: 'Chat with your Data',
    blurb:
      'Drop a CSV and ask questions in plain language. The model writes chart specs; your data never leaves the browser.',
    stack: ['React Router v7', 'visx', 'Web Workers'],
    status: 'planned',
  },
  {
    title: 'The Lab',
    blurb:
      'Every letter of my name rendered with a different generative technique: particles, voxels, shaders, force graphs.',
    stack: ['three.js', 'GLSL', 'd3'],
    href: '/lab/a-attraction',
    status: 'live',
  },
];
