import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ROOM = /^[a-z0-9-]{3,48}$/;

export const load: PageServerLoad = ({ params, url }) => {
  if (!ROOM.test(params.room))
    error(404, 'Board names are 3–48 lowercase letters, digits or dashes.');
  return { room: params.room, seed: url.searchParams.get('seed') === 'retro' };
};
