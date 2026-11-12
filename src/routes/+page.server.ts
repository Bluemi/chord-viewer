import { listSongs } from '#lib/server/db.ts';

export const load = () => ({ songs: listSongs() });
