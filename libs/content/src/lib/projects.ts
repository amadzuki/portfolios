export interface Project {
  id: string;
  title: string;
  blurb: string;
  stack: string[];
  href?: string;
  status: 'live' | 'building' | 'planned';
}

export const projects: Project[] = [
  {
    id: 'proj-lab',
    title: 'The Lab',
    blurb:
      'Every letter of the name rendered with a different generative technique: GPU particles, instanced voxels, GLSL shaders, d3 force graphs, live contours and ASCII.',
    stack: ['three.js', 'GLSL', 'd3'],
    href: '/lab/a-attraction',
    status: 'live',
  },
  {
    id: 'proj-lumen-drift',
    title: 'Lumen Drift',
    blurb:
      'A dusk-lit WebGL flying game in plain three.js: thread light gates, gather motes, dodge iridescent shards. Custom sky, dune and post-processing shaders plus generative audio.',
    stack: ['three.js', 'GLSL', 'WebAudio', 'Vite'],
    href: 'https://game.ahmadmarzuki.com',
    status: 'live',
  },
  {
    id: 'proj-ask-ahmad',
    title: 'Ask Ahmad',
    blurb:
      'This chat. Answers questions about my work from my own profile with streamed responses and source citations, through a provider-agnostic LLM layer.',
    stack: ['Next.js', 'AI SDK', 'GLM / any LLM'],
    status: 'live',
  },
  {
    id: 'proj-prompt-ui',
    title: 'Prompt-to-UI Playground',
    blurb:
      'Describe a component, watch an LLM write React + Tailwind, and iterate on it in a live sandbox.',
    stack: ['TanStack Start', 'CodeMirror', 'sandboxed iframe'],
    status: 'planned',
  },
  {
    id: 'proj-data-chat',
    title: 'Chat with your Data',
    blurb:
      'Drop a CSV and ask questions in plain language. The model writes chart specs; your data never leaves the browser.',
    stack: ['React Router v7', 'visx', 'Web Workers'],
    status: 'planned',
  },
  {
    id: 'proj-saikou',
    title: 'saikou',
    blurb:
      'A social network for anime and manga fans, built front to back on the MERN stack.',
    stack: ['MongoDB', 'Express', 'React', 'Node.js'],
    href: 'https://saikou.ahmadmarzuki.com',
    status: 'live',
  },
];
