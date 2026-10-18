<script lang="ts">
	import { formatMoney } from '$lib/domain/money';

	/** Colored amount: positive = they owe you (green), negative = you owe (orange-red). */
	let {
		cents,
		signed = true,
		class: className = ''
	}: { cents: number; signed?: boolean; class?: string } = $props();
</script>

<span
	class="font-semibold tabular-nums {signed && cents > 0
		? 'text-owed'
		: signed && cents < 0
			? 'text-owe'
			: 'text-ink-muted'} {className}">{formatMoney(Math.abs(cents))}</span
>
