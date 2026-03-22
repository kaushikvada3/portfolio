import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Master scroll-driven GSAP timeline.
 *
 * Stage 1 (  0–25%): Macro orbit around assembled SoC
 * Stage 2 ( 25–50%): Exploded view — layers separate on Y, traces begin to appear
 * Stage 3 ( 50–75%): Camera dives into die surface, traces strengthen
 * Stage 4 (75–100%): Data routing reaches full intensity
 */

export function createScrollTimeline({ camera, cameraTarget, assembly, dataTraces, chipTour }) {
  const layers = assembly.getLayers();
  // layers: [0] BGA, [1] Substrate, [2] Die, [3] TIM, [4] IHS

  // ── Master timeline ──────────────────────────
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#scroll-container',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 2.8,
      onUpdate: (self) => {
        chipTour?.setProgress(self.progress);
      },
    },
  });

  // Total timeline duration = 100 (arbitrary, GSAP normalizes to scroll)

  /* ── STAGE 1: Macro Orbit (0 → 25) ──────────── */
  tl.fromTo(camera.position,
    { x: 8, y: 5, z: 0 },
    { x: 2, y: 4, z: 7, duration: 25, ease: 'none' },
    0
  );
  tl.fromTo(cameraTarget,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0.1, z: 0, duration: 25, ease: 'none' },
    0
  );
  // Subtle FOV shift
  tl.fromTo(camera, { fov: 45 }, { fov: 42, duration: 25, ease: 'none',
    onUpdate: () => camera.updateProjectionMatrix(),
  }, 0);

  /* ── STAGE 2: Exploded View (25 → 50) ───────── */
  // Camera rises for overhead perspective
  tl.to(camera.position,
    { x: 3, y: 9, z: 4, duration: 25, ease: 'power2.inOut' },
    25
  );

  // Explode layers — each moves away from center on Y
  const explodeOffsets = [-4.5, -2, 0, 2, 5]; // BGA, Sub, Die, TIM, IHS
  layers.forEach((layer, i) => {
    if (i < explodeOffsets.length) {
      tl.to(layer.position, {
        y: explodeOffsets[i],
        duration: i >= 3 ? 16 : 22,
        ease: i >= 3 ? 'power3.out' : 'power2.inOut',
      }, 25);
    }
  });

  // Slight rotation of whole group for drama
  tl.to(assembly.group.rotation, {
    x: 0.15,
    z: 0.08,
    duration: 25,
    ease: 'power2.inOut',
  }, 25);

  // Start showing traces as soon as the die package begins opening up.
  tl.to(dataTraces.material.uniforms.uOpacity, {
    value: 0.8,
    duration: 18,
    ease: 'power1.out',
  }, 27);

  /* ── STAGE 3: Micro-Zoom into Die (50 → 75) ─── */
  // Camera dives into the die while keeping enough context for a guided tour
  tl.to(camera.position, {
    x: -0.08, y: 0.52, z: 0.24,
    duration: 25,
    ease: 'power3.inOut',
  }, 50);

  tl.to(cameraTarget, {
    x: -0.08, y: 0.14, z: -0.08,
    duration: 25,
    ease: 'power3.inOut',
  }, 50);

  // Reset group rotation
  tl.to(assembly.group.rotation, {
    x: 0, z: 0,
    duration: 15,
    ease: 'power2.inOut',
  }, 50);

  // FOV push for cinematic dive
  tl.to(camera, {
    fov: 37,
    duration: 25,
    ease: 'power2.inOut',
    onUpdate: () => camera.updateProjectionMatrix(),
  }, 50);

  // Move non-die layers far away
  layers.forEach((layer, i) => {
    if (i !== 2) { // Everything except the die
      tl.to(layer.position, {
        y: i < 2 ? -20 : 20,
        duration: 20,
        ease: 'power2.in',
      }, 50);
    }
  });

  // Die layer itself returns to center
  tl.to(layers[2].position, {
    y: 0.1,
    duration: 20,
    ease: 'power2.inOut',
  }, 50);

  // Push traces closer to full visibility once the camera reaches the die.
  tl.to(dataTraces.material.uniforms.uOpacity, {
    value: 1.08,
    duration: 15,
    ease: 'power2.out',
  }, 58);

  /* ── STAGE 4: Live Data Routing (75 → 100) ──── */
  // Final intensity pass for the close-up routing view
  tl.to(dataTraces.material.uniforms.uOpacity, {
    value: 1.28,
    duration: 20,
    ease: 'power2.out',
  }, 75);

  // Slow scan across the die so each functional region can be read
  tl.to(camera.position, {
    x: 0.16, y: 0.74, z: 0.56,
    duration: 25,
    ease: 'none',
  }, 75);

  tl.to(cameraTarget, {
    x: 0.18, y: 0.14, z: 0.16,
    duration: 25,
    ease: 'none',
  }, 75);

  tl.to(camera, {
    fov: 40,
    duration: 25,
    ease: 'none',
    onUpdate: () => camera.updateProjectionMatrix(),
  }, 75);

  return tl;
}
