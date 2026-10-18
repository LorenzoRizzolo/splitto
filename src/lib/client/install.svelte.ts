import { browser } from '$app/environment';

// Install ("Add to Home screen") support across browsers. Detection runs client-side only.

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
	interface Window {
		__splittoInstallPrompt?: BeforeInstallPromptEvent;
	}
	interface Navigator {
		standalone?: boolean;
	}
}

export type Platform =
	| 'prompt' // Chromium browsers with beforeinstallprompt (Chrome, Edge, Samsung Internet, Opera)
	| 'ios' // Safari on iPhone/iPad: Share → Add to Home Screen
	| 'ios-other' // Other iOS browsers (Chrome/Firefox on iOS: Share menu since iOS 16.4)
	| 'mac-safari' // File → Add to Dock
	| 'firefox-android'
	| 'firefox-desktop'
	| 'chromium-manual' // Chromium without a captured prompt (e.g. already dismissed): browser menu
	| 'unknown';

export function detectPlatform(): Platform {
	const ua = navigator.userAgent;
	const isIOS =
		/iPad|iPhone|iPod/.test(ua) ||
		(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	const isFirefox = /Firefox|FxiOS/.test(ua);
	const isSafari =
		/Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS|EdgiOS|SamsungBrowser/.test(ua);
	if (isIOS) return isSafari ? 'ios' : 'ios-other';
	if (isFirefox) return /Android/.test(ua) ? 'firefox-android' : 'firefox-desktop';
	if (isSafari && /Macintosh/.test(ua)) return 'mac-safari';
	if (/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua)) return 'chromium-manual';
	return 'unknown';
}

export function isStandalone(): boolean {
	return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

class InstallState {
	ready = $state(false);
	installed = $state(false);
	platform = $state<Platform>('unknown');
	private deferred: BeforeInstallPromptEvent | null = null;

	init() {
		if (!browser || this.ready) return;
		this.installed = isStandalone();
		this.platform = detectPlatform();
		const pick = () => {
			if (window.__splittoInstallPrompt) {
				this.deferred = window.__splittoInstallPrompt;
				this.platform = 'prompt';
			}
		};
		pick();
		addEventListener('splitto:installable', pick);
		addEventListener('appinstalled', () => {
			this.installed = true;
			this.deferred = null;
			window.__splittoInstallPrompt = undefined;
		});
		matchMedia('(display-mode: standalone)').addEventListener(
			'change',
			(e) => (this.installed = e.matches)
		);
		this.ready = true;
	}

	/** Shows the native prompt when possible. Returns false when manual instructions are needed. */
	async prompt(): Promise<'accepted' | 'dismissed' | 'manual'> {
		if (!this.deferred) return 'manual';
		const ev = this.deferred;
		await ev.prompt();
		const choice = await ev.userChoice;
		// A prompt event can be used only once.
		this.deferred = null;
		window.__splittoInstallPrompt = undefined;
		if (choice.outcome === 'dismissed') this.platform = detectPlatform();
		return choice.outcome;
	}
}

export const install = new InstallState();
