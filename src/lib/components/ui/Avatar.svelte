<script lang="ts">
	import { initials, pickAvatarColor } from '$lib/domain/avatar';

	let {
		name,
		color,
		src = null,
		size = 40,
		guest = false
	}: {
		name: string;
		color?: string | null;
		src?: string | null;
		size?: number;
		guest?: boolean;
	} = $props();

	const bg = $derived(color ?? pickAvatarColor(name));
</script>

{#if src}
	<img
		{src}
		alt=""
		width={size}
		height={size}
		class="shrink-0 rounded-full object-cover"
		style:width="{size}px"
		style:height="{size}px"
		loading="lazy"
	/>
{:else}
	<span
		aria-hidden="true"
		class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none {guest
			? 'ring-2 ring-line ring-offset-2 ring-offset-surface'
			: ''}"
		style:width="{size}px"
		style:height="{size}px"
		style:font-size="{Math.round(size * 0.4)}px"
		style:background={guest ? '#64748b' : bg}
	>
		{initials(name)}
	</span>
{/if}
