<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/components/ui/icons';

	let { data, children } = $props();

	const base = $derived(`/app/groups/${data.group.id}`);
	const tabs = $derived([
		{ href: base, label: 'Spese', icon: 'receipt' as IconName },
		{ href: `${base}/balances`, label: 'Saldi', icon: 'wallet' as IconName },
		{ href: `${base}/stats`, label: 'Statistiche', icon: 'chart' as IconName },
		{
			href: `${base}/settings`,
			label: data.group.kind === 'direct' ? 'Opzioni' : 'Impostazioni',
			icon: 'sliders' as IconName
		}
	]);
	const current = $derived(page.url.pathname);
</script>

<header class="mb-4">
	<div class="flex items-center gap-3">
		<a
			href={data.group.kind === 'direct' ? '/app/friends' : '/app/groups'}
			class="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-3"
			aria-label="Indietro"
		>
			<Icon name="chevronLeft" />
		</a>
		<span
			class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-2xl"
			aria-hidden="true">{data.group.emoji}</span
		>
		<div class="min-w-0 flex-1">
			<h1 class="truncate text-2xl font-extrabold tracking-tight">{data.group.title}</h1>
			<p class="truncate text-sm text-ink-muted">
				{#if data.group.kind === 'direct'}Spese tra amici{:else}{data.members.filter(
						(m) => m.active
					).length} membri{/if}
				{#if data.group.archived}· <span class="font-semibold">Archiviato</span>{/if}
			</p>
		</div>
	</div>
	<nav aria-label="Sezioni del gruppo" class="-mx-4 mt-4 overflow-x-auto px-4">
		<ul class="flex gap-1 border-b border-line">
			{#each tabs as t (t.href)}
				<li>
					<a
						href={t.href}
						aria-current={current === t.href ? 'page' : undefined}
						class="flex min-h-11 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-ink-muted hover:text-ink aria-[current=page]:border-brand-600 aria-[current=page]:text-brand-800 dark:aria-[current=page]:text-brand-200"
					>
						<Icon name={t.icon} size={16} />
						{t.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</header>

{#if data.group.archived}
	<p class="mb-4 flex items-center gap-2 rounded-xl bg-surface-3 p-3 text-sm">
		<Icon name="archive" size={18} /> Questo gruppo è archiviato: è consultabile ma non modificabile.
	</p>
{/if}

{@render children()}
