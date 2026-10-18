import { fail } from '@sveltejs/kit';
import { z } from 'zod';

export type FieldErrors = Record<string, string>;

/** Converts FormData to a plain object; repeated keys become arrays. Files are skipped. */
export function formToObject(data: FormData): Record<string, string | string[]> {
	const out: Record<string, string | string[]> = {};
	for (const [key, value] of data.entries()) {
		if (typeof value !== 'string') continue;
		const prev = out[key];
		if (prev === undefined) out[key] = value;
		else out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
	}
	return out;
}

export function issuesToErrors(issues: z.core.$ZodIssue[]): FieldErrors {
	const errors: FieldErrors = {};
	for (const issue of issues) {
		const key = issue.path.length ? issue.path.join('.') : 'form';
		errors[key] ??= issue.message;
	}
	return errors;
}

/** Values echoed back to the form after a failed submission (never passwords). */
function safeValues(obj: Record<string, string | string[]>) {
	const values: Record<string, string | string[]> = {};
	for (const [k, v] of Object.entries(obj)) if (!/password/i.test(k)) values[k] = v;
	return values;
}

export function parseForm<T extends z.ZodType>(schema: T, data: FormData) {
	const raw = formToObject(data);
	const result = schema.safeParse(raw);
	if (result.success) return { ok: true as const, data: result.data as z.infer<T>, raw };
	return {
		ok: false as const,
		errors: issuesToErrors(result.error.issues),
		values: safeValues(raw)
	};
}

/** Standard 400 response for a form: `{ errors, values, action }`. */
export function invalid(
	errors: FieldErrors,
	values: Record<string, unknown> = {},
	action?: string
) {
	return fail(400, { errors, values, action });
}

// --- Shared field schemas (Italian messages) ------------------------------------------------

export const zName = z
	.string({ error: 'Inserisci il nome' })
	.trim()
	.min(1, 'Inserisci il nome')
	.max(60, 'Massimo 60 caratteri');

export const zEmail = z
	.string({ error: "Inserisci l'email" })
	.trim()
	.toLowerCase()
	.min(1, "Inserisci l'email")
	.max(254, 'Email troppo lunga')
	.pipe(z.email('Email non valida'));

export const zPassword = z
	.string({ error: 'Inserisci la password' })
	.min(8, 'La password deve avere almeno 8 caratteri')
	.max(128, 'Massimo 128 caratteri');

export const zCheckbox = z
	.union([z.literal('on'), z.literal('true'), z.literal('1'), z.literal('')])
	.optional()
	.transform((v) => v === 'on' || v === 'true' || v === '1');

export const zId = z.string().trim().min(1).max(64);

export const zDate = z
	.string({ error: 'Inserisci la data' })
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida')
	.refine((s) => !Number.isNaN(Date.parse(s)), 'Data non valida');
