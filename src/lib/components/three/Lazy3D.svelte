<script lang="ts">
	import { onMount, type Component, type Snippet } from 'svelte';
	import { prefs } from '$lib/client/preferences.svelte';
	import { hasWebGL } from '$lib/client/webgl';

	/**
	 * Loads a Threlte scene only on the client, only when visible, and only if WebGL is
	 * available and motion is allowed. Otherwise the static `fallback` is shown.
	 * The scene receives `running`, false while off-screen or when the tab is hidden.
	 */
	let {
		load,
		fallback,
		label,
		class: className = '',
		props = {}
	}: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		load: () => Promise<{ default: Component<any> }>;
		fallback: Snippet;
		label: string;
		class?: string;
		props?: Record<string, unknown>;
	} = $props();

	let el: HTMLDivElement | undefined = $state();
	let inView = $state(false);
	let pageVisible = $state(true);
	let webgl = $state(false);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let Scene = $state<Component<any> | null>(null);

	const running = $derived(inView && pageVisible && !prefs.motionReduced);

	onMount(() => {
		webgl = hasWebGL();
		if (!webgl || !el) return;
		const io = new IntersectionObserver(([entry]) => (inView = !!entry?.isIntersecting), {
			rootMargin: '100px'
		});
		io.observe(el);
		const onVis = () => (pageVisible = document.visibilityState === 'visible');
		document.addEventListener('visibilitychange', onVis);
		return () => {
			io.disconnect();
			document.removeEventListener('visibilitychange', onVis);
		};
	});

	$effect(() => {
		if (inView && webgl && !prefs.motionReduced && !Scene) {
			load()
				.then((m) => (Scene = m.default))
				.catch(() => (webgl = false));
		}
	});
</script>

<div bind:this={el} class="relative {className}" role="img" aria-label={label}>
	{#if Scene && webgl && !prefs.motionReduced}
		<Scene {running} {...props} />
	{:else}
		{@render fallback()}
	{/if}
</div>
