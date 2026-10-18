// Deterministic colored-initials avatars.

// 700-level shades: white initials on them meet WCAG AA (≥ 4.5:1).
export const AVATAR_COLORS = [
	'#b91c1c',
	'#c2410c',
	'#a16207',
	'#15803d',
	'#0f766e',
	'#0369a1',
	'#4338ca',
	'#7e22ce',
	'#be185d',
	'#475569'
] as const;

export function pickAvatarColor(seed: string): string {
	let h = 0;
	for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	const first = parts[0]![0] ?? '';
	const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
	return (first + last).toUpperCase();
}
