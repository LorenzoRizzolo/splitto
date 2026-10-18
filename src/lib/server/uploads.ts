import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { config } from './config';
import { newId } from './db/id';

export type UploadKind = 'avatars' | 'receipts';
type FileType = { ext: string; mime: string };

const TYPES: Record<string, FileType> = {
	jpeg: { ext: 'jpg', mime: 'image/jpeg' },
	png: { ext: 'png', mime: 'image/png' },
	webp: { ext: 'webp', mime: 'image/webp' },
	pdf: { ext: 'pdf', mime: 'application/pdf' }
};

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
	Object.values(TYPES).map((t) => [t.ext, t.mime])
);

/** Detects the real file type from magic bytes (never trust the browser-provided MIME). */
export function detectFileType(bytes: Uint8Array): keyof typeof TYPES | null {
	const b = bytes;
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
	if (
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46 &&
		b[8] === 0x57 &&
		b[9] === 0x45 &&
		b[10] === 0x42 &&
		b[11] === 0x50
	)
		return 'webp';
	if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
	return null;
}

export class UploadError extends Error {}

const ALLOWED: Record<UploadKind, (keyof typeof TYPES)[]> = {
	avatars: ['jpeg', 'png', 'webp'],
	receipts: ['jpeg', 'png', 'webp', 'pdf']
};

/** Validates and stores an uploaded file; returns its path relative to the upload dir. */
export async function saveUpload(file: File, kind: UploadKind): Promise<string> {
	if (file.size === 0) throw new UploadError('Il file è vuoto');
	if (file.size > config.uploadMaxBytes) {
		throw new UploadError(`Il file supera ${Math.round(config.uploadMaxBytes / 1024 / 1024)} MB`);
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = detectFileType(bytes);
	if (!type || !ALLOWED[kind].includes(type)) {
		throw new UploadError(
			kind === 'avatars'
				? 'Usa un’immagine JPG, PNG o WebP'
				: 'Usa un’immagine (JPG, PNG, WebP) o un PDF'
		);
	}
	const dir = join(config.uploadDir, kind);
	await mkdir(dir, { recursive: true });
	const rel = `${kind}/${newId()}.${TYPES[type]!.ext}`;
	await writeFile(join(config.uploadDir, rel), bytes, { mode: 0o640 });
	return rel;
}

function safePath(rel: string): string {
	const root = resolve(config.uploadDir);
	const full = resolve(root, rel);
	if (!full.startsWith(root + sep)) throw new UploadError('Percorso non valido');
	return full;
}

export async function readUpload(rel: string): Promise<{ data: Buffer; mime: string } | null> {
	try {
		const data = await readFile(safePath(rel));
		const ext = rel.split('.').pop() ?? '';
		return { data, mime: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
	} catch {
		return null;
	}
}

export async function deleteUpload(rel: string | null | undefined) {
	if (!rel) return;
	try {
		await unlink(safePath(rel));
	} catch {
		/* already gone */
	}
}

/** Returns the uploaded File from FormData, or null if the field is empty. */
export function fileField(data: FormData, name: string): File | null {
	const v = data.get(name);
	return v instanceof File && v.size > 0 ? v : null;
}
