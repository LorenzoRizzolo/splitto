<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Money from '$lib/components/ui/Money.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Celebration from '$lib/components/three/Celebration.svelte';
	import { centsToInput, formatMoney } from '$lib/domain/money';
	import { debtSentence } from '$lib/domain/summary';
	import { formatDateShort } from '$lib/domain/dates';
	import { toasts } from '$lib/client/toast.svelte';

	let { data, form } = $props();

	const byId = $derived(new Map(data.members.map((m) => [m.id, m])));
	const name = (id: string) => byId.get(id)?.name ?? 'Ex membro';
	const meName = $derived(byId.get(data.myMemberId)?.name);
	const errors = $derived(
		(form && 'errors' in form && form.action === 'settle' ? form.errors : {}) as Record<
			string,
			string
		>
	);

	let from = $state('');
	let to = $state('');
	let amount = $state('');
	$effect.pre(() => {
		from = data.prefill.from;
		to = data.prefill.to;
		amount = data.prefill.amount ? centsToInput(data.prefill.amount) : '';
	});

	let celebrate = $state<null | 'wallet' | 'rain'>(null);
	let settleSection: HTMLElement | undefined = $state();

	function prefill(d: { from: string; to: string; cents: number }) {
		from = d.from;
		to = d.to;
		amount = centsToInput(d.cents);
		settleSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		settleSection?.querySelector<HTMLInputElement>('#amount')?.focus({ preventScroll: true });
	}

	const METHODS = [
		{ id: 'cash', label: 'Contanti', icon: '💶' },
		{ id: 'bank', label: 'Bonifico', icon: '🏦' },
		{ id: 'paypal', label: 'PayPal', icon: '🅿️' },
		{ id: 'satispay', label: 'Satispay', icon: '📱' },
		{ id: 'other', label: 'Altro', icon: '✨' }
	];
	const active = $derived(
		data.members.filter(
			(m) => m.active || data.net.some((n) => n.memberId === m.id && n.cents !== 0)
		)
	);
</script>

<svelte:head><title>Saldi · {data.group.title} — Splitto</title></svelte:head>

<Celebration mode={celebrate} onDone={() => (celebrate = null)} />

