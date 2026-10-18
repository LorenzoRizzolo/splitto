<script lang="ts">
	import { page } from '$app/state';
	import Icon from '../ui/Icon.svelte';
	import Avatar from '../ui/Avatar.svelte';
	import type { IconName } from '../ui/icons';

	let { me }: { me: { name: string; avatarUrl: string | null; avatarColor: string } } = $props();

	const items: { href: string; label: string; icon: IconName }[] = [
		{ href: '/app', label: 'Dashboard', icon: 'home' },
		{ href: '/app/groups', label: 'Gruppi', icon: 'users' },
		{ href: '/app/friends', label: 'Amici', icon: 'userPlus' },
		{ href: '/app/activity', label: 'Attività', icon: 'activity' },
		{ href: '/app/profile', label: 'Profilo', icon: 'user' }
	];

	function active(href: string) {
		const p = page.url.pathname;
		return href === '/app' ? p === '/app' : p === href || p.startsWith(`${href}/`);
	}

	const mobile = $derived(items.filter((i) => i.href !== '/app/friends'));
	const addHref = $derived.by(() => {
		const m = page.url.pathname.match(/^\/app\/groups\/([^/]+)/);
		return m ? `/app/expenses/new?group=${m[1]}` : '/app/expenses/new';
	});
</script>

<!-- Desktop sidebar -->
<nav
	aria-label="Navigazione principale"
	class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex"
>
	<a href="/app" class="mb-8 flex items-center gap-2 px-2 text-xl font-extrabold tracking-tight">
		<img src="/favicon.svg" alt="" width="32" height="32" /> Splitto
	</a>
	<a href={addHref} class="mb-6 btn-primary w-full" data-sveltekit-preload-data="tap">
		<Icon name="plus" /> Aggiungi spesa
	</a>
	<ul class="flex flex-col gap-1">
		{#each items as item (item.href)}
			<li>
				<a
					href={item.href}
					aria-current={active(item.href) ? 'page' : undefined}
					class="flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium text-ink-muted transition hover:bg-surface-3 hover:text-ink aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-800 dark:aria-[current=page]:bg-brand-950 dark:aria-[current=page]:text-brand-200"
				>
					<Icon name={item.icon} />
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
	<a href="/app/profile" class="mt-auto flex items-center gap-3 rounded-xl p-2 hover:bg-surface-3">
		<Avatar name={me.name} src={me.avatarUrl} color={me.avatarColor} size={36} />
		<span class="truncate text-sm font-medium">{me.name}</span>
	</a>
</nav>

<!-- Mobile bottom bar -->
<nav
	aria-label="Navigazione principale"
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
>
	<ul class="mx-auto grid max-w-lg grid-cols-5 items-end">
		{#each mobile.slice(0, 2) as item (item.href)}
			{@render tab(item)}
		{/each}
		<li class="flex justify-center">
			<a
				href={addHref}
				aria-label="Aggiungi spesa"
				data-sveltekit-preload-data="tap"
				class="-mt-6 inline-flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg ring-4 ring-surface transition active:scale-95"
			>
				<Icon name="plus" size={28} />
			</a>
		</li>
		{#each mobile.slice(2) as item (item.href)}
			{@render tab(item)}
		{/each}
	</ul>
</nav>

{#snippet tab(item: { href: string; label: string; icon: IconName })}
	<li>
		<a
			href={item.href}
			aria-current={active(item.href) ? 'page' : undefined}
			class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink-muted aria-[current=page]:text-brand-700 dark:aria-[current=page]:text-brand-300"
		>
			<Icon name={item.icon} size={22} />
			{item.label}
		</a>
	</li>
{/snippet}
