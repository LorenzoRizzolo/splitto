<script lang="ts" module>
	export type FormMember = { id: string; name: string; isMe: boolean; active: boolean };
	export type ExpenseInitial = {
		description: string;
		amountCents: number | null;
		date: string;
		category: string;
		notes: string;
		payers: { memberId: string; cents: number }[];
		split: import('$lib/domain/split').SplitInput | null;
		hasReceipt?: boolean;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import FieldError from '../ui/FieldError.svelte';
	import Icon from '../ui/Icon.svelte';
	import {
		CATEGORIES,
		CATEGORY_INFO,
		suggestCategory,
		type Category
	} from '$lib/domain/categories';
	import { centsToInput, formatMoney, parseAmount, sum } from '$lib/domain/money';
	import {
		computeSplit,
		parsePercent,
		validatePayers,
		type SplitInput,
		type SplitMode
	} from '$lib/domain/split';
	import { trackDirty } from '$lib/client/sw.svelte';
	import { toasts } from '$lib/client/toast.svelte';

	let {
		members,
		initial,
		errors = {},
		submitLabel,
		allowRepeat = false,
		autofocusAmount = false
	}: {
		members: FormMember[];
		initial: ExpenseInitial;
		errors?: Record<string, string>;
		submitLabel: string;
		allowRepeat?: boolean;
		autofocusAmount?: boolean;
	} = $props();

	// The form is initialised once from `initial`; later prop changes come with a remount.
	// svelte-ignore state_referenced_locally
	const init = initial;
	// svelte-ignore state_referenced_locally
	const selectable = members.filter(
		(m) => m.active || init.payers.some((p) => p.memberId === m.id)
	);
	const me = selectable.find((m) => m.isMe) ?? selectable[0];

	let amount = $state(init.amountCents ? centsToInput(init.amountCents) : '');
	let description = $state(init.description);
	let category = $state(init.category || 'other');
	let categoryTouched = $state(!!init.category && init.category !== 'other');

	const multiPayer = init.payers.length > 1;
	let payerMode = $state<'single' | 'multi'>(multiPayer ? 'multi' : 'single');
	let payer = $state(init.payers[0]?.memberId ?? me?.id ?? '');
	let paid = $state<Record<string, string>>(
		Object.fromEntries(
			selectable.map((m) => [
				m.id,
				multiPayer ? centsToInput(init.payers.find((p) => p.memberId === m.id)?.cents ?? 0) : ''
			])
		)
	);

	const s = init.split;
	let mode = $state<SplitMode>(s?.mode ?? 'equal');
	const activeIds = selectable.filter((m) => m.active).map((m) => m.id);
	let participants = $state<string[]>(
		s?.mode === 'equal' || s?.mode === 'adjust' ? [...s.members] : activeIds
	);
	const blank = () =>
		Object.fromEntries(selectable.map((m) => [m.id, ''])) as Record<string, string>;
	let exact = $state<Record<string, string>>(
		s?.mode === 'exact'
			? {
					...blank(),
					...Object.fromEntries(s.amounts.map((a) => [a.memberId, centsToInput(a.cents)]))
				}
			: blank()
	);
	let percent = $state<Record<string, string>>(
		s?.mode === 'percent'
			? {
					...blank(),
					...Object.fromEntries(
						s.percents.map((p) => [p.memberId, String(p.basisPoints / 100).replace('.', ',')])
					)
				}
			: blank()
	);
	let shares = $state<Record<string, string>>(
		s?.mode === 'shares'
			? {
					...blank(),
					...Object.fromEntries(
						s.shares.map((p) => [p.memberId, String(p.shares).replace('.', ',')])
					)
				}
			: Object.fromEntries(selectable.map((m) => [m.id, m.active ? '1' : '']))
	);
	let adjust = $state<Record<string, string>>(
		s?.mode === 'adjust'
			? {
					...blank(),
					...Object.fromEntries(
						s.adjustments.map((a) => [
							a.memberId,
							(a.cents > 0 ? '+' : '-') + centsToInput(Math.abs(a.cents))
						])
					)
				}
			: blank()
	);
	type Item = { name: string; amount: string; memberIds: string[] };
	let items = $state<Item[]>(
		s?.mode === 'itemized'
			? s.items.map((i) => ({
					name: i.name,
					amount: centsToInput(i.cents),
					memberIds: [...i.memberIds]
				}))
			: [{ name: '', amount: '', memberIds: [...activeIds] }]
	);
	let tax = $state(s?.mode === 'itemized' && s.taxCents ? centsToInput(s.taxCents) : '');
	let tip = $state(s?.mode === 'itemized' && s.tipCents ? centsToInput(s.tipCents) : '');
	let submitting = $state(false);
	let amountInput: HTMLInputElement | undefined = $state();

	onMount(() => {
		if (autofocusAmount) amountInput?.focus();
	});

	// --- Live computation (same domain code as the server) ---
	const totalCents = $derived(parseAmount(amount));
	const ids = selectable.map((m) => m.id);

	const splitInput = $derived.by((): SplitInput | null => {
		const opt = (v: string) => v.trim() !== '';
		switch (mode) {
			case 'equal':
				return { mode, members: ids.filter((id) => participants.includes(id)) };
			case 'exact':
				return {
					mode,
					amounts: ids
						.filter((id) => opt(exact[id]!))
						.map((id) => ({ memberId: id, cents: parseAmount(exact[id]!) ?? NaN }))
				};
			case 'percent':
				return {
					mode,
					percents: ids
						.filter((id) => opt(percent[id]!))
						.map((id) => ({ memberId: id, basisPoints: parsePercent(percent[id]!) ?? NaN }))
				};
			case 'shares':
				return {
					mode,
					shares: ids
						.filter((id) => opt(shares[id]!))
						.map((id) => ({ memberId: id, shares: Number(shares[id]!.replace(',', '.')) }))
				};
			case 'adjust': {
				const sel = ids.filter((id) => participants.includes(id));
				return {
					mode,
					members: sel,
					adjustments: sel
						.filter((id) => opt(adjust[id]!) && adjust[id] !== '-' && adjust[id] !== '+')
						.map((id) => {
							const raw = adjust[id]!.trim();
							const neg = raw.startsWith('-');
							const c = parseAmount(raw.replace(/^[+-]/, ''));
							return { memberId: id, cents: c === null ? NaN : neg ? -c : c };
						})
				};
			}
			case 'itemized':
				return {
					mode,
					items: items.map((i) => ({
						name: i.name,
						cents: parseAmount(i.amount) ?? NaN,
						memberIds: ids.filter((id) => i.memberIds.includes(id))
					})),
					taxCents: parseAmount(tax || '0') ?? NaN,
					tipCents: parseAmount(tip || '0') ?? NaN
				};
		}
	});

	const splitResult = $derived(
		totalCents === null || !splitInput ? null : computeSplit(totalCents, splitInput)
	);
	const shareOf = $derived(
		new Map(splitResult?.ok ? splitResult.shares.map((r) => [r.memberId, r.cents]) : [])
	);

	const payersResult = $derived.by(() => {
		if (totalCents === null) return null;
		const rows =
			payerMode === 'single'
				? [{ memberId: payer, cents: totalCents }]
				: ids
						.filter((id) => paid[id]?.trim())
						.map((id) => ({ memberId: id, cents: parseAmount(paid[id]!) ?? NaN }));
		return validatePayers(totalCents, rows);
	});

	const itemsSum = $derived(
		sum(items.map((i) => parseAmount(i.amount) ?? 0)) +
			(parseAmount(tax || '0') ?? 0) +
			(parseAmount(tip || '0') ?? 0)
	);
	const percentSum = $derived(sum(ids.map((id) => parsePercent(percent[id] || '0') ?? 0)));

	const itemsJson = $derived(
		JSON.stringify(
			items.map((i) => ({ name: i.name, amount: i.amount || '0', memberIds: i.memberIds }))
		)
	);

	function onDescription() {
		if (categoryTouched) return;
		category = suggestCategory(description) ?? 'other';
	}

	function toggleItemMember(item: Item, id: string) {
		item.memberIds = item.memberIds.includes(id)
			? item.memberIds.filter((x) => x !== id)
			: [...item.memberIds, id];
	}

	const MODES: { id: SplitMode; label: string; hint: string }[] = [
		{ id: 'equal', label: 'Uguale', hint: 'In parti uguali tra le persone selezionate' },
		{ id: 'exact', label: 'Importi', hint: 'Importi esatti per persona' },
		{ id: 'percent', label: '%', hint: 'Percentuali (la somma deve fare 100%)' },
		{ id: 'shares', label: 'Quote', hint: 'Per parti, es. 2 a Marco e 1 a Giulia' },
		{ id: 'adjust', label: '+/−', hint: 'Parti uguali, più o meno un importo per qualcuno' },
		{
			id: 'itemized',
			label: 'Scontrino',
			hint: 'Voci dello scontrino; tasse e mancia in proporzione'
		}
	];
	const today = new Date().toISOString().slice(0, 10);
</script>

<form
	method="POST"
	enctype="multipart/form-data"
	class="expense-form space-y-6"
	use:trackDirty
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			if (result.type === 'redirect')
				toasts.success(submitLabel === 'Salva modifiche' ? 'Spesa aggiornata' : 'Spesa aggiunta');
			if (result.type === 'error')
				toasts.error('Qualcosa è andato storto. Controlla la connessione e riprova.');
			await update({ reset: false });
			submitting = false;
		};
	}}
	novalidate
