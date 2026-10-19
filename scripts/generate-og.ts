// Generates the social/search preview image static/og-image.png (1200×630). Usage: npm run og
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const W = 1200;
const H = 630;
const coin = await readFile('static/favicon.svg');

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f5650"/>
		</linearGradient>
	</defs>
	<rect width="${W}" height="${H}" fill="url(#bg)"/>
	<circle cx="930" cy="315" r="250" fill="#ffffff" fill-opacity="0.08"/>
	<g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#ffffff">
		<text x="80" y="210" font-size="96" font-weight="800" letter-spacing="-2">Splitto</text>
		<text x="80" y="300" font-size="52" font-weight="700">Dividi le spese,</text>
		<text x="80" y="366" font-size="52" font-weight="700" fill="#fde68a">non le amicizie.</text>
		<text x="80" y="450" font-size="30" fill-opacity="0.9">Amici, coinquilini e viaggi: chi deve a chi,</text>
		<text x="80" y="492" font-size="30" fill-opacity="0.9">con il minor numero di pagamenti.</text>
		<text x="80" y="570" font-size="26" font-weight="700" fill-opacity="0.85">Gratis · senza pubblicità</text>
	</g>
</svg>`);

const coinPng = await sharp(coin, { density: 384 }).resize(380, 380).png().toBuffer();

await sharp(background)
	.composite([{ input: coinPng, left: 930 - 190, top: 315 - 190 }])
	.png({ compressionLevel: 9 })
	.toFile('static/og-image.png');
console.log('✔ static/og-image.png');
