import { z } from 'zod';
import { GROUP_TYPES } from './db/schema';
import { parseAmount } from '$lib/domain/money';
import { zName } from './forms';

export const groupSchema = z.object({
	name: zName,
	emoji: z.string().trim().min(1).max(16).default('👥'),
	type: z.enum(GROUP_TYPES, { error: 'Scegli un tipo di gruppo' }).default('other'),
	budget: z
		.string()
		.optional()
		.transform((v, ctx) => {
			if (!v || !v.trim()) return null;
			const cents = parseAmount(v);
			if (cents === null || cents === 0) {
				ctx.addIssue({ code: 'custom', message: 'Budget non valido (es. 1500)' });
				return z.NEVER;
			}
			return cents;
		})
});

export function toGroupInput(data: z.infer<typeof groupSchema>) {
	return {
		name: data.name,
		emoji: data.emoji,
		type: data.type,
		budgetCents: data.budget
	};
}
