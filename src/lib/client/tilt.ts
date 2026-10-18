import { prefs } from './preferences.svelte';

/** Svelte action: subtle 3D tilt that follows the mouse (disabled on touch / reduced motion). */
export function tilt(node: HTMLElement, maxDeg = 6) {
	const fine = matchMedia('(hover: hover) and (pointer: fine)');
	node.style.transformStyle = 'preserve-3d';
	node.style.transition = 'transform 180ms ease-out';

	function move(e: PointerEvent) {
		if (!fine.matches || prefs.motionReduced) return;
		const r = node.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width - 0.5;
		const y = (e.clientY - r.top) / r.height - 0.5;
		node.style.transform = `perspective(700px) rotateX(${(-y * maxDeg).toFixed(2)}deg) rotateY(${(x * maxDeg).toFixed(2)}deg) translateZ(0)`;
	}
	function leave() {
		node.style.transform = '';
	}
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerleave', leave);
	return {
		destroy() {
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerleave', leave);
		}
	};
}