>
	{#if errors.form}
		<p
			class="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
			role="alert"
		>
			{errors.form}
		</p>
	{/if}

	<!-- Amount & description -->
	<div class="grid gap-4 sm:grid-cols-[1fr_12rem]">
		<div>
			<label class="field-label" for="description">Descrizione</label>
			<input
				id="description"
				name="description"
				class="field-input"
				required
				maxlength="100"
				placeholder="Es. Cena da Mario"
				autocomplete="off"
				bind:value={description}
				oninput={onDescription}
				aria-invalid={!!errors.description}
				aria-describedby="description-error"
			/>
			<FieldError id="description-error" message={errors.description} />
		</div>
		<div>
			<label class="field-label" for="amount">Importo</label>
			<div class="relative">
				<input
					bind:this={amountInput}
					id="amount"
					name="amount"
					class="field-input pr-10 text-right text-xl font-bold tabular-nums"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0,00"
					required
					bind:value={amount}
					aria-invalid={!!errors.amount || (amount !== '' && totalCents === null)}
					aria-describedby="amount-error"
				/>
				<span
					class="pointer-events-none absolute inset-y-0 right-3 flex items-center font-semibold text-ink-muted"
					>€</span
				>
			</div>
			<FieldError
				id="amount-error"
				message={errors.amount ??
					(amount !== '' && totalCents === null ? 'Importo non valido (es. 12,50)' : null)}
			/>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="field-label" for="category">Categoria</label>
			<select
				id="category"
				name="category"
				class="field-input"
				bind:value={category}
				onchange={() => (categoryTouched = true)}
			>
				{#each CATEGORIES as c (c)}
					<option value={c}
						>{CATEGORY_INFO[c as Category].icon} {CATEGORY_INFO[c as Category].label}</option
					>
				{/each}
			</select>
		</div>
		<div>
			<label class="field-label" for="date">Data</label>
			<input
				id="date"
				name="date"
				type="date"
				class="field-input"
				value={init.date}
				max={today}
				required
				aria-describedby="date-error"
			/>
			<FieldError id="date-error" message={errors.date} />
		</div>
	</div>

	<!-- Payers -->
	<fieldset class="rounded-2xl border border-line p-4">
		<legend class="px-1 font-semibold">Chi ha pagato?</legend>
		<div class="mb-3 flex gap-2" role="radiogroup" aria-label="Numero di pagatori">
			<label class="chip"
				><input
					type="radio"
					name="payer_mode"
					value="single"
					bind:group={payerMode}
					class="sr-only"
				/> Una persona</label
			>
			<label class="chip"
				><input
					type="radio"
					name="payer_mode"
					value="multi"
					bind:group={payerMode}
					class="sr-only"
				/> Più persone</label
			>
		</div>
		<div class="payer-single">
			<label class="sr-only" for="payer">Pagato da</label>
			<select id="payer" name="payer" class="field-input" bind:value={payer}>
				{#each selectable as m (m.id)}
					<option value={m.id}>{m.isMe ? `Tu (${m.name})` : m.name}</option>
				{/each}
			</select>
		</div>
		<div class="payer-multi space-y-2">
			{#each selectable as m (m.id)}
				<div class="flex items-center gap-3">
					<label for="paid_{m.id}" class="flex-1 truncate">{m.isMe ? 'Tu' : m.name}</label>
					<div class="relative w-36">
						<input
							id="paid_{m.id}"
							name="paid_{m.id}"
							class="field-input pr-8 text-right tabular-nums"
							inputmode="decimal"
							placeholder="0,00"
							bind:value={paid[m.id]}
						/>
						<span
							class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
							>€</span
						>
					</div>
				</div>
			{/each}
		</div>
		{#if payersResult && !payersResult.ok && (payerMode === 'multi' || errors.payers)}
			<p class="mt-2 text-sm font-medium text-owe" role="status">{payersResult.message}</p>
		{/if}
		<FieldError id="payers-error" message={errors.payers} />
	</fieldset>

	<!-- Split -->
	<fieldset class="rounded-2xl border border-line p-4">
		<legend class="px-1 font-semibold">Come dividere?</legend>
		<div
			class="mb-1 grid grid-cols-3 gap-2 sm:grid-cols-6"
			role="radiogroup"
			aria-label="Modalità di divisione"
		>
			{#each MODES as m (m.id)}
				<label class="chip justify-center" title={m.hint}>
					<input type="radio" name="split_mode" value={m.id} bind:group={mode} class="sr-only" />
					{m.label}
				</label>
			{/each}
		</div>
		<p class="mb-4 text-sm text-ink-muted">{MODES.find((m) => m.id === mode)?.hint}</p>

		<!-- equal + adjust: participant selection -->
		<div class="mode-panel" data-mode="equal adjust">
			<ul class="space-y-1">
				{#each selectable as m (m.id)}
					<li class="flex items-center gap-3">
						<label class="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								name="participant"
								value={m.id}
								bind:group={participants}
								class="size-5 rounded text-brand-600"
							/>
							<span class="flex-1 truncate">{m.isMe ? 'Tu' : m.name}</span>
						</label>
						<span class="adjust-only flex items-center gap-2">
							<label class="sr-only" for="adjust_{m.id}">Aggiustamento per {m.name}</label>
							<input
								id="adjust_{m.id}"
								name="adjust_{m.id}"
								class="field-input w-28 text-right tabular-nums"
								inputmode="decimal"
								placeholder="+/− 0"
								bind:value={adjust[m.id]}
								disabled={!participants.includes(m.id)}
							/>
						</span>
						<span class="w-20 text-right text-sm text-ink-muted tabular-nums">
							{shareOf.has(m.id) ? formatMoney(shareOf.get(m.id)!) : ''}
						</span>
					</li>
				{/each}
			</ul>
			<div class="mt-2 flex gap-2 text-sm">
				<button
					type="button"
					class="btn-ghost min-h-11 px-3"
					onclick={() => (participants = [...activeIds])}>Tutti</button
				>
				<button type="button" class="btn-ghost min-h-11 px-3" onclick={() => (participants = [])}
					>Nessuno</button
				>
			</div>
		</div>

		<!-- exact / percent / shares -->
		{#each [{ key: 'exact', map: exact, suffix: '€', placeholder: '0,00' }, { key: 'percent', map: percent, suffix: '%', placeholder: '0' }, { key: 'shares', map: shares, suffix: 'parti', placeholder: '0' }] as panel (panel.key)}
			<div class="mode-panel space-y-2" data-mode={panel.key}>
				{#each selectable as m (m.id)}
					<div class="flex items-center gap-3">
						<label for="{panel.key}_{m.id}" class="flex-1 truncate">{m.isMe ? 'Tu' : m.name}</label>
						<div class="relative w-32">
							<input
								id="{panel.key}_{m.id}"
								name="{panel.key}_{m.id}"
								class="field-input pr-12 text-right tabular-nums"
								inputmode="decimal"
								placeholder={panel.placeholder}
								bind:value={panel.map[m.id]}
							/>
							<span
								class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-muted"
								>{panel.suffix}</span
							>
						</div>
						{#if panel.key !== 'exact'}
							<span class="w-20 text-right text-sm text-ink-muted tabular-nums"
								>{shareOf.has(m.id) ? formatMoney(shareOf.get(m.id)!) : ''}</span
							>
						{/if}
					</div>
				{/each}
				{#if panel.key === 'percent'}
					<p class="text-right text-sm text-ink-muted tabular-nums">
						Totale: {(percentSum / 100).toLocaleString('it-IT')}%
					</p>
				{/if}
			</div>
		{/each}

		<!-- itemized -->
		<div class="mode-panel space-y-3" data-mode="itemized">
			<noscript
				><p class="text-sm text-owe">La divisione per voci richiede JavaScript attivo.</p></noscript
			>
			<input type="hidden" name="items_json" value={itemsJson} />
			{#each items as item, i (i)}
				<div class="rounded-xl bg-surface-2 p-3">
					<div class="flex gap-2">
						<label class="sr-only" for="item_name_{i}">Voce {i + 1}</label>
						<input
							id="item_name_{i}"
							class="field-input flex-1"
							placeholder="Voce (es. Pizza)"
							maxlength="80"
							bind:value={item.name}
						/>
						<label class="sr-only" for="item_amount_{i}">Importo voce {i + 1}</label>
						<input
							id="item_amount_{i}"
							class="field-input w-28 text-right tabular-nums"
							inputmode="decimal"
							placeholder="0,00"
							bind:value={item.amount}
						/>
						<button
							type="button"
							class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-3"
							aria-label="Rimuovi voce {i + 1}"
							onclick={() => items.splice(i, 1)}
							disabled={items.length === 1}
						>
							<Icon name="trash" size={18} />
						</button>
					</div>
					<div
						class="mt-2 flex flex-wrap gap-1.5"
						role="group"
						aria-label="Chi ha preso “{item.name || `voce ${i + 1}`}”"
					>
						{#each selectable as m (m.id)}
							<button
								type="button"
								class="min-h-9 rounded-full border px-3 text-sm {item.memberIds.includes(m.id)
									? 'border-brand-600 bg-brand-600 text-white'
									: 'border-line text-ink-muted'}"
								aria-pressed={item.memberIds.includes(m.id)}
								onclick={() => toggleItemMember(item, m.id)}>{m.isMe ? 'Tu' : m.name}</button
							>
						{/each}
					</div>
				</div>
			{/each}
			<button
				type="button"
				class="btn-secondary"
				onclick={() => items.push({ name: '', amount: '', memberIds: [...activeIds] })}
			>
				<Icon name="plus" size={18} /> Aggiungi voce
			</button>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="field-label" for="tax">Tasse / coperto</label>
					<input
						id="tax"
						name="tax"
						class="field-input text-right tabular-nums"
						inputmode="decimal"
						placeholder="0,00"
						bind:value={tax}
					/>
				</div>
				<div>
					<label class="field-label" for="tip">Mancia</label>
					<input
						id="tip"
						name="tip"
						class="field-input text-right tabular-nums"
						inputmode="decimal"
						placeholder="0,00"
						bind:value={tip}
					/>
				</div>
			</div>
			<p class="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
				<span>Somma voci: <strong class="tabular-nums">{formatMoney(itemsSum)}</strong></span>
				{#if itemsSum > 0 && itemsSum !== totalCents}
					<button
						type="button"
						class="btn-ghost min-h-11 px-3 text-brand-700 dark:text-brand-300"
						onclick={() => (amount = centsToInput(itemsSum))}>Usa come totale</button
					>
				{/if}
			</p>
			{#if splitResult?.ok}
				<ul class="text-sm">
					{#each splitResult.shares as r (r.memberId)}
						<li class="flex justify-between">
							<span>{selectable.find((m) => m.id === r.memberId)?.name}</span><span
								class="tabular-nums">{formatMoney(r.cents)}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div aria-live="polite" class="mt-3 min-h-6">
			{#if totalCents && splitResult && !splitResult.ok}
				<p class="text-sm font-semibold text-owe">{splitResult.message}</p>
			{:else if totalCents && splitResult?.ok}
				<p class="flex items-center gap-1 text-sm font-medium text-owed">
					<Icon name="check" size={16} /> Il totale torna
				</p>
			{/if}
		</div>
		<FieldError id="split-error" message={errors.split} />
	</fieldset>

	<!-- Extra -->
	<details class="rounded-2xl border border-line p-4" open={!!init.notes || !!errors.receipt}>
		<summary class="cursor-pointer font-semibold"
			>Note, scontrino{allowRepeat ? ' e ripetizione' : ''}</summary
		>
		<div class="mt-4 space-y-4">
			<div>
				<label class="field-label" for="notes">Note</label>
				<textarea id="notes" name="notes" rows="2" maxlength="1000" class="field-input"
					>{init.notes}</textarea
				>
			</div>
			<div>
				<label class="field-label" for="receipt">Foto dello scontrino</label>
				<input
					id="receipt"
					name="receipt"
					type="file"
					accept="image/jpeg,image/png,image/webp,application/pdf"
					capture="environment"
					class="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-surface-3 file:px-4 file:font-semibold"
					aria-describedby="receipt-hint receipt-error"
				/>
				<p id="receipt-hint" class="mt-1 text-xs text-ink-muted">
					JPG, PNG, WebP o PDF.{init.hasReceipt
						? ' Caricane uno nuovo per sostituire quello attuale.'
						: ''}
				</p>
				{#if init.hasReceipt}
					<label class="mt-2 flex items-center gap-2 text-sm"
						><input type="checkbox" name="remove_receipt" class="rounded" /> Rimuovi lo scontrino attuale</label
					>
				{/if}
				<FieldError id="receipt-error" message={errors.receipt} />
			</div>
			{#if allowRepeat}
				<div>
					<label class="field-label" for="repeat">Ripeti</label>
					<select id="repeat" name="repeat" class="field-input">
						<option value="">Mai</option>
						<option value="weekly">Ogni settimana</option>
						<option value="monthly">Ogni mese</option>
						<option value="yearly">Ogni anno</option>
					</select>
					<p class="mt-1 text-xs text-ink-muted">
						Splitto aggiungerà la spesa in automatico e avviserà i membri.
					</p>
				</div>
			{/if}
		</div>
	</details>

	<div class="sticky bottom-20 z-10 lg:bottom-4">
		<button class="btn-primary w-full shadow-lg" disabled={submitting}>
			{submitting ? 'Salvataggio…' : submitLabel}
		</button>
	</div>
</form>

<style>
	.chip {
		display: inline-flex;
		min-height: 2.75rem;
		cursor: pointer;
		align-items: center;
		gap: 0.25rem;
		border-radius: 9999px;
		border: 1px solid var(--line);
		padding: 0 0.875rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.chip:has(:checked) {
		border-color: var(--color-brand-600);
		background: var(--color-brand-600);
		color: white;
	}
	.chip:has(:focus-visible) {
		outline: 2px solid var(--color-brand-500);
		outline-offset: 2px;
	}

	/* Panels are toggled with :has() so the form also works before/without JavaScript. */
	.mode-panel,
	.payer-multi,
	.adjust-only {
		display: none;
	}
	.payer-single {
		display: block;
	}
	.expense-form:has(input[name='payer_mode'][value='multi']:checked) .payer-multi {
		display: block;
	}
	.expense-form:has(input[name='payer_mode'][value='multi']:checked) .payer-single {
		display: none;
	}
	.expense-form:has(input[name='split_mode'][value='equal']:checked)
		.mode-panel[data-mode~='equal'],
	.expense-form:has(input[name='split_mode'][value='adjust']:checked)
		.mode-panel[data-mode~='adjust'],
	.expense-form:has(input[name='split_mode'][value='exact']:checked) .mode-panel[data-mode='exact'],
	.expense-form:has(input[name='split_mode'][value='percent']:checked)
		.mode-panel[data-mode='percent'],
	.expense-form:has(input[name='split_mode'][value='shares']:checked)
		.mode-panel[data-mode='shares'],
	.expense-form:has(input[name='split_mode'][value='itemized']:checked)
		.mode-panel[data-mode='itemized'] {
		display: block;
	}
	.expense-form:has(input[name='split_mode'][value='adjust']:checked) .adjust-only {
		display: flex;
	}
</style>
