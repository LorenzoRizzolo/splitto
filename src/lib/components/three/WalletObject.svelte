<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { coinMaterials, roomEnvironment } from './materials';

	/** Wallet opens, coins fly in, wallet closes. Calls onDone at the end (~2.8 s). */
	let { onDone }: { onDone: () => void } = $props();

	const { renderer, scene } = useThrelte();
	const env = roomEnvironment(renderer as THREE.WebGLRenderer);
	scene.environment = env;
	const coins = coinMaterials();
	const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 48);
	const leather = new THREE.MeshStandardMaterial({
		color: '#0f766e',
		roughness: 0.6,
		metalness: 0.1
	});
	const leatherDark = new THREE.MeshStandardMaterial({ color: '#0a524c', roughness: 0.7 });
	const stitch = new THREE.MeshStandardMaterial({
		color: '#fcd34d',
		roughness: 0.4,
		metalness: 0.4
	});

	const COINS = 6;
	const starts = Array.from({ length: COINS }, (_, i) => ({
		x: (i - (COINS - 1) / 2) * 0.55 + (Math.random() - 0.5) * 0.2,
		y: 2.4 + Math.random() * 0.6,
		delay: 0.45 + i * 0.12,
		spin: 4 + Math.random() * 4
	}));

	let flap = $state<THREE.Group>();
	let wallet = $state<THREE.Group>();
	const coinRefs: (THREE.Mesh | undefined)[] = $state(Array(COINS).fill(undefined));
	let t = 0;
	let finished = false;

	const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

	useTask((delta) => {
		t += delta;
		// Flap: open 0–0.5s, stay, close 2.0–2.4s.
		const open = t < 2 ? ease(t / 0.5) : 1 - ease((t - 2) / 0.4);
		if (flap) flap.rotation.x = -open * 2.1;
		if (wallet) {
			wallet.rotation.y = Math.sin(t * 1.2) * 0.25;
			wallet.position.y =
				t > 2.3 ? Math.sin((t - 2.3) * 14) * 0.04 * Math.max(0, 1 - (t - 2.3) * 2) : 0;
		}
		starts.forEach((s, i) => {
			const c = coinRefs[i];
			if (!c) return;
			const p = ease((t - s.delay) / 0.7);
			c.visible = t > s.delay && p < 1;
			c.position.set(
				s.x * (1 - p),
				s.y * (1 - p) + 0.35 * Math.sin(p * Math.PI) + 0.15,
				0.15 * (1 - p)
			);
			c.rotation.x = Math.PI / 2 + t * s.spin;
			const k = 1 - p * 0.6;
			c.scale.set(k, k, k);
		});
		if (t > 2.8 && !finished) {
			finished = true;
			onDone();
		}
	});

	onDestroy(() => {
		coins.dispose();
		coinGeo.dispose();
		leather.dispose();
		leatherDark.dispose();
		stitch.dispose();
		env.dispose();
	});
</script>

<T.PerspectiveCamera
	makeDefault
	position={[0, 0.9, 5.2]}
	fov={38}
	oncreate={(cam) => cam.lookAt(0, 0.2, 0)}
/>
<T.DirectionalLight position={[2, 5, 4]} intensity={1.8} />
<T.AmbientLight intensity={0.5} />

<T.Group bind:ref={wallet} position={[0, -0.4, 0]}>
	<!-- Body -->
	<T.Mesh material={leather} position={[0, 0, 0]}>
		<T.BoxGeometry args={[2.6, 1.6, 0.4]} />
	</T.Mesh>
	<T.Mesh material={leatherDark} position={[0, 0.79, 0]}>
		<T.BoxGeometry args={[2.5, 0.04, 0.32]} />
	</T.Mesh>
	<T.Mesh material={stitch} position={[0, -0.55, 0.205]}>
		<T.BoxGeometry args={[2.3, 0.03, 0.01]} />
	</T.Mesh>
	<!-- Flap, hinged on the back top edge -->
	<T.Group bind:ref={flap} position={[0, 0.8, -0.2]}>
		<T.Mesh material={leather} position={[0, -0.45, 0.24]}>
			<T.BoxGeometry args={[2.6, 0.9, 0.08]} />
		</T.Mesh>
		<T.Mesh material={stitch} position={[0, -0.82, 0.29]}>
			<T.CylinderGeometry args={[0.12, 0.12, 0.04, 32]} />
		</T.Mesh>
	</T.Group>
</T.Group>

{#each starts as _, i (i)}
	<T.Mesh bind:ref={coinRefs[i]} geometry={coinGeo} material={coins.list} visible={false} />
{/each}
