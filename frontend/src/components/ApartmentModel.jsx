import { useRef, useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Lamp detection keywords (cached outside component)
const LAMP_KEYWORDS = ["lamp", "light", "bulb", "fixture", "pendant", "sconce"];

// Enable debug mode to see detailed mesh info
const DEBUG_MODE = false;

// Mood presets matching backend VIBE_PRESETS
const MOOD_PRESETS = {
  happy: { color: 0xdfdb1c, intensity: 1.5 }, // Yellow
  sad: { color: 0x3805f0, intensity: 0.4 }, // Blue
  angry: { color: 0xff0055, intensity: 2.5 }, // Red
  neutral: { color: 0xffffcc, intensity: 0.6 }, // Warm white
};

/**
 * ApartmentModel
 *
 * Loads the apartment GLB, computes its bounding box,
 * recenters it, and scales it so it fits perfectly inside
 * the preview container. Dynamically changes lighting based on mood.
 */
export default function ApartmentModel({ mood = "neutral", ...props }) {
  const group = useRef();
  const [lampLights, setLampLights] = useState([]);
  const [lampMeshes, setLampMeshes] = useState([]);

  // Load the GLB scene
  const { scene } = useGLTF("/apartment2.glb");

  useEffect(() => {
    if (!scene || !group.current) return;

    /**
     * IMPORTANT:
     * We clone the scene to avoid mutating the original GLTF.
     * This prevents issues if the model is reused elsewhere.
     */
    const clonedScene = scene.clone(true);

    // Debug logging (only if enabled)
    if (DEBUG_MODE) {
      let meshCount = 0;
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          console.log(`MESH #${meshCount}: "${child.name}"`);
        }
      });
      console.log(`Total meshes: ${meshCount}`);
    }

    /**
     * Enable shadows and setup lamps (single traversal for performance)
     */
    let lampCount = 0;
    const lights = [];
    const meshes = [];

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;

        // Optimize textures if they exist
        if (child.material?.map) {
          child.material.map.anisotropy = 16;
          child.material.map.generateMipmaps = true;
        }

        // Check if this mesh is a lamp
        const meshName = child.name.toLowerCase();
        const isLamp = LAMP_KEYWORDS.some((keyword) =>
          meshName.includes(keyword),
        );

        if (isLamp) {
          lampCount++;

          // Make the lamp glow
          child.material = new THREE.MeshStandardMaterial({
            color: 0xffffcc,
            emissive: 0xffffaa,
            emissiveIntensity: 0.5,
            metalness: 0.1,
            roughness: 0.2,
          });

          // Store mesh reference for later updates
          meshes.push(child);

          // Add optimized point light at lamp position
          const pointLight = new THREE.PointLight(0xffffcc, 0.6, 10);
          pointLight.position.copy(child.position);
          pointLight.castShadow = true;
          pointLight.shadow.mapSize.width = 1024;
          pointLight.shadow.mapSize.height = 1024;
          pointLight.shadow.bias = -0.005;
          pointLight.shadow.normalBias = 0.05;

          child.parent.add(pointLight);
          lights.push(pointLight); // Store for later updates

          if (DEBUG_MODE) console.log(`💡 Lamp "${child.name}" on`);
        }
      }
    });

    // Store lamp references in state
    setLampLights(lights);
    setLampMeshes(meshes);

    if (DEBUG_MODE) console.log(`💡 ${lampCount} lamps turned on`);

    /**
     * Compute the bounding box of the model.
     * This gives us:
     * - size (width, height, depth)
     * - center (pivot point)
     */
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    /**
     * Determine a scale factor so the model fits inside
     * a ~3.7 unit bounding cube. This value is tuned for
     * your preview window — large enough to fill the frame
     * but small enough to avoid clipping.
     */
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3.7 / maxDim;

    /**
     * Apply the scale and reposition the model so that
     * its center aligns with the group's origin.
     *
     * We multiply the center by the scale so the model
     * stays centered after scaling.
     */
    group.current.scale.setScalar(scale);
    group.current.position.set(
      -center.x * scale,
      -center.y * scale,
      -center.z * scale,
    );

    /**
     * Add the cloned scene to the group.
     * We do this manually so we can manipulate the group
     * without affecting the original GLTF scene.
     */
    group.current.add(clonedScene);
  }, [scene]);

  // Update lighting when mood changes
  useEffect(() => {
    if (lampLights.length === 0 || lampMeshes.length === 0) return;

    const preset = MOOD_PRESETS[mood] || MOOD_PRESETS.neutral;
    console.log(`💡 Changing lights to ${mood} mood:`, preset);

    // Update all lamp lights
    lampLights.forEach((light) => {
      light.color.setHex(preset.color);
      light.intensity = preset.intensity;
    });

    // Update all lamp mesh emissions
    lampMeshes.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.color.setHex(preset.color);
        mesh.material.emissive.setHex(preset.color);
        mesh.material.emissiveIntensity = preset.intensity * 0.3;
      }
    });
  }, [mood, lampLights, lampMeshes]);

  return <group ref={group} {...props} />;
}

// Preload the model for better performance
useGLTF.preload("/apartment2.glb");
