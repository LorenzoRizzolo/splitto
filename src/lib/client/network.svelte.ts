import { browser } from '$app/environment';

class Network {
	online = $state(true);

	init() {
		if (!browser) return;
		this.online = navigator.onLine;
		addEventListener('online', () => (this.online = true));
		addEventListener('offline', () => (this.online = false));
	}
}

export const network = new Network();
