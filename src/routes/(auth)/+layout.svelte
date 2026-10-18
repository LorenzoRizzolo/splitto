<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
	<a href="/" class="mb-6 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
		<img src="/favicon.svg" alt="" width="40" height="40" />
		Splitto
	</a>
	<main class="w-full max-w-md card p-6 sm:p-8">
		{@render children()}
	</main>
</div>
