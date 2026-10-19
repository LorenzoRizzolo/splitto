<script lang="ts">
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { OG_IMAGE, SITE_NAME } from '$lib/seo';

	let {
		title,
		description,
		ogTitle = title
	}: { title: string; description: string; ogTitle?: string } = $props();

	const canonical = $derived(page.data.origin + page.url.pathname);
	const image = $derived(page.data.origin + OG_IMAGE.path);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE_NAME} />
	<meta property="og:locale" content="it_IT" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content={String(OG_IMAGE.width)} />
	<meta property="og:image:height" content={String(OG_IMAGE.height)} />
	<meta property="og:image:alt" content="Splitto: dividi le spese, non le amicizie" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	{#if env.PUBLIC_GOOGLE_SITE_VERIFICATION}
		<meta name="google-site-verification" content={env.PUBLIC_GOOGLE_SITE_VERIFICATION} />
	{/if}
</svelte:head>
