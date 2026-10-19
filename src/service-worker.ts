/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Versioned caches: every deploy gets new names, old ones are removed on activate.
const ASSETS_CACHE = `splitto-cache-${version}`;
// The signed-in user's own pages, for read-only offline use. Cleared at logout.
const PAGES_CACHE = `splitto-pages-${version}`;
const OFFLINE_URL = '/offline';

const ASSETS = [
	...build,
	...files.filter((f) => !f.startsWith('/screenshots/') && f !== '/og-image.png'),
	...prerendered
];
const ASSET_SET = new Set(ASSETS);

// Pages that may be cached for offline reading (only GET, only the current user's own views).
const OFFLINE_READABLE =
	/^\/app(\/(groups(\/[^/]+(\/(balances|stats))?)?|friends(\/[^/]+)?|activity))?\/?(__data\.json)?$/;
// Never cached: auth flows, invites, API, private files, exports.
const NEVER_CACHE =
	/^\/(login|register|logout|forgot-password|reset-password|invite)|^\/app\/(api|avatars)\/|\/receipt$|\.csv$/;

sw.addEventListener('install', (event) => {
	// No skipWaiting() here: a new version waits until the user clicks "Aggiorna",
	// so an open page never mixes assets from two different builds.
	event.waitUntil(caches.open(ASSETS_CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== ASSETS_CACHE && key !== PAGES_CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	const type = (event.data as { type?: string } | null)?.type;
	if (type === 'SKIP_WAITING') sw.skipWaiting();
	if (type === 'CLEAR_USER_DATA') event.waitUntil(caches.delete(PAGES_CACHE));
});

function cacheKey(url: URL): string {
	// SvelteKit data requests carry volatile query params: key them by path only.
	return url.pathname.endsWith('/__data.json') ? url.origin + url.pathname : url.href;
}

async function networkFirstPage(request: Request, url: URL): Promise<Response> {
	const isData = url.pathname.endsWith('/__data.json');
	const cacheable = OFFLINE_READABLE.test(url.pathname) && !url.search.includes('/');
	try {
		const response = await fetch(request);
		// Redirected responses (e.g. to /login) are never stored under an /app key.
		if (
			cacheable &&
			response.ok &&
			response.status === 200 &&
			response.type === 'basic' &&
			!response.redirected
		) {
			const cache = await caches.open(PAGES_CACHE);
			await cache.put(cacheKey(url), response.clone());
		}
		return response;
	} catch {
		const cached = cacheable ? await caches.match(cacheKey(url)) : undefined;
		if (cached) return cached;
		if (isData) return new Response('offline', { status: 503 });
		return (
			(await caches.match(OFFLINE_URL)) ??
			new Response('Sei offline', {
				status: 503,
				headers: { 'content-type': 'text/plain; charset=utf-8' }
			})
		);
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return; // never touch form actions or other writes
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	if (NEVER_CACHE.test(url.pathname)) return;

	// Hashed build assets and static files: cache-first.
	if (ASSET_SET.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
		return;
	}

	const isNavigation = request.mode === 'navigate';
	const isData = url.pathname.endsWith('/__data.json');
	if (isNavigation || isData) {
		event.respondWith(networkFirstPage(request, url));
	}
});

// --- Push notifications -----------------------------------------------------------------------

sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string; tag?: string };
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'Splitto', {
			body: data.body ?? '',
			icon: '/icons/icon-192.png',
			badge: '/icons/maskable-192.png',
			tag: data.tag,
			lang: 'it',
			data: { url: data.url ?? '/app' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(
		(event.notification.data as { url?: string })?.url ?? '/app',
		sw.location.origin
	).href;
	event.waitUntil(
		(async () => {
			const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			// Prefer a window already on that URL, then any open Splitto window.
			const exact = windows.find((w) => w.url === target);
			if (exact) return exact.focus();
			const any = windows[0];
			if (any) {
				await any.focus();
				return any.navigate(target);
			}
			return sw.clients.openWindow(target);
		})()
	);
});
