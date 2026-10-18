<script lang="ts">
	import { navigating } from '$app/state';
	import { fade } from 'svelte/transition';

	// Spinning coin shown only for slow navigations (> 350 ms). Pure CSS 3D on purpose: a loader
	// must not download Three.js while the user is already waiting.
	let visible = $state(false);
	$effect(() => {
		if (!navigating.to) {
			visible = false;
			return;
		}
		const t = setTimeout(() => (visible = true), 350);
		return () => clearTimeout(t);
	});
</script>

{#if visible}
	<div
		class="pointer-events-none fixed top-3 left-1/2 z-50 -translate-x-1/2"
		transition:fade={{ duration: 150 }}
		role="status"
	>
		<span class="sr-only">Caricamento…</span>
		<div class="coin" aria-hidden="true">
			<img src="/coin.svg" alt="" class="face" />
			<img src="/coin.svg" alt="" class="face back" />
		</div>
	</div>
{/if}

<style>
	.coin {
		width: 44px;
		height: 44px;
		position: relative;
		transform-style: preserve-3d;
		animation: spin 1s linear infinite;
		filter: drop-shadow(0 4px 8px rgb(0 0 0 / 0.25));
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
	}
	.back {
		transform: rotateY(180deg);
	}
	@keyframes spin {
		to {
			transform: rotateY(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.coin {
			animation: pulse 1.2s ease-in-out infinite;
		}
	}
	:global(:root[data-reduce-motion='true']) .coin {
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
</style>
