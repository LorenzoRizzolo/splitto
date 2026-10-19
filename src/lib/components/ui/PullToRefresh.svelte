<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	// Pull-to-refresh for touch devices: dragging down from the top of the page reveals a coin that
	// turns with the finger; past the threshold it keeps spinning while the page data reloads.
	// Pure CSS 3D like CoinLoader, so no Three.js is downloaded for it.
	const THRESHOLD = 72;
	const MAX = 110;
	const MIN_SPIN_MS = 600;

	let pull = $state(0);
	let refreshing = $state(false);

	const ready = $derived(pull >= THRESHOLD);

	onMount(() => {
		let startY: number | null = null;
		let active = false;

		const blocked = (target: EventTarget | null) =>
			target instanceof Element &&
			!!target.closest('dialog, [role="dialog"], input, textarea, select, [data-no-pull]');

		function onStart(e: TouchEvent) {
			if (refreshing || e.touches.length !== 1 || window.scrollY > 0 || blocked(e.target)) {
				startY = null;
				return;
			}
			startY = e.touches[0]!.clientY;
			active = false;
		}

		function onMove(e: TouchEvent) {
			if (startY === null) return;
			const dy = e.touches[0]!.clientY - startY;
			if (!active) {
				if (dy <= 0 || window.scrollY > 0) {
					startY = null;
					return;
				}
				active = dy > 6;
				if (!active) return;
			}
			// Take over from the browser's own overscroll / reload gesture while pulling.
			if (e.cancelable) e.preventDefault();
			// Rubber-band resistance.
			pull = Math.min(MAX, Math.max(0, dy * 0.5));
		}

		async function onEnd() {
			if (startY === null) return;
			startY = null;
			if (!active) return;
			active = false;
			if (pull < THRESHOLD) {
				pull = 0;
				return;
			}
			refreshing = true;
			pull = THRESHOLD;
			try {
				await Promise.all([invalidateAll(), new Promise((r) => setTimeout(r, MIN_SPIN_MS))]);
			} finally {
				refreshing = false;
				pull = 0;
			}
		}

		window.addEventListener('touchstart', onStart, { passive: true });
		window.addEventListener('touchmove', onMove, { passive: false });
		window.addEventListener('touchend', onEnd);
		window.addEventListener('touchcancel', onEnd);
		return () => {
			window.removeEventListener('touchstart', onStart);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onEnd);
			window.removeEventListener('touchcancel', onEnd);
		};
	});
</script>

<div
	class="ptr pointer-events-none fixed top-0 left-1/2 z-40 lg:left-[calc(50%+8rem)]"
	class:settling={pull === 0 || refreshing}
	style:transform="translate(-50%, {pull - 56}px)"
	style:opacity={Math.min(1, pull / (THRESHOLD * 0.6))}
	role="status"
	aria-live="polite"
>
	{#if refreshing}<span class="sr-only">Aggiornamento…</span>{/if}
	<div class="bubble" class:ready>
		<div
			class="coin"
			class:spinning={refreshing}
			style:transform={refreshing ? undefined : `rotateY(${pull * 5}deg)`}
			aria-hidden="true"
		>
			<img src="/coin.svg" alt="" class="face" />
			<img src="/coin.svg" alt="" class="face back" />
		</div>
	</div>
</div>

<style>
	.ptr {
		will-change: transform, opacity;
	}
	.settling {
		transition:
			transform 0.25s ease,
			opacity 0.25s ease;
	}
	.bubble {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 9999px;
		background: var(--surface);
		border: 1px solid var(--surface-3);
		box-shadow: 0 4px 14px rgb(0 0 0 / 0.18);
		perspective: 200px;
		transition: scale 0.15s ease;
	}
	.bubble.ready {
		scale: 1.08;
	}
	.coin {
		width: 32px;
		height: 32px;
		position: relative;
		transform-style: preserve-3d;
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
	}
	.back {
		transform: rotateY(180deg);
	}
	.spinning {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotateY(0deg);
		}
		to {
			transform: rotateY(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinning {
			animation: pulse 1.2s ease-in-out infinite;
		}
	}
	:global(:root[data-reduce-motion='true']) .spinning {
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
</style>
