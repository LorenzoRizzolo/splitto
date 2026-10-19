<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { currentSubscription, enablePush, pushSupport } from '$lib/client/push';
	import { toasts } from '$lib/client/toast.svelte';
	import Icon from '../ui/Icon.svelte';

	let { vapidPublicKey }: { vapidPublicKey: string } = $props();

	const DISMISS_KEY = 'splitto-push-banner-dismissed';

	let visible = $state(false);
	let busy = $state(false);

	// Shown only when push is available here and this device isn't subscribed yet.
	onMount(async () => {
		if (!vapidPublicKey || pushSupport() !== 'supported') return;
		try {
			if (localStorage.getItem(DISMISS_KEY)) return;
		} catch {
			/* storage unavailable */
		}
		visible = !(await currentSubscription());
	});

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(DISMISS_KEY, '1');
		} catch {
			/* storage unavailable */
		}
	}

	// Permission is requested only after this explicit click.
	async function enable() {
		busy = true;
		try {
			const r = await enablePush(vapidPublicKey);
			if (r === 'ok') {
				visible = false;
				toasts.success('Notifiche attivate');
			} else if (r === 'denied') {
				visible = false;
				toasts.error('Permesso negato: puoi riattivarlo dalle impostazioni del browser');
			} else if (r === 'no-sw')
				toasts.error("Ricarica la pagina e riprova (l'app non è ancora pronta)");
			else toasts.error('Non è stato possibile attivare le notifiche');
		} finally {
			busy = false;
		}
	}
</script>

{#if visible}
	<div
		transition:slide={{ duration: 200 }}
		class="card mb-6 flex flex-wrap items-center gap-3 p-3 pl-4 sm:flex-nowrap"
		role="region"
		aria-label="Attiva notifiche"
	>
		<Icon name="bell" class="shrink-0 text-brand-600" />
		<p class="min-w-0 flex-1 text-sm">
			<span class="block font-semibold">Attiva le notifiche</span>
			<span class="block text-ink-muted"
				>Scopri subito quando qualcuno aggiunge una spesa o ti salda un debito.</span
			>
		</p>
		<div class="flex items-center gap-1">
			<button type="button" class="btn-primary min-h-11 px-4" disabled={busy} onclick={enable}>
				{busy ? 'Attivazione…' : 'Attiva'}
			</button>
			<button
				type="button"
				class="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-3"
				aria-label="Non ora"
				onclick={dismiss}
			>
				<Icon name="x" size={18} />
			</button>
		</div>
	</div>
{/if}
