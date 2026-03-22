import './style.css';
import { SceneManager }        from './scene/SceneManager';
import { SoCAssembly }         from './scene/SoCAssembly';
import { DataTraces }          from './scene/DataTraces';
import { ChipTour }            from './scene/ChipTour';
import { setupLighting }       from './scene/Lighting';
import { setupPortfolioMotion } from './portfolioMotion';
import { createScrollTimeline } from './scroll/ScrollTimeline';

/* ── Initialise Three.js ───────────────────────── */
const canvas       = document.getElementById('webgl-canvas');
const sceneManager = new SceneManager(canvas);
const { scene, camera, cameraTarget, renderer } = sceneManager;

/* ── Lighting ──────────────────────────────────── */
setupLighting(scene);

/* ── SoC Assembly ──────────────────────────────── */
const assembly = new SoCAssembly(scene);

/* ── Data Traces (signals along model traces) ──── */
const dataTraces = new DataTraces(scene, assembly);

/* ── Guided Chip Tour ──────────────────────────── */
const chipTour = new ChipTour(assembly);

/* ── Scroll-driven 4-stage timeline ────────────── */
createScrollTimeline({ camera, cameraTarget, assembly, dataTraces, chipTour });
setupPortfolioMotion();

/* ── Mouse parallax (subtle, non-destructive) ──── */
const mouseTarget = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
  mouseTarget.x = (e.clientX / window.innerWidth  - 0.5) * 0.12;
  mouseTarget.y = (e.clientY / window.innerHeight - 0.5) * 0.12;
});

/* ── Render loop ───────────────────────────────── */
let clock = 0;
const parallax = { x: 0, y: 0 };
function animate() {
  requestAnimationFrame(animate);
  clock += 0.016;

  // Update data trace shader time
  dataTraces.update(clock);

  // Smooth-lerp a separate parallax offset (never mutate cameraTarget)
  parallax.x += (mouseTarget.x - parallax.x) * 0.03;
  parallax.y += (-mouseTarget.y - parallax.y) * 0.03;

  // Pass the offset to the renderer which adds it at lookAt time
  sceneManager.render(parallax.x, parallax.y);
  chipTour.update(camera);
}
animate();
