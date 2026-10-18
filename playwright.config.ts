import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: `http://localhost:${PORT}`, locale: 'it-IT', trace: 'on-first-retry' },
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: {
		// Every run starts from an empty database (migrations run when the server starts).
		command:
			"node -e \"for (const f of ['data/e2e.db','data/e2e.db-wal','data/e2e.db-shm','data/e2e-uploads']) require('fs').rmSync(f,{recursive:true,force:true})\" && npm run build && npm run preview -- --port 4173 --strictPort",
		port: PORT,
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			DATABASE_PATH: './data/e2e.db',
			UPLOAD_DIR: './data/e2e-uploads',
			ORIGIN: `http://localhost:${PORT}`,
			RATE_LIMIT_SCALE: '100',
			JOBS_ENABLED: 'false',
			VAPID_PUBLIC_KEY: '',
			VAPID_PRIVATE_KEY: ''
		}
	}
});
