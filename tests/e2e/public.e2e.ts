import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hydrated } from './helpers';

test('home explains the app and shows the main actions', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Dividi le spese');
	await expect(page.getByRole('link', { name: /Inizia gratis/ }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Accedi' }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Come funziona' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Domande frequenti' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Installa/ }).first()).toBeVisible();
});

test('interactive example updates live and shows debt simplification', async ({ page }) => {
	await page.goto('/');
	await hydrated(page);
	const demo = page.locator('#demo-title').locator('..');
	await page.getByLabel('Aggiungi il taxi').uncheck();
	await expect(demo.getByText('Giulia deve 30,00 € a Marco')).toBeVisible();
	await page.getByLabel('🍝 Cena').fill('120');
	await expect(demo.getByText('Giulia deve 40,00 € a Marco')).toBeVisible();
});

test('protected pages redirect to login', async ({ page }) => {
	await page.goto('/app/groups');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fapp%2Fgroups/);
});

test('offline page is available', async ({ page }) => {
	await page.goto('/offline');
	await expect(page.getByRole('heading', { name: 'Sei offline' })).toBeVisible();
});

test('public pages have no serious accessibility violations (light and dark)', async ({ page }) => {
	for (const [path, colorScheme] of [
		['/', 'light'],
		['/', 'dark'],
		['/login', 'light'],
		['/login', 'dark'],
		['/register', 'light']
	] as const) {
		await page.emulateMedia({ colorScheme });
		await page.goto(path);
		await hydrated(page);
		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
		const serious = results.violations.filter(
			(v) => v.impact === 'serious' || v.impact === 'critical'
		);
		expect(
			serious.map(
				(v) =>
					`${path} (${colorScheme}): ${v.id} — ${v.nodes
						.map((n) => n.target.join(' '))
						.slice(0, 3)
						.join(', ')}`
			)
		).toEqual([]);
	}
});
