/** Shares text with the Web Share API, falling back to the clipboard. */
export async function shareText(
	text: string,
	title = 'Splitto'
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
	if (navigator.share) {
		try {
			await navigator.share({ title, text });
			return 'shared';
		} catch (err) {
			if ((err as DOMException).name === 'AbortError') return 'cancelled';
		}
	}
	try {
		await navigator.clipboard.writeText(text);
		return 'copied';
	} catch {
		return 'failed';
	}
}
