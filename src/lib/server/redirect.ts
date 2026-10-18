/** Only allows same-site relative paths (prevents open redirects). */
export function safeRedirect(target: string | null | undefined, fallback = '/app'): string {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
		return fallback;
	}
	return target;
}
