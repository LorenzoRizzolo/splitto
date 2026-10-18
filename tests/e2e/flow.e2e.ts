import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hydrated, PASSWORD, register, skipOnboarding, uniqueEmail } from './helpers';

// Main flow: register → create group → invite → add expense → settle up → balance zero.
test('full Splitto flow between two friends', async ({ browser, isMobile }) => {
	test.skip(isMobile, 'Full flow runs once, on desktop Chrome');
	test.setTimeout(120_000);

	const marcoCtx = await browser.newContext({ locale: 'it-IT' });
	const marco = await marcoCtx.newPage();
	const marcoEmail = uniqueEmail('marco');

	// 1. Registration + onboarding
	await register(marco, 'Marco Rossi', marcoEmail);
	await skipOnboarding(marco);
	await expect(marco.getByRole('heading', { name: /Ciao Marco/ })).toBeVisible();

	// 2. Create a group
	await marco.goto('/app/groups/new');
	await hydrated(marco);
	await marco.getByLabel('Nome del gruppo').fill('Casa E2E');
	await marco.getByRole('radio', { name: 'Casa' }).check({ force: true });
	await marco.getByRole('button', { name: 'Crea gruppo' }).click();
	await expect(marco.getByRole('heading', { level: 1, name: 'Casa E2E' })).toBeVisible();
	const groupUrl = new URL(marco.url()).pathname;

	// 3. Invite link
	await marco.goto(`${groupUrl}/settings`);
	await hydrated(marco);
	await marco.getByRole('button', { name: 'Crea link di invito' }).click();
	const inviteUrl = (await marco.locator('li .font-mono').first().textContent())!.trim();
	expect(inviteUrl).toMatch(/\/invite\//);

	// 4. Giulia opens the invite, registers and joins
	const giuliaCtx = await browser.newContext({ locale: 'it-IT' });
	const giulia = await giuliaCtx.newPage();
	await giulia.goto(new URL(inviteUrl).pathname);
	await expect(giulia.getByRole('heading', { name: /Unisciti a “Casa E2E”/ })).toBeVisible();
	await giulia.getByRole('button', { name: 'Registrati e unisciti' }).click();
	await expect(giulia).toHaveURL(/\/register\?redirectTo=/);
	await hydrated(giulia);
	await giulia.getByLabel('Nome').fill('Giulia Bianchi');
	await giulia.getByLabel('Email').fill(uniqueEmail('giulia'));
	await giulia.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await giulia.getByRole('button', { name: 'Crea account' }).click();
	await expect(giulia).toHaveURL(/\/invite\//);
	await giulia.getByRole('button', { name: 'Unisciti' }).click();
	await expect(giulia.getByRole('heading', { level: 1, name: 'Casa E2E' })).toBeVisible();

	// 5. Marco adds a 90 € expense split equally (with a live validation check on exact amounts)
	await marco.goto(`/app/expenses/new?group=${groupUrl.split('/').pop()}`);
	await hydrated(marco);
	await expect(marco.getByLabel('Importo', { exact: true })).toBeFocused();
	await marco.getByLabel('Importo', { exact: true }).fill('90');
	await marco.getByLabel('Descrizione').fill('Cena di benvenuto');
	await expect(marco.getByLabel('Categoria')).toHaveValue('food'); // suggested from "cena"
	await marco.locator('label', { hasText: /^\s*Importi\s*$/ }).click();
	await marco.locator('[id^="exact_"]').first().fill('50');
	await expect(marco.getByText('Mancano 40,00 €')).toBeVisible();
	await marco.locator('label', { hasText: /^\s*Uguale\s*$/ }).click();
	await expect(marco.getByText('Il totale torna')).toBeVisible();
	await marco.getByRole('button', { name: 'Aggiungi spesa' }).click();
	await expect(marco.getByText('Cena di benvenuto')).toBeVisible();
	await expect(marco.getByText('hai prestato')).toBeVisible();

	// 6. Giulia sees what she owes and settles up
	await giulia.goto(`${groupUrl}/balances`);
	await hydrated(giulia);
	await expect(giulia.getByText('Devi 45,00 € a Marco Rossi')).toBeVisible();
	await giulia.getByRole('link', { name: 'Salda' }).first().click();
	await expect(giulia.getByLabel('Importo', { exact: true })).toHaveValue('45,00');
	await giulia.getByRole('radio', { name: 'Satispay' }).check({ force: true });
	await giulia.getByRole('button', { name: 'Registra rimborso' }).click();

	// 7. Everyone is even
	await expect(giulia.getByText('Siete pari!').first()).toBeVisible();
	await marco.goto(`${groupUrl}/balances`);
	await expect(marco.getByText('Nessuno deve niente a nessuno in questo gruppo.')).toBeVisible();
	await marco.goto('/app/activity');
	await expect(marco.getByText(/registrato un rimborso/)).toBeVisible();

	// Accessibility of the main authenticated screens
	for (const path of ['/app', groupUrl, `${groupUrl}/balances`]) {
		await marco.goto(path);
		await hydrated(marco);
		const results = await new AxeBuilder({ page: marco }).withTags(['wcag2a', 'wcag2aa']).analyze();
		const serious = results.violations.filter(
			(v) => v.impact === 'serious' || v.impact === 'critical'
		);
		expect(
			serious.map(
				(v) =>
					`${path}: ${v.id} — ${v.nodes
						.map((n) => n.target.join(' '))
						.slice(0, 3)
						.join(', ')}`
			)
		).toEqual([]);
	}

	await marcoCtx.close();
	await giuliaCtx.close();
});

test('a user cannot open groups or expenses of other people by changing the URL', async ({
	browser,
	isMobile
}) => {
	test.skip(isMobile, 'Desktop only');
	const ownerCtx = await browser.newContext();
	const owner = await ownerCtx.newPage();
	await register(owner, 'Proprietario', uniqueEmail('owner'));
	await skipOnboarding(owner);
	await owner.goto('/app/groups/new');
	await hydrated(owner);
	await owner.getByLabel('Nome del gruppo').fill('Segreto');
	await owner.getByRole('button', { name: 'Crea gruppo' }).click();
	await expect(owner.getByRole('heading', { level: 1, name: 'Segreto' })).toBeVisible();
	const groupUrl = new URL(owner.url()).pathname;

	const otherCtx = await browser.newContext();
	const other = await otherCtx.newPage();
	await register(other, 'Curioso', uniqueEmail('other'));
	await skipOnboarding(other);
	for (const path of [
		groupUrl,
		`${groupUrl}/balances`,
		`${groupUrl}/settings`,
		`${groupUrl}/export.csv`
	]) {
		const res = await other.goto(path);
		expect(res?.status(), path).toBe(404);
	}
	await ownerCtx.close();
	await otherCtx.close();
});
