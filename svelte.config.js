import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes mode for the project, except for libraries.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Note: SvelteKit's built-in Origin check for form submissions (CSRF protection) is on by
		// default; do not add entries to `csrf.trustedOrigins` unless strictly required.
		adapter: adapter(),
		// The service worker is registered manually (src/lib/client/sw.ts) to control updates.
		serviceWorker: { register: false },
		version: { pollInterval: 5 * 60 * 1000 },
		// Only /offline is prerendered; do not follow its links into the authenticated app.
		prerender: { crawl: false },
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte transitions and Threlte inject inline styles.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
