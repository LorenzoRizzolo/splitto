<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import { formatMoney } from '$lib/domain/money';
	import { prefs } from '$lib/client/preferences.svelte';

	/** Counts up to the value on mount and animates on change. Cents in, euro string out. */
	let { cents, class: className = '' }: { cents: number; class?: string } = $props();

	const tween = new Tween(0, { duration: 700, easing: cubicOut });
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});

	$effect(() => {
		const target = cents;
		if (!mounted) return;
		tween.set(target, { duration: prefs.motionReduced ? 0 : 700 });
	});

	// SSR and no-JS show the final value directly.
	const shown = $derived(mounted ? Math.round(tween.current) : cents);
</script>

<span class="tabular-nums {className}" aria-label={formatMoney(cents)}>
	<span aria-hidden="true">{formatMoney(shown)}</span>
</span>
