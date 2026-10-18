<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { coinMaterials, roomEnvironment } from './materials';

	/** Coins and confetti raining down for ~3.5 s, then onDone. */
	let { onDone }: { onDone: () => void } = $props();

	const { renderer, scene } = useThrelte();
	const env = roomEnvironment(renderer as THREE.WebGLRenderer);
	scene.environment = env;

	const COINS = 60;
	const CONFETTI = 140;
	const coins = coinMaterials();
	const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 32);
	const confettiGeo = new THREE.PlaneGeometry(0.09, 0.16);
	const confettiMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 });
	const coinMesh = new THREE.InstancedMesh(coinGeo, coins.list, COINS);
	const confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, CONFETTI);
	const palette = ['#14b8a6', '#f59e0b', '#ec4899', '#6366f1', '#22c55e', '#fde047'].map(
		(c) => new THREE.Color(c)
	);

	type P = {
		x: number;
		y: number;
		z: number;
		vy: number;
		vx: number;
		rx: number;
		ry: number;
		sx: number;
		sy: number;
	};
	const spawn = (i: number, n: number): P => ({
		x: (Math.random() - 0.5) * 9,
		y: 4 + Math.random() * 5 + (i / n) * 3,
		z: (Math.random() - 0.5) * 3,
		vy: 3 + Math.random() * 3,
		vx: (Math.random() - 0.5) * 0.6,
		rx: Math.random() * Math.PI,
		ry: Math.random() * Math.PI,
		sx: (Math.random() - 0.5) * 10,
		sy: (Math.random() - 0.5) * 10
	});
	const coinP = Array.from({ length: COINS }, (_, i) => spawn(i, COINS));
	const confP = Array.from({ length: CONFETTI }, (_, i) => spawn(i, CONFETTI));
	for (let i = 0; i < CONFETTI; i++) confettiMesh.setColorAt(i, palette[i % palette.length]!);

	const dummy = new THREE.Object3D();
	let t = 0;
	let finished = false;

	function step(mesh: THREE.InstancedMesh, ps: P[], delta: number, flutter: boolean) {
		ps.forEach((p, i) => {
			p.y -= p.vy * delta * (flutter ? 0.6 : 1);
			p.x += (flutter ? Math.sin(t * 3 + i) * 0.6 : p.vx) * delta;
			p.rx += p.sx * delta;
			p.ry += p.sy * delta;
			dummy.position.set(p.x, p.y, p.z);
			dummy.rotation.set(p.rx, p.ry, 0);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		});
		mesh.instanceMatrix.needsUpdate = true;
	}

	useTask((delta) => {
		t += delta;
		step(coinMesh, coinP, delta, false);
		step(confettiMesh, confP, delta, true);
		if (t > 3.6 && !finished) {
			finished = true;
			onDone();
		}
	});

	onDestroy(() => {
		coins.dispose();
		coinGeo.dispose();
		confettiGeo.dispose();
		confettiMat.dispose();
		coinMesh.dispose();
		confettiMesh.dispose();
		env.dispose();
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
<T.DirectionalLight position={[2, 4, 6]} intensity={1.6} />
<T.AmbientLight intensity={0.6} />
<T is={coinMesh} />
<T is={confettiMesh} />
