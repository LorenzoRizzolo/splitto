import { z } from 'zod';
import type { Actions } from './$types';
import { invalid, parseForm, zEmail } from '$lib/server/forms';
import { limiters, retryMessage } from '$lib/server/auth/rate-limit';
import { requestPasswordReset } from '$lib/server/auth/password-reset';

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = parseForm(z.object({ email: zEmail }), await request.formData());
		if (!form.ok) return invalid(form.errors, form.values);
		const limit = limiters.passwordReset.hit(`${getClientAddress()}|${form.data.email}`);
		if (!limit.allowed) return invalid({ form: retryMessage(limit.retryAfterSec) }, form.data);
		await requestPasswordReset(form.data.email);
		// Same answer whether or not the email exists (no account enumeration).
		return { sent: true, email: form.data.email };
	}
};
