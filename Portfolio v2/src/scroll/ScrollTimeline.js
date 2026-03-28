import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let masterTl = null;

// Final hardcoded positions for the Hero section opening shot
export const heroConfig = {
  modelStartX: 1.9,
  modelStartZ: -3.4,
  modelRotX: 0.0584,
  modelRotY: 0.3084,
  modelRotZ: -0.7915,
  cameraStartX: 10.2,
  cameraStartY: 3.6,
  cameraStartZ: -0.9,
  targetStartX: 2.6,
};

// Final hardcoded positions for the Experience section
export const expConfig = {
  modelEndX: 5.55,
  modelEndZ: -0.85,
  modelRotX: 0.0484,
  modelRotY: -0.8715,
  modelRotZ: 0.0484,
  cameraEndX: 3,
  cameraEndY: 9,
  cameraEndZ: -11.55,
  targetEndX: 0.77,
  targetEndY: -1.8,
};

// Final hardcoded positions for the Projects section
export const projConfig = {
  modelEndX: -0.65,
  modelEndY: -2.65,
  modelEndZ: 0.65,
  modelRotX: -0.2116,
  modelRotY: -0.1915,
  modelRotZ: -0.3915,
  cameraEndX: -0.98,
  cameraEndY: 5.92,
  cameraEndZ: -7.69,
  targetEndX: 0.80,
  targetEndY: -1.07,
  targetEndZ: -0.03,
  fov: 15,
  layerOffsets: [-4.3, -3, 1.1, 6.1, 6.9],
};

/**
 * Master scroll-driven GSAP timeline.
 *
 * Stage 1 (  0–25%): Macro orbit around assembled SoC
 * Stage 2 ( 25–50%): Exploded view — layers separate on Y, traces begin to appear
 * Stage 3 ( 50–75%): Camera dives into die surface, traces strengthen
 * Stage 4 (75–100%): Data routing reaches full intensity
 */
