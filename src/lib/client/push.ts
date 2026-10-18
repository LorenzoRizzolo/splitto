import { isStandalone } from './install.svelte';

export type PushSupport = 'supported' | 'unsupported' | 'ios-needs-install' | 'denied' | 'no-sw';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

export function pushSupport(): PushSupport {
	const isIOS =
		/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	if (isIOS && !isStandalone()) return 'ios-needs-install';
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
		return 'unsupported';
	if (Notification.permission === 'denied') return 'denied';
	return 'supported';
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	const reg = await navigator.serviceWorker.getRegistration();
	return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Must be called from a user gesture (click): asks permission and subscribes this device. */
export async function enablePush(
	vapidPublicKey: string
): Promise<'ok' | 'denied' | 'no-sw' | 'error'> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return 'denied';
	const reg = await navigator.serviceWorker.getRegistration();
	if (!reg) return 'no-sw';
	try {
		const sub =
			(await reg.pushManager.getSubscription()) ??
			(await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
			}));
		const res = await fetch('/app/api/push?test', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(sub.toJSON())
		});
		return res.ok ? 'ok' : 'error';
	} catch {
		return 'error';
	}
}

export async function disablePush() {
	const sub = await currentSubscription();
	if (!sub) return;
	await fetch('/app/api/push', {
		method: 'DELETE',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ endpoint: sub.endpoint })
	});
	await sub.unsubscribe();
}
