// Generates VAPID keys for Web Push and writes them into .env. Usage: npm run vapid:generate [-- --force]
import webpush from 'web-push';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const force = process.argv.includes('--force');
if (!existsSync('.env')) copyFileSync('.env.example', '.env');
let env = readFileSync('.env', 'utf8');

const current = /^VAPID_PUBLIC_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (current && !force) {
	console.log('ℹ Le chiavi VAPID sono già presenti in .env (usa -- --force per rigenerarle:');
	console.log('  attenzione, tutte le sottoscrizioni push esistenti smetteranno di funzionare).');
	process.exit(0);
}

const keys = webpush.generateVAPIDKeys();
const set = (name: string, value: string) => {
	const line = `${name}=${value}`;
	env = new RegExp(`^${name}=.*$`, 'm').test(env)
		? env.replace(new RegExp(`^${name}=.*$`, 'm'), line)
		: `${env.trimEnd()}\n${line}\n`;
};
set('VAPID_PUBLIC_KEY', keys.publicKey);
set('VAPID_PRIVATE_KEY', keys.privateKey);
writeFileSync('.env', env);
console.log('✔ Chiavi VAPID salvate in .env');
console.log(`  Pubblica: ${keys.publicKey}`);
