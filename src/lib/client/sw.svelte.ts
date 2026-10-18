import { browser, dev } from '$app/environment';
import { env } from '$env/dynamic/public';

// Service worker registration and update flow.
// - A new worker is never activated automatically: it waits until the user clicks "Aggiorna".
// - On click we post SKIP_WAITING; on `controllerchange` the page reloads exactly once.

class ServiceWorkerState {
	/** A new version is installed and waiting for the user's consent. */
	waiting = $state<ServiceWorker | null>(null);
	registration = $state<ServiceWorkerRegistration | null>(null);
	accepted = false;
}

export const sw = new ServiceWorkerState();

function trackInstalling(reg: ServiceWorkerRegistration) {
	const worker = reg.installing;
	if (!worker) return;
	worker.addEventListener('statechange', () => {
		// Only an *update* (there is already a controller) needs the banner.
		if (worker.state === 'installed' && navigator.serviceWorker.controller) sw.waiting = worker;
	});
}

export async function registerServiceWorker() {
	if (!browser || !('serviceWorker' in navigator)) return;

	if (dev && env.PUBLIC_SW_IN_DEV !== 'true') {
		// Avoid "ghost" caches while developing.
		const regs = await navigator.serviceWorker.getRegistrations();
		await Promise.all(regs.map((r) => r.unregister()));
		return;
	}

	if (/[?&]logout(=|&|$)/.test(location.search)) await clearUserCaches();

	try {
		const reg = await navigator.serviceWorker.register('/service-worker.js', {
			type: dev ? 'module' : 'classic',
			updateViaCache: 'none'
		});
		sw.registration = reg;
		if (reg.waiting && navigator.serviceWorker.controller) sw.waiting = reg.waiting;
		reg.addEventListener('updatefound', () => trackInstalling(reg));

		navigator.serviceWorker.addEventListener('controllerchange', () => {
			// Reload once, and only when the user asked for the update.
			if (!sw.accepted || sessionStorage.getItem('splitto-sw-reloaded') === '1') return;
			sessionStorage.setItem('splitto-sw-reloaded', '1');
			location.reload();
		});
		sessionStorage.removeItem('splitto-sw-reloaded');

		const check = () => reg.update().catch(() => {});
		setInterval(check, 60 * 60 * 1000);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') check();
		});
	} catch (err) {
		console.warn('Service worker registration failed', err);
	}
}

/** Whether a tracked form has unsaved input (used to warn before reloading). */
export function hasDirtyForm(): boolean {
	return !!document.querySelector('form[data-dirty="true"]');
}

export async function applyUpdate() {
	if (hasDirtyForm() && !confirm('Hai dati non salvati in un modulo. Aggiornare comunque?')) return;
	sw.accepted = true;
	if (sw.waiting) {
		sw.waiting.postMessage({ type: 'SKIP_WAITING' });
		return;
	}
	// New server version detected but no waiting worker (e.g. SW disabled): plain reload.
	await sw.registration?.update().catch(() => {});
	location.reload();
}

/** Removes cached personal data (called after logout). */
export async function clearUserCaches() {
	navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_DATA' });
	if ('caches' in window) {
		const keys = await caches.keys();
		await Promise.all(
			keys.filter((k) => k.startsWith('splitto-pages')).map((k) => caches.delete(k))
		);
	}
}

/** Svelte action: marks a form as dirty on input and clean on submit. */
export function trackDirty(form: HTMLFormElement) {
	const onInput = () => (form.dataset.dirty = 'true');
	const onSubmit = () => delete form.dataset.dirty;
	form.addEventListener('input', onInput);
	form.addEventListener('submit', onSubmit);
	return {
		destroy() {
			form.removeEventListener('input', onInput);
			form.removeEventListener('submit', onSubmit);
		}
	};
}