<section aria-labelledby="debts-title" class="mb-6">
	<h2 id="debts-title" class="mb-1 text-lg font-bold">Chi deve a chi</h2>
	<p class="mb-3 text-sm text-ink-muted">
		Splitto calcola il minor numero di pagamenti per mettere tutti in pari.
	</p>
	{#if data.settled}
		<div class="flex flex-col items-center gap-2 card p-8 text-center">
			<span class="text-5xl" aria-hidden="true">🎉</span>
			<p class="text-xl font-bold">Siete pari!</p>
			<p class="text-sm text-ink-muted">Nessuno deve niente a nessuno in questo gruppo.</p>
		</div>
	{:else}
		<ul class="divide-y divide-line overflow-hidden card">
			{#each data.debts as d (d.from + d.to)}
				{@const involved = d.from === data.myMemberId || d.to === data.myMemberId}
				<li class="flex flex-wrap items-center gap-3 p-4">
					<div class="flex -space-x-2" aria-hidden="true">
						<Avatar
							name={name(d.from)}
							src={byId.get(d.from)?.avatarUrl}
							color={byId.get(d.from)?.avatarColor}
							guest={byId.get(d.from)?.isGuest}
							size={36}
						/>
						<Avatar
							name={name(d.to)}
							src={byId.get(d.to)?.avatarUrl}
							color={byId.get(d.to)?.avatarColor}
							guest={byId.get(d.to)?.isGuest}
							size={36}
						/>
					</div>
					<p
						class="min-w-0 flex-1 font-medium {d.from === data.myMemberId
							? 'text-owe'
							: d.to === data.myMemberId
								? 'text-owed'
								: ''}"
					>
						{debtSentence({ from: name(d.from), to: name(d.to), cents: d.cents }, meName)}
					</p>
					<div class="flex gap-2">
						{#if d.to === data.myMemberId && !data.group.archived}
							<form
								method="POST"
								action="?/remind"
								use:enhance={() =>
									async ({ result, update }) => {
										if (result.type === 'success')
											toasts.success(`Promemoria inviato a ${name(d.from)}`);
										else if (result.type === 'failure')
											toasts.error(String(result.data?.remindError ?? 'Promemoria non inviato'));
										await update();
									}}
							>
								<input type="hidden" name="member" value={d.from} />
								<button
									class="btn-secondary min-h-11 px-3 text-sm"
									disabled={!d.canRemind}
									title={d.canRemind ? '' : 'Puoi inviare un promemoria ogni 24 ore'}
								>
									<Icon name="bell" size={16} /> Ricorda a {name(d.from).split(' ')[0]}
								</button>
							</form>
						{/if}
						{#if !data.group.archived}
							<a
								href="?from={d.from}&to={d.to}&amount={centsToInput(d.cents)}#settle"
								class="{involved ? 'btn-primary' : 'btn-secondary'} min-h-11 px-3 text-sm"
								data-sveltekit-noscroll
								onclick={(e) => {
									e.preventDefault();
									prefill(d);
								}}>Salda</a
							>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="net-title" class="mb-6">
	<h2 id="net-title" class="mb-3 text-lg font-bold">Saldo di ciascuno</h2>
	<ul class="divide-y divide-line overflow-hidden card">
		{#each active as m (m.id)}
			{@const cents = data.net.find((n) => n.memberId === m.id)?.cents ?? 0}
			<li class="flex items-center gap-3 p-3">
				<Avatar name={m.name} src={m.avatarUrl} color={m.avatarColor} guest={m.isGuest} size={36} />
				<span class="flex-1"
					>{m.isMe ? 'Tu' : m.name}{#if m.isGuest}<span class="text-xs text-ink-muted">
							· ospite</span
						>{/if}</span
				>
				<span class="text-right text-sm">
					{#if cents === 0}<span class="text-ink-muted">in pari</span>{:else}
						<span class="block text-xs text-ink-muted"
							>{cents > 0 ? 'deve ricevere' : 'deve dare'}</span
						><Money {cents} />
					{/if}
				</span>
			</li>
		{/each}
	</ul>
</section>

{#if !data.group.archived}
	<section
		id="settle"
		bind:this={settleSection}
		aria-labelledby="settle-title"
		class="mb-6 scroll-mt-4 card p-5"
	>
		<h2 id="settle-title" class="mb-4 flex items-center gap-2 text-lg font-bold">
			<Icon name="wallet" /> Registra un rimborso
		</h2>
		<form
			method="POST"
			action="?/settle"
			class="space-y-4"
			use:enhance={() =>
				async ({ result, update }) => {
					await update();
					if (result.type === 'success' && result.data?.settledOk) {
						celebrate = result.data.groupSettled ? 'rain' : 'wallet';
						toasts.success(
							result.data.groupSettled
								? 'Siete pari! 🎉'
								: `Rimborso di ${formatMoney(Number(result.data.amount))} registrato`
						);
					}
				}}
		>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label class="field-label" for="from">Chi paga</label>
					<select id="from" name="from" class="field-input" bind:value={from}>
						{#each active as m (m.id)}<option value={m.id}
								>{m.isMe ? `Tu (${m.name})` : m.name}</option
							>{/each}
					</select>
				</div>
				<div>
					<label class="field-label" for="to">A chi</label>
					<select id="to" name="to" class="field-input" bind:value={to} aria-describedby="to-error">
						<option value="" disabled>Scegli…</option>
						{#each active.filter((m) => m.id !== from) as m (m.id)}<option value={m.id}
								>{m.isMe ? `Tu (${m.name})` : m.name}</option
							>{/each}
					</select>
					<FieldError id="to-error" message={errors.to} />
				</div>
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label class="field-label" for="amount">Importo</label>
					<div class="relative">
						<input
							id="amount"
							name="amount"
							class="field-input pr-10 text-right text-lg font-bold tabular-nums"
							inputmode="decimal"
							placeholder="0,00"
							bind:value={amount}
							required
							aria-describedby="amount-error"
						/>
						<span
							class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
							>€</span
						>
					</div>
					<FieldError id="amount-error" message={errors.amount} />
				</div>
				<div>
					<label class="field-label" for="date">Data</label>
					<input
						id="date"
						name="date"
						type="date"
						class="field-input"
						value={data.today}
						max={data.today}
					/>
				</div>
			</div>
			<fieldset>
				<legend class="field-label">Metodo</legend>
				<div class="flex flex-wrap gap-2">
					{#each METHODS as m, i (m.id)}
						<label
							class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-medium has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500"
						>
							<input type="radio" name="method" value={m.id} class="sr-only" checked={i === 0} />
							<span aria-hidden="true">{m.icon}</span>{m.label}
						</label>
					{/each}
				</div>
			</fieldset>
			<div>
				<label class="field-label" for="note">Nota (facoltativa)</label>
				<input id="note" name="note" class="field-input" maxlength="200" />
			</div>
			<button class="btn-primary w-full sm:w-auto"
				><Icon name="check" size={18} /> Registra rimborso</button
			>
		</form>
	</section>
{/if}

{#if data.recent.length > 0}
	<section aria-labelledby="recent-title">
		<h2 id="recent-title" class="mb-3 text-lg font-bold">Ultimi rimborsi</h2>
		<ul class="divide-y divide-line overflow-hidden card">
			{#each data.recent as s (s.id)}
				<li class="flex items-center gap-3 p-3 text-sm">
					<span class="text-xl" aria-hidden="true">💸</span>
					<span class="flex-1">
						<span class="block font-medium"
							>{byId.get(s.from)?.isMe ? 'Tu' : name(s.from)} → {byId.get(s.to)?.isMe
								? 'te'
								: name(s.to)}</span
						>
						<span class="text-ink-muted"
							>{formatDateShort(s.date)}{s.note ? ` · ${s.note}` : ''}</span
						>
					</span>
					<span class="font-semibold tabular-nums">{formatMoney(s.cents)}</span>
					{#if s.canDelete && !data.group.archived}
						<form
							method="POST"
							action="?/deleteSettlement"
							use:enhance={({ cancel }) => {
								if (!confirm('Annullare questo rimborso?')) cancel();
								return async ({ update }) => {
									await update();
									toasts.success('Rimborso annullato');
								};
							}}
						>
							<input type="hidden" name="id" value={s.id} />
							<button
								class="inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-3"
								aria-label="Annulla rimborso"><Icon name="trash" size={16} /></button
							>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
