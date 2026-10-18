let cached: boolean | undefined;

/** Whether WebGL is available (cached). */
export function hasWebGL(): boolean {
	if (cached !== undefined) return cached;
	try {
		const canvas = document.createElement('canvas');
		cached = !!(
			window.WebGLRenderingContext &&
			(canvas.getContext('webgl2') || canvas.getContext('webgl'))
		);
	} catch {
		cached = false;
	}
	return cached;
}
