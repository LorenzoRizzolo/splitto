<script lang="ts">
	import AppNav from '$lib/components/app/AppNav.svelte';
	import PullToRefresh from '$lib/components/ui/PullToRefresh.svelte';

	let { data, children } = $props();
</script>

<AppNav me={data.me} />
<PullToRefresh />
<div class="lg:pl-64">
	<main id="main" class="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 sm:px-6 lg:pt-8 lg:pb-12">
		{@render children()}
	</main>
</div>
