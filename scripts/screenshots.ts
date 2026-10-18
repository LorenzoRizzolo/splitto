// Captures the PWA manifest screenshots from a running instance with seed data.
// Usage: npm run db:seed -- --reset && npm run dev   (in another terminal)  then  npm run screenshots
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();

async function session(viewport: { width: number; height: number }, scale: number) {
	const ctx = await browser.newContext({
		viewport,
		deviceScaleFactor: scale,
		locale: 'it-IT',
		reducedMotion: 'reduce'
	});
	const page = await ctx.newPage();
	await page.goto(`${BASE}/login`);
	await page.waitForLoadState('networkidle');
	await page.fill('#email', 'giulia@splitto.test');
	await page.fill('#password', 'splitto-demo');
	await page.click('button[type=submit], form button');
	await page.waitForURL('**/app');
	return page;
}

const trip = async (page: import('@playwright/test').Page) => {
	await page.goto(`${BASE}/app/groups`);
	return page.locator('a:has-text("Lisbona")').first().getAttribute('href');
};

const mobile = await session({ width: 360, height: 760 }, 3);
await mobile.screenshot({ path: 'static/screenshots/mobile-dashboard.png' });
const href = await trip(mobile);
await mobile.goto(`${BASE}${href}/balances`);
await mobile.screenshot({ path: 'static/screenshots/mobile-balances.png' });

const desktop = await session({ width: 1920, height: 1080 }, 1);
await desktop.goto(`${BASE}${await trip(desktop)}`);
await desktop.screenshot({ path: 'static/screenshots/desktop-group.png' });

await browser.close();
console.log('✔ Screenshot salvati in static/screenshots/');
