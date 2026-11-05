import { profile } from '@portfolios/content';

export const site = {
  name: profile.name,
  url: profile.website,
  role: profile.headline,
  tagline:
    'Frontend engineer who builds fast, polished web products, and occasionally makes them glow in 3D.',
  email: profile.email,
  socials: [
    { label: 'GitHub', href: profile.github },
    { label: 'LinkedIn', href: profile.linkedin },
  ],
};
