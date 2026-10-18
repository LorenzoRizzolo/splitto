// PM2 configuration for Splitto.
//   pm2 start produzione/ecosystem.config.cjs   (from the project folder)
//   pm2 save && pm2 startup                    (restart automatically after a reboot)
// See produzione/GUIDA.md for every command.
const path = require('node:path');

module.exports = {
	apps: [
		{
			name: 'splitto',
			cwd: path.resolve(__dirname, '..'),
			script: 'build/index.js',
			// Variables are read from .env (ORIGIN, PORT, DATABASE_PATH, VAPID keys, BODY_SIZE_LIMIT…).
			node_args: '--env-file=.env',
			env: { NODE_ENV: 'production' },
			// SQLite + in-process jobs: exactly one instance, never cluster mode.
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			max_restarts: 10,
			restart_delay: 3000,
			max_memory_restart: '400M',
			kill_timeout: 5000,
			time: true,
			out_file: path.resolve(__dirname, '../logs/splitto.out.log'),
			error_file: path.resolve(__dirname, '../logs/splitto.err.log'),
			merge_logs: true
		}
	]
};
