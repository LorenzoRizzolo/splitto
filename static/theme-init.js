// Runs before first paint: applies the theme ("light" | "dark" | system) and reduced motion.
// Also captures `beforeinstallprompt`, which can fire before the app has hydrated.
(function () {
	try {
		var theme = localStorage.getItem('splitto-theme');
		if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
		if (localStorage.getItem('splitto-reduce-motion') === 'true') {
			document.documentElement.dataset.reduceMotion = 'true';
		}
	} catch {
		/* storage unavailable: follow the system */
	}
	window.addEventListener('beforeinstallprompt', function (e) {
		e.preventDefault();
		window.__splittoInstallPrompt = e;
		window.dispatchEvent(new Event('splitto:installable'));
	});
})();
