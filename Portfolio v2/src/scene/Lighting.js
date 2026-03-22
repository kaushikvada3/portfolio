import * as THREE from 'three';

/**
 * Clean studio lighting with a shadow catcher under the package.
 */
export function setupLighting(scene) {
  const ambient = new THREE.AmbientLight(0xf5efe6, 0.18);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xe6edf6, 0x1a2129, 0.58);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff3e1, 3.1);
  keyLight.position.set(5.5, 8.5, 6.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 32;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.00008;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xd5e2f0, 1.0);
  fillLight.position.set(-6, 4, -4);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xf8fbff, 0.85);
  rimLight.position.set(-1, 2.5, -8);
  scene.add(rimLight);

  const specLight = new THREE.PointLight(0xfff8f0, 1.45, 18);
  specLight.position.set(2.5, 3.5, 2.5);
  scene.add(specLight);

  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ opacity: 0.14 })
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = -0.72;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  return { ambient, hemi, keyLight, fillLight, rimLight, specLight, shadowCatcher };
}
