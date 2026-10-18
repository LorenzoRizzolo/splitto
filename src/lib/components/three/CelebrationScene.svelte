<script lang="ts">
	import { Canvas } from '@threlte/core';
	import WalletObject from './WalletObject.svelte';
	import CoinRainObject from './CoinRainObject.svelte';

	let { kind, onDone }: { kind: 'wallet' | 'rain'; onDone: () => void } = $props();
</script>

<!-- Short one-shot animation: rendered every frame while mounted (transparent background). -->
<Canvas renderMode="always" dpr={[1, 2]}>
	{#if kind === 'wallet'}
		<WalletObject {onDone} />
	{:else}
		<CoinRainObject {onDone} />
	{/if}
</Canvas>
