<script lang="ts">
	import { onMount } from 'svelte';
	import {
		currentSubscription,
		disablePush,
		enablePush,
		pushSupport,
		type PushSupport
	} from '$lib/client/push';
	import { toasts } from '$lib/client/toast.svelte';
	import InstallButton from './InstallButton.svelte';

	let { vapidPublicKey }: { vapidPublicKey: string } = $props();

	let support = $state<PushSupport | null>(null);
	let enabled = $state(false);
	let busy = $state(false);

	onMount(async () => {
		support = pushSupport();
		if (support === 'supported') enabled = !!(await currentSubscription());
	});

	// Permission is requested only here, after an explicit click — never on page load.
	async function toggle() {
		busy = true;
		try {
			if (enabled) {
				await disablePush();
				enabled = false;
				toasts.success('Notifiche disattivate su questo dispositivo');
			} else {
				const r = await enablePush(vapidPublicKey);
				if (r === 'ok') {
					enabled = true;
					toasts.success('Notifiche attivate');
				} else if (r === 'denied') {
					support = pushSupport();
					toasts.error('Permesso negato: puoi riattivarlo dalle impostazioni del browser');
				} else if (r === 'no-sw')
					toasts.error("Ricarica la pagina e riprova (l'app non è ancora pronta)");
				else toasts.error('Non è stato possibile attivare le notifiche');
			}
		} finally {
			busy = false;
		}
	}
</script>

{#if !vapidPublicKey}
	<p class="text-sm text-ink-muted">Le notifiche push non sono configurate su questo server.</p>
{:else if support === null}
	<p class="text-sm text-ink-muted">Verifica del supporto…</p>
{:else if support === 'ios-needs-install'}
	<div class="rounded-xl bg-surface-2 p-3 text-sm">
		<p class="mb-2">
			Su iPhone e iPad le notifiche funzionano solo se installi Splitto nella schermata Home (iOS
			16.4 o successivo).
		</p>
		<InstallButton label="Come installare" />
	</div>
{:else if support === 'unsupported'}
	<p class="text-sm text-ink-muted">Questo browser non supporta le notifiche push.</p>
{:else if support === 'denied'}
	<p class="text-sm text-ink-muted">
		Hai bloccato le notifiche per Splitto: riattivale dalle impostazioni del sito nel browser.
	</p>
{:else}
	<label class="flex min-h-11 cursor-pointer items-center justify-between gap-3">
		<span>
			<span class="block font-medium">Notifiche su questo dispositivo</span>
			<span class="block text-sm text-ink-muted">{enabled ? 'Attive' : 'Disattivate'}</span>
		</span>
		<input
			type="checkbox"
			role="switch"
			class="peer sr-only"
			checked={enabled}
			disabled={busy}
			onchange={toggle}
		/>
		<span
			class="relative h-7 w-12 shrink-0 rounded-full bg-line transition peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
			aria-hidden="true"
		></span>
	</label>
{/if}
