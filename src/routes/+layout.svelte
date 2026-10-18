<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import Toaster from '$lib/components/ui/Toaster.svelte';
	import CoinLoader from '$lib/components/ui/CoinLoader.svelte';
	import UpdateBanner from '$lib/components/pwa/UpdateBanner.svelte';
	import OfflineBanner from '$lib/components/pwa/OfflineBanner.svelte';
	import { prefs } from '$lib/client/preferences.svelte';
	import { network } from '$lib/client/network.svelte';
	import { registerServiceWorker } from '$lib/client/sw.svelte';

	let { data, children } = $props();

	onMount(() => {
		prefs.init();
		network.init();
		// The account-level "Riduci animazioni" setting wins on any device the user logs in from.
		if (data.user?.reduceMotion && !prefs.reduceMotion) prefs.setReduceMotion(true);
		registerServiceWorker();
		// Marker used by end-to-end tests to know enhanced forms are live.
		document.body.dataset.hydrated = 'true';
	});

	// Page transitions with the View Transitions API (skipped when unsupported or motion is reduced).
	onNavigate((navigation) => {
		if (!document.startViewTransition || prefs.motionReduced) return;
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<a
	href="#main"
	class="sr-only z-50 rounded-full bg-brand-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>Vai al contenuto</a
>
<OfflineBanner online={network.online} />
<UpdateBanner />
<CoinLoader />
{@render children()}
<Toaster />
