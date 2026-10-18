<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { type Component } from 'svelte';
	import { prefs } from '$lib/client/preferences.svelte';
	import { hasWebGL } from '$lib/client/webgl';

	/**
	 * Full-screen, non-blocking celebration: 3D wallet (settlement) or coin rain (all even).
	 * Falls back to a simple fade when WebGL is missing or motion is reduced.
	 */
	let { mode, onDone }: { mode: null | 'wallet' | 'rain'; onDone: () => void } = $props();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let Scene = $state<Component<any> | null>(null);
	let use3D = $state(false);

	$effect(() => {
		if (!mode) return;
		use3D = hasWebGL() && !prefs.motionReduced;
		if (use3D && !Scene) {
			import('./CelebrationScene.svelte')
				.then((m) => (Scene = m.default))
				.catch(() => (use3D = false));
		}
		// Safety net (and duration of the static version).
		const timer = setTimeout(onDone, use3D ? 5000 : 1800);
		return () => clearTimeout(timer);
	});
</script>

{#if mode}
	<div
		class="pointer-events-none fixed inset-0 z-50"
		transition:fade={{ duration: 200 }}
		aria-hidden="true"
	>
		{#if use3D && Scene}
			<div class="absolute inset-0 {mode === 'wallet' ? 'm-auto h-80 w-80 max-w-full' : ''}">
				<Scene kind={mode} {onDone} />
			</div>
		{/if}
		{#if mode === 'rain'}
			<div class="absolute inset-0 flex items-center justify-center">
				<p
					in:scale={{ start: 0.6, duration: prefs.motionReduced ? 0 : 400 }}
					class="rounded-3xl bg-surface/90 px-8 py-5 text-4xl font-extrabold shadow-2xl backdrop-blur"
				>
					Siete pari! 🎉
				</p>
			</div>
		{:else if !use3D}
			<div class="absolute inset-0 flex items-center justify-center">
				<p class="rounded-3xl bg-surface/90 px-6 py-4 text-5xl shadow-2xl">👛</p>
			</div>
		{/if}
	</div>
{/if}
