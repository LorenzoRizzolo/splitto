<script lang="ts">
	import { Canvas } from '@threlte/core';
	import CoinObject from './CoinObject.svelte';

	let { running }: { running: boolean } = $props();
</script>

<!-- on-demand: frames are rendered only while the animation task runs (paused when hidden). -->
<Canvas renderMode="on-demand" dpr={[1, 2]}>
	<CoinObject {running} />
</Canvas>
