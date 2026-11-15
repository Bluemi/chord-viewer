import { config } from '#lib/server/config.ts';

export const load = () => ({ appTitle: config.title });
