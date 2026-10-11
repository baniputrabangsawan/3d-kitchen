import * as THREE from 'three';

/**
 * Pencahayaan lembut: hemisphere + directional dengan bayangan + isi hangat.
 * Kualitas mengatur intensitas bayangan & jumlah lampu via UI.
 */
export function createLights() {
  const g = new THREE.Group();

  const hemi = new THREE.HemisphereLight(0xfff6ec, 0x8a8f98, 1.0);
  g.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2e2, 1.6);
  sun.position.set(3.2, 4.4, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -4.5;
  sun.shadow.camera.right = 4.5;
  sun.shadow.camera.top = 4.5;
  sun.shadow.camera.bottom = -4.5;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 14;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  g.add(sun);

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45);
  fill.position.set(-3.5, 2.6, 2.5);
  g.add(fill);

  const warm = new THREE.PointLight(0xffd9a8, 4, 7, 1.9);
  warm.position.set(0.2, 2.0, 0.4);
  g.add(warm);

  return { group: g, sun, hemi, fill, warm };
}

/** Terapkan level kualitas ke lampu & bayangan. */
export function applyLightQuality(lights, renderer, level) {
  const { sun } = lights;
  if (level === 'low') {
    sun.castShadow = false;
    renderer.shadowMap.enabled = false;
  } else if (level === 'medium') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  } else {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  renderer.shadowMap.needsUpdate = true;
}
