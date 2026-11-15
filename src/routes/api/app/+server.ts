import { json } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';

/** Public app metadata (needed before login and while offline). */
export const GET = () => json({ title: config.title, statuses: config.statuses });
