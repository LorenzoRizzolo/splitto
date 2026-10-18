import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'password-sicura-123';

export function uniqueEmail(prefix: string) {
	return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

/** Waits until SvelteKit has hydrated (so enhanced forms and handlers are live). */
export async function hydrated(page: Page) {
	await page.waitForFunction(() => document.body.dataset.hydrated === 'true');
}

export async function register(page: Page, name: string, email: string, path = '/register') {
	await page.goto(path);
	await hydrated(page);
	await page.getByLabel('Nome').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Crea account' }).click();
}

export async function skipOnboarding(page: Page) {
	await expect(page).toHaveURL(/\/app\/welcome/);
	await page.getByRole('button', { name: 'Salta' }).click();
	await expect(page).toHaveURL(/\/app$/);
}
