<script lang="ts">
	let { id, message }: { id: string; message?: string | null } = $props();
</script>

{#if message}
	<p {id} class="field-error" role="alert">{message}</p>
{/if}
