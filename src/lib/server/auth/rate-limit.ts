// Simple in-memory sliding-window rate limiter. Good enough for a single Node process; swap
// for a shared store (e.g. Redis) if the app is ever scaled horizontally.

export class RateLimiter {
	private hits = new Map<string, number[]>();

	constructor(
		private readonly limit: number,
		private readonly windowMs: number
	) {}

	/** Records an attempt. Returns whether it is allowed and, if not, when to retry. */
	hit(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
		const from = now - this.windowMs;
		const list = (this.hits.get(key) ?? []).filter((t) => t > from);
		if (list.length >= this.limit) {
			this.hits.set(key, list);
			return { allowed: false, retryAfterSec: Math.ceil((list[0]! + this.windowMs - now) / 1000) };
		}
		list.push(now);
		this.hits.set(key, list);
		if (this.hits.size > 10_000) this.prune(now);
		return { allowed: true, retryAfterSec: 0 };
	}

	reset(key: string) {
		this.hits.delete(key);
	}

	prune(now = Date.now()) {
		const from = now - this.windowMs;
		for (const [key, list] of this.hits) {
			const kept = list.filter((t) => t > from);
			if (kept.length === 0) this.hits.delete(key);
			else this.hits.set(key, kept);
		}
	}
}

const MIN = 60_000;
// RATE_LIMIT_SCALE multiplies every limit (e.g. 100 in end-to-end tests). Default 1.
const scale = Math.max(1, Number(process.env.RATE_LIMIT_SCALE) || 1);
export const limiters = {
	/** Per IP + email: brute force on a single account. */
	loginAccount: new RateLimiter(5 * scale, 15 * MIN),
	/** Per IP: credential stuffing across accounts. */
	loginIp: new RateLimiter(30 * scale, 15 * MIN),
	register: new RateLimiter(5 * scale, 60 * MIN),
	passwordReset: new RateLimiter(3 * scale, 60 * MIN)
};

export function retryMessage(retryAfterSec: number): string {
	const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
	return `Troppi tentativi. Riprova tra ${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}.`;
}
