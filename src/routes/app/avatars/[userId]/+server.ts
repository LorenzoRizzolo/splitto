import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { readUpload } from '$lib/server/uploads';

export const GET: RequestHandler = async ({ params }) => {
	const user = db
		.select({ avatarPath: users.avatarPath })
		.from(users)
		.where(eq(users.id, params.userId))
		.get();
	if (!user?.avatarPath) error(404);
	const file = await readUpload(user.avatarPath);
	if (!file) error(404);
	// URL carries ?v=<path>, so it can be cached for long.
	return new Response(new Uint8Array(file.data), {
		headers: { 'Content-Type': file.mime, 'Cache-Control': 'private, max-age=31536000, immutable' }
	});
};
