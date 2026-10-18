<script lang="ts">
	import AnimatedMoney from '../ui/AnimatedMoney.svelte';
	import Icon from '../ui/Icon.svelte';

	/** Flip card: front = "you owe", back = "you are owed". Click/Enter flips it. */
	let { owe, owed }: { owe: number; owed: number } = $props();
	const net = $derived(owed - owe);
	let flipped = $state(false);
</script>

<section aria-labelledby="balance-title" class="mb-6">
	<div class="relative overflow-hidden card p-5 sm:p-6">
		<div
			aria-hidden="true"
			class="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-gradient-to-br from-gold-300/40 to-brand-300/30 blur-2xl"
		></div>
		<h2 id="balance-title" class="text-sm font-medium text-ink-muted">Saldo totale</h2>
		<p class="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
			{#if net === 0}
				<span class="text-ink">Siete pari</span>
			{:else}
				<AnimatedMoney cents={Math.abs(net)} class={net > 0 ? 'text-owed' : 'text-owe'} />
			{/if}
		</p>
		<p class="mt-1 text-sm text-ink-muted">
			{net > 0
				? 'In totale ti devono questa cifra'
				: net < 0
					? 'In totale devi questa cifra'
					: 'Non devi niente a nessuno 🎉'}
		</p>

		<button
			type="button"
			class="flip-scene mt-5 block w-full text-left"
			aria-pressed={flipped}
			aria-label="Mostra {flipped ? 'quanto devi' : 'quanto ti devono'}"
			onclick={() => (flipped = !flipped)}
		>
			<div class="flip-card" class:flipped>
				<div class="flip-face rounded-2xl bg-orange-50 p-4 dark:bg-orange-950/40">
					<p class="text-xs font-semibold tracking-wide text-owe uppercase">Devi</p>
					<p class="text-2xl font-bold text-owe"><AnimatedMoney cents={owe} /></p>
					<p class="mt-1 flex items-center gap-1 text-xs text-ink-muted">
						Tocca per vedere quanto ti devono <Icon name="refresh" size={12} />
					</p>
				</div>
				<div class="flip-face flip-back rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
					<p class="text-xs font-semibold tracking-wide text-owed uppercase">Ti devono</p>
					<p class="text-2xl font-bold text-owed"><AnimatedMoney cents={owed} /></p>
					<p class="mt-1 flex items-center gap-1 text-xs text-ink-muted">
						Tocca per vedere quanto devi <Icon name="refresh" size={12} />
					</p>
				</div>
			</div>
		</button>
	</div>
</section>

<style>
	.flip-scene {
		perspective: 900px;
	}
	.flip-card {
		display: grid;
		transform-style: preserve-3d;
		transition: transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.flip-card.flipped {
		transform: rotateY(180deg);
	}
	.flip-face {
		grid-area: 1 / 1;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.flip-back {
		transform: rotateY(180deg);
	}
	:global(:root[data-reduce-motion='true']) .flip-card {
		transition: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.flip-card {
			transition: none;
		}
	}
</style>
