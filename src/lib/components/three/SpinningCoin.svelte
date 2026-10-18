<script lang="ts">
	import Lazy3D from './Lazy3D.svelte';

	let {
		class: className = 'size-64',
		label = 'Moneta di Splitto che gira'
	}: { class?: string; label?: string } = $props();
</script>

<Lazy3D load={() => import('./CoinScene.svelte')} {label} class={className}>
	{#snippet fallback()}
		<img src="/coin.svg" alt="" class="coin-fallback size-full p-[12%] drop-shadow-xl" />
	{/snippet}
</Lazy3D>

<style>
	.coin-fallback {
		animation: coin-float 3s ease-in-out infinite;
	}
	@keyframes coin-float {
		50% {
			transform: translateY(-6px) rotate(-4deg);
		}
	}
</style>
