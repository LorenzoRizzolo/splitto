<script lang="ts">
	import { ICONS, type IconName } from './icons';

	let {
		name,
		size = 20,
		class: className = '',
		label
	}: { name: IconName; size?: number; class?: string; label?: string } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="shrink-0 {className}"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted icon markup -->
	{@html ICONS[name]}
</svg>
