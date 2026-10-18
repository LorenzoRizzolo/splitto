import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
	it('blocks after the limit and frees up after the window', () => {
		const rl = new RateLimiter(2, 1000);
		expect(rl.hit('k', 0).allowed).toBe(true);
		expect(rl.hit('k', 100).allowed).toBe(true);
		const blocked = rl.hit('k', 200);
		expect(blocked).toEqual({ allowed: false, retryAfterSec: 1 });
		expect(rl.hit('other', 200).allowed).toBe(true);
		expect(rl.hit('k', 1001).allowed).toBe(true);
	});

	it('can be reset after a successful login', () => {
		const rl = new RateLimiter(1, 1000);
		rl.hit('k', 0);
		rl.reset('k');
		expect(rl.hit('k', 1).allowed).toBe(true);
	});
});
