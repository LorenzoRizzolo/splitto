<script lang="ts">
	import { describeActivity, type ActivityLike } from '$lib/domain/activity-text';
	import { formatRelative } from '$lib/domain/dates';

	let {
		activity,
		showGroup = true
	}: {
		activity: ActivityLike & {
			id: string;
			groupId: string;
			entityId: string | null;
			createdAt: Date | string;
		};
		showGroup?: boolean;
	} = $props();

	const d = $derived(describeActivity(activity));
	const href = $derived(
		activity.type.startsWith('expense') ||
			activity.type === 'comment_added' ||
			activity.type === 'recurring_generated'
			? `/app/expenses/${activity.entityId}`
			: `/app/groups/${activity.groupId}`
	);
	const when = $derived(new Date(activity.createdAt));
</script>

<li>
	<a {href} class="flex items-start gap-3 rounded-xl p-3 hover:bg-surface-3">
		<span
			class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-lg"
			aria-hidden="true">{d.icon}</span
		>
		<span class="min-w-0 flex-1">
			<span class="block text-sm">{d.text}</span>
			<span class="block text-xs text-ink-muted">
				{#if showGroup}{activity.groupKind === 'direct' ? 'Spese tra amici' : activity.groupName} ·
				{/if}
				<time datetime={when.toISOString()}>{formatRelative(when)}</time>
			</span>
		</span>
	</a>
</li>