export function createScrollTimeline({ camera, cameraTarget, assembly, dataTraces, chipTour, deviceFrame }) {
  const lateralScale =
      window.innerWidth >= 1200 ? 1 :
      window.innerWidth >= 768 ? 0.72 :
      0.42;

  const layers = assembly.getLayers();
  
  function buildTimeline() {
    // Clean up previous GSAP instances if rebuilding
    if (masterTl) {
      masterTl.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    }

    const lateralScale =
      window.innerWidth >= 1200 ? 1 :
      window.innerWidth >= 768 ? 0.72 :
      0.42;

    const modelShift = {
      about: heroConfig.modelStartX * lateralScale,  // chip on RIGHT
      // experience & projects positions come from expConfig/projConfig directly
    };

    const framing = {
      about: {
        startTargetX: heroConfig.targetStartX * lateralScale,
        endTargetX: -1.10 * lateralScale,
      },
      experience: {
        targetX: 0.72 * lateralScale,
        targetY: 0.12,
      },
      projects: {
        cameraX: 0.42 * lateralScale,
        targetX: 0.58 * lateralScale,
        targetY: 0.14,
      },
      contact: {
        cameraX: 0.0,
        targetX: 0.0,
        targetY: 0.18,
      },
    };

    // Apply init values based on user configuration
    assembly.group.position.x = modelShift.about;
    assembly.group.position.z = heroConfig.modelStartZ * lateralScale;
    assembly.group.rotation.x = heroConfig.modelRotX;
    assembly.group.rotation.y = heroConfig.modelRotY;
    assembly.group.rotation.z = heroConfig.modelRotZ;
    assembly.group.scale.set(1, 1, 1);
    if (deviceFrame) deviceFrame.hide();

    // ── Master timeline ──────────────────────────
    masterTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#scroll-container',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 3.2,
        onUpdate: (self) => {
          chipTour?.setProgress(self.progress);
        },
      },
    });

    // Total timeline duration = 100 (arbitrary, GSAP normalizes to scroll)

    /* ── STAGE 1: Transition smoothly from Hero to Experience (0 → 28) ── */
    // Animating the camera directly between user-tuned waypoints removes weird 180 flips
    masterTl.fromTo(camera.position,
      { x: heroConfig.cameraStartX, y: heroConfig.cameraStartY, z: heroConfig.cameraStartZ },
      { x: expConfig.cameraEndX, y: expConfig.cameraEndY, z: expConfig.cameraEndZ, duration: 28, ease: 'power4.inOut' },
      0
    );

    masterTl.fromTo(cameraTarget,
      { x: heroConfig.targetStartX * lateralScale, y: 0.02, z: 0 },
      { x: expConfig.targetEndX * lateralScale, y: expConfig.targetEndY, z: 0, duration: 28, ease: 'power4.inOut' },
      0
    );
    
    // Animate overarching model group layout so it anchors perfectly when text appears
    masterTl.to(assembly.group.position, { 
      x: expConfig.modelEndX * lateralScale, 
      z: expConfig.modelEndZ * lateralScale, 
      duration: 28, 
      ease: 'power4.inOut' 
    }, 0);
    
    masterTl.to(assembly.group.rotation, { 
      x: expConfig.modelRotX, 
      y: expConfig.modelRotY, 
      z: expConfig.modelRotZ, 
      duration: 28, 
      ease: 'power4.inOut' 
    }, 0);

    // Subtle FOV shift
    masterTl.fromTo(camera, { fov: 45 }, { fov: 42, duration: 28, ease: 'none',
      onUpdate: () => camera.updateProjectionMatrix(),
    }, 0);

    /* ── STAGE 2: Exploded View (25 → 50) ───────── */
    // The core layout is complete. Now just explode the chips gracefully.

    // Explode layers — each moves away from center on Y (values tightened up!)
    const explodeOffsets = [-2.8, -1.2, 0, 1.2, 3.0]; // BGA, Sub, Die, TIM, IHS
    layers.forEach((layer, i) => {
      if (i < explodeOffsets.length) {
        masterTl.to(layer.position, {
          y: explodeOffsets[i],
          duration: i >= 3 ? 16 : 22,
          ease: i >= 3 ? 'power4.out' : 'power4.inOut',
        }, 25);
      }
    });

    // Start showing traces as soon as the die package begins opening up.
    masterTl.to(dataTraces.material.uniforms.uOpacity, {
      value: 0.8,
      duration: 18,
      ease: 'power1.out',
    }, 27);

    /* ── STAGE 3: Micro-Zoom into Die (50 → 75) ─── */
    // Shift model for projects framing
    masterTl.to(assembly.group.position, {
      x: projConfig.modelEndX * lateralScale,
      y: projConfig.modelEndY,
      z: projConfig.modelEndZ * lateralScale,
      duration: 11,
      ease: 'power4.inOut',
    }, 48);

    masterTl.to(camera.position, {
      x: projConfig.cameraEndX, y: projConfig.cameraEndY, z: projConfig.cameraEndZ,
      duration: 11,
      ease: 'power4.inOut',
    }, 48);

    masterTl.to(cameraTarget, {
      x: projConfig.targetEndX, y: projConfig.targetEndY, z: projConfig.targetEndZ,
      duration: 11,
      ease: 'power4.inOut',
    }, 48);

    masterTl.to(assembly.group.rotation, {
      x: projConfig.modelRotX, y: projConfig.modelRotY, z: projConfig.modelRotZ,
      duration: 11,
      ease: 'power4.inOut',
    }, 48);

    // Tight telephoto FOV
    masterTl.to(camera, {
      fov: projConfig.fov,
      duration: 11,
      ease: 'power4.inOut',
      onUpdate: () => camera.updateProjectionMatrix(),
    }, 48);

    // Keep layers exploded at tuned offsets
    layers.forEach((layer, i) => {
      if (i < projConfig.layerOffsets.length) {
        masterTl.to(layer.position, {
          y: projConfig.layerOffsets[i],
          duration: 16,
          ease: 'power4.inOut',
        }, 48);
      }
    });

    // Push traces closer to full visibility once the camera reaches the die.
    masterTl.to(dataTraces.material.uniforms.uOpacity, {
      value: 1.08,
      duration: 15,
      ease: 'power2.out',
    }, 58);

    /* ── STAGE 4: Collapse + Device Encapsulation (75 → 100) ──── */
    const contactDeviceX = 1.65;
    const originalOffsets = [-0.3, -0.08, 0.1, 0.22, 0.45];

    // Collapse all layers back to their original procedural positions
    layers.forEach((layer, i) => {
      masterTl.to(layer.position, {
        y: originalOffsets[i] || 0,
        duration: 12,
        ease: 'power4.inOut',
      }, 73);
    });

    // Hover the chip directly above the phone's resting position
    masterTl.to(assembly.group.position, {
      x: contactDeviceX, y: 3.5, z: 0,
      duration: 12,
      ease: 'power4.inOut',
    }, 73);

    masterTl.to(assembly.group.rotation, {
      x: 0, y: 0, z: 0,
      duration: 12,
      ease: 'power4.inOut',
    }, 73);

    // Scale chip down so it fits inside the phone body
    masterTl.to(assembly.group.scale, {
      x: 0.22, y: 0.22, z: 0.22,
      duration: 14,
      ease: 'power4.inOut',
    }, 75);

    // Fade out data traces
    masterTl.to(dataTraces.material.uniforms.uOpacity, {
      value: 0,
      duration: 8,
      ease: 'power2.out',
    }, 75);

    // Camera sweeps to the user-tuned viewing angle
    masterTl.to(camera.position, {
      x: -0.5, y: 12.5, z: 6.6,
      duration: 18,
      ease: 'power4.inOut',
    }, 73);

    masterTl.to(cameraTarget, {
      x: 0.50, y: 0.30, z: 0,
      duration: 18,
      ease: 'power4.inOut',
    }, 73);

    masterTl.to(camera, {
      fov: 27,
      duration: 18,
      ease: 'power4.inOut',
      onUpdate: () => camera.updateProjectionMatrix(),
    }, 73);

    // ── 3-Phase Device Encapsulation ──
    if (deviceFrame) {

      /* Phase 1 (81-85): Phone chassis appears as transparent X-ray */
      masterTl.call(() => { deviceFrame.hide(); }, [], 80);
      masterTl.call(() => {
        deviceFrame.setXrayState();
        deviceFrame.show();
        
        // Position the glow in world space at the chip's landing coordinates
        deviceFrame.glowMesh.position.set(contactDeviceX, 0.15, 0);
        deviceFrame.glowMesh.rotation.x = -Math.PI / 2;
        deviceFrame.glowMesh.visible = true;
      }, [], 81);

      // User-tuned phone coordinates from the debug GUI
      masterTl.fromTo(deviceFrame.group.rotation,
        { x: 0, y: 0, z: -1.611 },
        { x: 0, y: 0, z: -1.611, duration: 0.01 },
        81
      );
      masterTl.fromTo(deviceFrame.group.position,
        { x: contactDeviceX, y: 0, z: 0 },
        { x: contactDeviceX, y: 0, z: 0, duration: 0.01 },
        81
      );
      masterTl.fromTo(deviceFrame.group.scale,
        { x: 1.0, y: 1.0, z: 1.0 },
        { x: 1.0, y: 1.0, z: 1.0, duration: 0.01 },
        81
      );

      // Fade in edge wireframe
      masterTl.fromTo(deviceFrame.edgesMat,
        { opacity: 0 },
        { opacity: 0.7, duration: 4, ease: 'power2.out' },
        85
      );

      // Subtle x-ray body opacity
      deviceFrame.materials.forEach((mat) => {
        masterTl.fromTo(mat,
          { opacity: 0 },
          { opacity: 0.06, duration: 4, ease: 'power2.out' },
          85
        );
      });

      /* Phase 2 (88-89.2): Chip snaps straight DOWN onto the phone */
      // Landing position matches the phone position exactly so the chip sits right on the surface
      masterTl.to(assembly.group.position, {
        x: contactDeviceX, y: 0.22, z: 0,
        duration: 1.2,
        ease: 'power4.in',
      }, 88);

      // M1 glow fires IMMEDIATELY on impact — no delay!
      masterTl.fromTo(deviceFrame.glowMat.uniforms.uIntensity,
        { value: 0 },
        { value: 1.2, duration: 0.5, ease: 'power2.out' },
        89.2
      );
      
      // Settle into sustained ambient glow
      masterTl.to(deviceFrame.glowMat.uniforms.uIntensity,
        { value: 0.7, duration: 4, ease: 'power2.inOut' },
        90.0
      );

      /* Phase 3 (90-96): Phone solidifies around the chip */
      deviceFrame.materials.forEach((mat, i) => {
        const solid = deviceFrame.solidState[i];
        masterTl.to(mat, {
          opacity: solid.opacity,
          metalness: solid.metalness,
          roughness: solid.roughness,
          duration: 6,
          ease: 'power2.inOut',
          onUpdate: () => {
            // Once fully opaque, move to the opaque render pass to fix z-fighting
            mat.transparent = mat.opacity < 0.99;
          },
        }, 90);
      });

      // Fade out edge wireframe as phone solidifies
      masterTl.to(deviceFrame.edgesMat, {
        opacity: 0,
        duration: 5,
        ease: 'power2.in',
      }, 90);

      // Subtle final rotation — both phone and chip move together
      masterTl.to(deviceFrame.group.rotation, {
        x: 0.158,
        y: 0.098,
        z: -1.611,
        duration: 14,
        ease: 'power2.inOut',
      }, 86);

      masterTl.to(assembly.group.rotation, {
        x: 0.158,
        y: 0.098,
        z: -0.051,
        duration: 14,
        ease: 'power2.inOut',
      }, 86);
    }

    setTimeout(() => { ScrollTrigger.refresh(); }, 50);
  }

  // Build the initial timeline
  buildTimeline();

  return masterTl;
}
