import { browser } from '$app/environment';

export type Theme = 'system' | 'light' | 'dark';

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string | null) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		/* storage unavailable */
	}
}

class Preferences {
	theme = $state<Theme>('system');
	reduceMotion = $state(false);
	systemReducedMotion = $state(false);

	init() {
		if (!browser) return;
		const t = read('splitto-theme');
		this.theme = t === 'light' || t === 'dark' ? t : 'system';
		this.reduceMotion = read('splitto-reduce-motion') === 'true';
		const mq = matchMedia('(prefers-reduced-motion: reduce)');
		this.systemReducedMotion = mq.matches;
		mq.addEventListener('change', (e) => (this.systemReducedMotion = e.matches));
	}

	setTheme(theme: Theme) {
		this.theme = theme;
		write('splitto-theme', theme === 'system' ? null : theme);
		if (theme === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = theme;
	}

	setReduceMotion(value: boolean) {
		this.reduceMotion = value;
		write('splitto-reduce-motion', value ? 'true' : null);
		if (value) document.documentElement.dataset.reduceMotion = 'true';
		else delete document.documentElement.dataset.reduceMotion;
	}

	/** True when animations should be static (system setting or in-app option). */
	get motionReduced() {
		return this.reduceMotion || this.systemReducedMotion;
	}
}

export const prefs = new Preferences();
