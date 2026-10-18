<script lang="ts">
	import { onMount } from 'svelte';
	import { install } from '$lib/client/install.svelte';
	import { toasts } from '$lib/client/toast.svelte';
	import Modal from '../ui/Modal.svelte';
	import Icon from '../ui/Icon.svelte';

	let {
		class: className = 'btn-secondary',
		label = 'Installa'
	}: { class?: string; label?: string } = $props();

	let open = $state(false);
	// Rendered only after hydration: platform detection is client-side (no SSR mismatch).
	let mounted = $state(false);
	onMount(() => {
		install.init();
		mounted = true;
	});

	async function onClick() {
		const r = await install.prompt();
		if (r === 'accepted') toasts.success('Splitto è stato installato 🎉');
		else if (r === 'manual') open = true;
	}

	const p = $derived(install.platform);
	const title = $derived(
		p === 'firefox-desktop'
			? 'Usa Splitto dal browser'
			: p === 'mac-safari'
				? 'Aggiungi Splitto al Dock'
				: 'Installa Splitto'
	);
</script>

{#if !mounted}
	<!-- Placeholder keeps the layout stable and works as a plain link before hydration. -->
	<a href="#installa" class={className}><Icon name="download" size={18} /> {label}</a>
{:else if install.installed}
	<span class="{className} pointer-events-none opacity-80" aria-live="polite"
		><Icon name="check" size={18} /> App installata</span
	>
{:else}
	<button type="button" class={className} onclick={onClick}
		><Icon name="download" size={18} /> {label}</button
	>
{/if}

<Modal bind:open {title} size="sm">
	{#if p === 'ios' || p === 'ios-other'}
		<ol class="space-y-4">
			<li class="flex gap-3">
				<span class="step">1</span>
				<span
					>Tocca il pulsante <strong>Condividi</strong>
					<svg
						class="inline size-5 align-text-bottom"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
						><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" /></svg
					>
					{p === 'ios' ? 'nella barra di Safari' : 'nel menu del browser'}.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="step">2</span><span
					>Scorri e scegli <strong>Aggiungi alla schermata Home</strong>
					<span aria-hidden="true">➕</span>.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="step">3</span><span
					>Tocca <strong>Aggiungi</strong>: Splitto comparirà tra le tue app.</span
				>
			</li>
		</ol>
		{#if p === 'ios-other'}<p class="mt-4 text-sm text-ink-muted">
				Se non vedi l'opzione, apri questa pagina in Safari.
			</p>{/if}
		<p class="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
			💡 Su iPhone le notifiche push funzionano solo dopo aver installato l'app (iOS 16.4 o
			successivo).
		</p>
	{:else if p === 'mac-safari'}
		<ol class="space-y-4">
			<li class="flex gap-3">
				<span class="step">1</span><span
					>Nella barra dei menu apri <strong>File</strong> (oppure il pulsante Condividi).</span
				>
			</li>
			<li class="flex gap-3">
				<span class="step">2</span><span>Scegli <strong>Aggiungi al Dock…</strong></span>
			</li>
			<li class="flex gap-3">
				<span class="step">3</span><span>Conferma con <strong>Aggiungi</strong>.</span>
			</li>
		</ol>
		<p class="mt-4 text-sm text-ink-muted">Richiede macOS Sonoma (Safari 17) o successivo.</p>
	{:else if p === 'firefox-android'}
		<ol class="space-y-4">
			<li class="flex gap-3">
				<span class="step">1</span><span>Tocca il menu <strong>⋮</strong> di Firefox.</span>
			</li>
			<li class="flex gap-3">
				<span class="step">2</span><span
					>Scegli <strong>Installa</strong> o
					<strong>Aggiungi alla schermata principale</strong>.</span
				>
			</li>
		</ol>
	{:else if p === 'firefox-desktop'}
		<p>
			Firefox per computer non permette di installare le web app, ma Splitto funziona benissimo
			anche così: aggiungila ai segnalibri.
		</p>
		<p class="mt-3 text-sm text-ink-muted">
			Se vuoi un'icona sul desktop, apri Splitto con <strong>Chrome</strong> o <strong>Edge</strong> e
			premi “Installa”.
		</p>
	{:else}
		<ol class="space-y-4">
			<li class="flex gap-3">
				<span class="step">1</span><span
					>Apri il menu del browser (<strong>⋮</strong> o <strong>…</strong>).</span
				>
			</li>
			<li class="flex gap-3">
				<span class="step">2</span><span
					>Scegli <strong>Installa Splitto</strong> o
					<strong>Aggiungi alla schermata Home</strong>.</span
				>
			</li>
		</ol>
		<p class="mt-4 text-sm text-ink-muted">
			Se l'opzione non c'è, l'app potrebbe essere già installata oppure il browser non lo supporta.
		</p>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn-primary" onclick={() => (open = false)}>Ho capito</button>
	{/snippet}
</Modal>

<style>
	.step {
		display: inline-flex;
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		background: var(--color-brand-600);
		color: white;
		font-weight: 700;
		font-size: 0.875rem;
	}
</style>
