<script lang="ts">
	import { fly } from 'svelte/transition';
	import { prefs } from '$lib/client/preferences.svelte';

	const slides = [
		{
			emoji: '👥',
			title: 'Crea un gruppo',
			text: 'Casa, viaggio, coppia o una cena: crea un gruppo e invita gli amici con un link o un QR code.'
		},
		{
			emoji: '🧾',
			title: 'Aggiungi le spese',
			text: 'Chi ha pagato, quanto e come dividere: in parti uguali, per importi, percentuali, quote o voci dello scontrino.'
		},
		{
			emoji: '🤝',
			title: 'Salda i conti',
			text: 'Splitto calcola chi deve a chi con il minor numero di pagamenti. Registra i rimborsi e siete pari!'
		}
	];
	let index = $state(0);
	const last = $derived(index === slides.length - 1);
</script>

<svelte:head><title>Benvenuto — Splitto</title></svelte:head>

<div class="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center">
	<form method="POST" class="mb-4 self-end">
		<button class="btn-ghost text-ink-muted">Salta</button>
	</form>

	<div class="relative overflow-hidden card p-8 text-center" aria-live="polite">
		{#key index}
			<div in:fly={{ x: prefs.motionReduced ? 0 : 40, duration: 250 }}>
				<div
					class="mx-auto mb-6 flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-gold-300/50 text-6xl dark:from-brand-900 dark:to-gold-600/30"
					aria-hidden="true"
				>
					{slides[index]!.emoji}
				</div>
				<p class="text-sm font-semibold text-brand-700 dark:text-brand-300">
					Passo {index + 1} di 3
				</p>
				<h1 class="mt-1 text-2xl font-extrabold">{slides[index]!.title}</h1>
				<p class="mt-3 text-ink-muted">{slides[index]!.text}</p>
			</div>
		{/key}
		<div class="mt-8 flex justify-center gap-2" aria-hidden="true">
			{#each slides as s, i (s.title)}
				<span
					class="h-2 rounded-full transition-all {i === index ? 'w-6 bg-brand-600' : 'w-2 bg-line'}"
				></span>
			{/each}
		</div>
	</div>

	<div class="mt-6 flex gap-3">
		{#if index > 0}
			<button type="button" class="btn-secondary flex-1" onclick={() => index--}>Indietro</button>
		{/if}
		{#if last}
			<form method="POST" class="flex-1">
				<input type="hidden" name="next" value="group" />
				<button class="btn-primary w-full">Crea il tuo primo gruppo</button>
			</form>
		{:else}
			<button type="button" class="btn-primary flex-1" onclick={() => index++}>Avanti</button>
		{/if}
	</div>
	<noscript>
		<form method="POST" class="mt-3"><button class="btn-primary w-full">Inizia</button></form>
	</noscript>
</div>
