import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	setSessionCookie,
	validateSessionToken
} from '$lib/server/auth/session';
import { startJobs } from '$lib/server/jobs';
import { INDEXABLE_PATHS } from '$lib/seo';

export const init: ServerInit = () => {
	if (!building) startJobs();
};

const auth: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = null;
	event.locals.session = null;
	if (token) {
		const result = validateSessionToken(token);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
			if (result.renewed) setSessionCookie(event.cookies, token, result.session.expiresAt);
		} else {
			deleteSessionCookie(event.cookies);
		}
	}
	return resolve(event);
};

const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

const guard: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const user = event.locals.user;
	if ((path === '/app' || path.startsWith('/app/')) && !user) {
		// Requests without a session never reach the route (form posts are redirected too).
		const redirectTo = event.request.method === 'GET' ? path + event.url.search : path;
		redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}
	if (user && AUTH_PAGES.includes(path) && event.request.method === 'GET') redirect(303, '/app');
	return resolve(event);
};

const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const h = response.headers;
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	h.set('X-Frame-Options', 'DENY');
	h.set('Cross-Origin-Opener-Policy', 'same-origin');
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	// Only the public pages may show up in search results (robots.txt and sitemap.xml are
	// not HTML, so the header is harmless there too).
	if (!(INDEXABLE_PATHS as readonly string[]).includes(event.url.pathname)) {
		h.set('X-Robots-Tag', 'noindex');
	}
	// Pages under /app contain personal data: never let shared caches store them.
	if (event.url.pathname.startsWith('/app') && !h.has('Cache-Control')) {
		h.set('Cache-Control', 'private, no-store');
	}
	return response;
};

export const handle = sequence(auth, guard, securityHeaders);
