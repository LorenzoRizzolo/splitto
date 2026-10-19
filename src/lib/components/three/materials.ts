import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Procedural coin face with an embossed "S" (no image files to download).
 * CylinderGeometry cap UVs are rotated 90° relative to the coin once it is stood up with
 * rotation.x = PI/2 (canvas "up" ends up pointing right), so the drawing is pre-rotated 90° CCW
 * to keep the "S" upright. The same mapping holds for the bottom cap seen after a half spin.
 */
export function coinFaceTexture(): THREE.CanvasTexture {
	const size = 512;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	const c = size / 2;
	ctx.translate(c, c);
	ctx.rotate(-Math.PI / 2);
	ctx.translate(-c, -c);
	const g = ctx.createRadialGradient(c * 0.7, c * 0.6, 20, c, c, c);
	g.addColorStop(0, '#fff3b0');
	g.addColorStop(0.45, '#f8c33c');
	g.addColorStop(1, '#b7791f');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	ctx.lineWidth = 18;
	ctx.strokeStyle = 'rgba(120, 72, 10, 0.45)';
	ctx.beginPath();
	ctx.arc(c, c, c - 40, 0, Math.PI * 2);
	ctx.stroke();
	ctx.font = `900 ${size * 0.58}px system-ui, -apple-system, "Segoe UI", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = 'rgba(255, 250, 220, 0.55)';
	ctx.fillText('S', c - 6, c + 18);
	ctx.fillStyle = '#8a5a12';
	ctx.fillText('S', c, c + 24);
	const tex = new THREE.CanvasTexture(canvas);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

/** Studio-like reflections without loading an HDR file. */
export function roomEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
	const pmrem = new THREE.PMREMGenerator(renderer);
	const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	pmrem.dispose();
	return env;
}

export function coinMaterials() {
	const front = coinFaceTexture();
	const back = coinFaceTexture();
	const side = new THREE.MeshStandardMaterial({
		color: '#e8a92a',
		metalness: 1,
		roughness: 0.25,
		envMapIntensity: 1.4
	});
	const face = {
		metalness: 0.55,
		roughness: 0.3,
		envMapIntensity: 1.3,
		emissive: new THREE.Color('#3a2400'),
		emissiveIntensity: 0.25
	};
	const top = new THREE.MeshStandardMaterial({ map: front, ...face });
	const bottom = new THREE.MeshStandardMaterial({ map: back, ...face });
	return {
		// CylinderGeometry groups: 0 = side, 1 = top cap, 2 = bottom cap.
		list: [side, top, bottom],
		dispose() {
			[front, back].forEach((t) => t.dispose());
			[side, top, bottom].forEach((m) => m.dispose());
		}
	};
}
