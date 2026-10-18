import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { resolve } from 'node:path';

function int(value: string | undefined, fallback: number): number {
	const n = Number.parseInt(value ?? '', 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Server configuration, read lazily from the environment (see .env.example). */
export const config = {
	get origin() {
		return (env.ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
	},
	get sessionDays() {
		return int(env.SESSION_DAYS, 30);
	},
	get cookieSecure() {
		if (env.COOKIE_SECURE === 'false') return false;
		return !dev;
	},
	get uploadDir() {
		return resolve(env.UPLOAD_DIR || './data/uploads');
	},
	get uploadMaxBytes() {
		return int(env.UPLOAD_MAX_MB, 5) * 1024 * 1024;
	},
	get vapid() {
		return {
			publicKey: env.VAPID_PUBLIC_KEY || '',
			privateKey: env.VAPID_PRIVATE_KEY || '',
			subject: env.VAPID_SUBJECT || 'mailto:admin@example.com'
		};
	},
	get jobsEnabled() {
		return env.JOBS_ENABLED !== 'false';
	}
};
