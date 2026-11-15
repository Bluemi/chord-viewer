import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

interface Config {
	password: string;
	dataDir: string;
	title: string;
}

const configPath = path.resolve(process.env.CHORD_VIEWER_CONFIG ?? 'config.json');

function load(): Config {
	if (!fs.existsSync(configPath)) {
		throw new Error(
			`Config file not found: ${configPath} (copy config.example.json to config.json)`
		);
	}
	const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	if (typeof raw.password !== 'string' || !raw.password) {
		throw new Error(`"password" missing in ${configPath}`);
	}
	return {
		password: raw.password,
		dataDir: path.resolve(path.dirname(configPath), raw.dataDir ?? './data'),
		title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Chord Viewer'
	};
}

export const config = load();
/** SHA-256(password); the HMAC key shared with the client. */
export const passwordKey = createHash('sha256').update(config.password).digest();
export const audioDir = path.join(config.dataDir, 'audio');
fs.mkdirSync(audioDir, { recursive: true });
