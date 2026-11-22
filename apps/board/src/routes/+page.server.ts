import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const WORDS = [
  'amber',
  'birch',
  'cedar',
  'delta',
  'ember',
  'fjord',
  'grove',
  'harbor',
  'iris',
  'juniper',
  'kelp',
  'lumen',
  'maple',
  'nova',
  'orchid',
  'pebble',
  'quartz',
  'river',
  'sage',
  'tide',
  'umber',
  'vale',
  'willow',
  'zephyr',
];
const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];

export const prerender = false;

/** A form action, so "Start a board" works even before JavaScript loads. */
export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const slug = `${pick()}-${pick()}-${Math.random().toString(36).slice(2, 6)}`;
    const seed = form.get('seed') === 'on' ? '?seed=retro' : '';
    redirect(303, `/b/${slug}${seed}`);
  },
};
