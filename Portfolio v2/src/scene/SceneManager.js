import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class SceneManager {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121920);

    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.01, 200
    );
    this.camera.position.set(8, 5, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.34;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const environmentScene = new RoomEnvironment(this.renderer);
    this.environmentTarget = pmremGenerator.fromScene(environmentScene, 0.06);
    this.scene.environment = this.environmentTarget.texture;
    environmentScene.dispose();
    pmremGenerator.dispose();

    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(px = 0, py = 0) {
    // Create temp target with parallax offset — never mutate cameraTarget
    this._lookAt = this._lookAt || new THREE.Vector3();
    this._lookAt.copy(this.cameraTarget);
    this._lookAt.x += px;
    this._lookAt.y += py;
    this.camera.lookAt(this._lookAt);
    this.renderer.render(this.scene, this.camera);
  }
}
