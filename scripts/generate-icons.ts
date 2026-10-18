// Generates PWA icons from scripts/icon.svg and static/favicon.svg. Usage: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const square = await readFile('scripts/icon.svg');
const coin = await readFile('static/favicon.svg');

async function png(
	svg: Buffer,
	size: number,
	out: string,
	opts: { padding?: number; background?: string } = {}
) {
	const pad = Math.round(size * (opts.padding ?? 0));
	const inner = await sharp(svg, { density: 384 })
		.resize(size - pad * 2, size - pad * 2)
		.png()
		.toBuffer();
	await sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: opts.background ?? { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([{ input: inner, left: pad, top: pad }])
		.png()
		.toFile(out);
	console.log('✔', out);
}

// "any" icons: the coin on a transparent background.
await png(coin, 192, 'static/icons/icon-192.png', { padding: 0.04 });
await png(coin, 512, 'static/icons/icon-512.png', { padding: 0.04 });
// Maskable: full-bleed background, artwork in the safe zone.
await png(square, 192, 'static/icons/maskable-192.png');
await png(square, 512, 'static/icons/maskable-512.png');
// iOS ignores transparency: use the square artwork.
await png(square, 180, 'static/icons/apple-touch-icon.png');
// Shortcut icons.
await png(square, 96, 'static/icons/shortcut-groups.png');
await png(coin, 96, 'static/icons/shortcut-add.png', { padding: 0.08, background: '#0f766e' });
