<script lang="ts">
	import { T, useTask, useThrelte } from '@threlte/core';
	import { onDestroy } from 'svelte';
	import * as THREE from 'three';
	import { coinMaterials, roomEnvironment } from './materials';

	let { running }: { running: boolean } = $props();

	const { renderer, scene } = useThrelte();
	const env = roomEnvironment(renderer as THREE.WebGLRenderer);
	scene.environment = env;
	const materials = coinMaterials();
	const geometry = new THREE.CylinderGeometry(1, 1, 0.16, 96, 1);

	let group = $state<THREE.Group>();
	let t = 0;
	useTask(
		(delta) => {
			t += delta;
			if (!group) return;
			group.rotation.y += delta * 1.4;
			group.rotation.z = Math.sin(t * 1.1) * 0.12;
			group.position.y = Math.sin(t * 1.7) * 0.08;
		},
		{ running: () => running }
	);

	onDestroy(() => {
		materials.dispose();
		geometry.dispose();
		env.dispose();
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 4.2]} fov={36} />
<T.DirectionalLight position={[3, 4, 5]} intensity={1.6} />
<T.AmbientLight intensity={0.35} />
<T.Group bind:ref={group}>
	<T.Mesh {geometry} material={materials.list} rotation.x={Math.PI / 2} />
</T.Group>
