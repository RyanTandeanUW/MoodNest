import { useRef, useEffect, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * ApartmentModel - Interactive 3D apartment with mood-responsive lighting
 *
 * This component loads a 3D apartment model and makes it interactive:
 * - Automatically detects lamps in the model by name
 * - Adds glowing point lights to each lamp
 * - Changes lamp colors based on the current mood (happy, sad, angry, neutral)
 * - Scales and centers the model to fit perfectly in the viewport
 * - Enables shadows for realistic lighting
 */

// Keywords used to identify lamp objects in the 3D model
// If a mesh name contains any of these words, we treat it as a lamp
const LAMP_KEYWORDS = ["lamp", "light", "bulb", "fixture", "pendant", "sconce"];

// Set to true to see detailed console logs about mesh detection
const DEBUG_MODE = false;

// Color and brightness for each mood
// These values are tuned to create the right atmosphere for each emotion
const MOOD_PRESETS = {
  happy: { color: 0xdfdb1c, intensity: 1.5 }, // Bright yellow
  sad: { color: 0x3805f0, intensity: 0.4 }, // Dim blue
  angry: { color: 0xff0055, intensity: 2.5 }, // Intense red
  neutral: { color: 0xffffcc, intensity: 0.6 }, // Warm white
};

export default function ApartmentModel({ mood = "neutral", ...props }) {
  // Reference to the group that holds our 3D model
  const group = useRef();

  // Keep track of all the lamp lights we create (for mood changes)
  const [lampLights, setLampLights] = useState([]);

  // Keep track of all the lamp meshes (for color updates)
  const [lampMeshes, setLampMeshes] = useState([]);

  // Load the 3D apartment model from the public folder
  const { scene } = useGLTF("/apartment2.glb");

  /**
   * Initial setup - runs once when the model is loaded
   *
   * This effect:
   * 1. Clones the model to avoid modifying the original
   * 2. Finds all lamps and adds glowing lights to them
   * 3. Enables shadows on all meshes
   * 4. Scales and centers the model to fit the viewport
   */
  useEffect(() => {
    if (!scene || !group.current) return;

    // Clone the model so we don't mess with the original
    // This allows the model to be used in multiple places if needed
    const clonedScene = scene.clone(true);

    // Debug: List all meshes (only if DEBUG_MODE is true)
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
     * Walk through every object in the model
     * For each mesh we find:
     * - Enable shadows (makes lighting look realistic)
     * - Check if it's a lamp (by name)
     * - If it's a lamp, make it glow and add a point light
     */
    let lampCount = 0;
    const lights = []; // Will store all lamp lights for later mood changes
    const meshes = []; // Will store all lamp meshes for color updates

    clonedScene.traverse((child) => {
      // Only process mesh objects (3D geometry)
      if (child.isMesh) {
        // Enable this mesh to cast and receive shadows
        child.castShadow = true;
        child.receiveShadow = true;

        // Optimize textures if they exist (makes rendering faster)
        if (child.material?.map) {
          child.material.map.anisotropy = 16;
          child.material.map.generateMipmaps = true;
        }

        // Check if this mesh is a lamp by looking at its name
        const meshName = child.name.toLowerCase();
        const isLamp = LAMP_KEYWORDS.some((keyword) =>
          meshName.includes(keyword),
        );

        if (isLamp) {
          lampCount++;

          // Replace the lamp's material to make it glow
          child.material = new THREE.MeshStandardMaterial({
            color: 0xffffcc, // Base color (warm white)
            emissive: 0xffffaa, // Glow color
            emissiveIntensity: 0.5, // How much it glows
            metalness: 0.1, // Slightly metallic
            roughness: 0.2, // Fairly smooth
          });

          // Remember this mesh so we can change its color later
          meshes.push(child);

          // Create a point light at the lamp's position
          // This makes the lamp actually illuminate the surrounding area
          const pointLight = new THREE.PointLight(0xffffcc, 0.6, 10);
          pointLight.position.copy(child.position);
          pointLight.castShadow = true;

          // Shadow quality settings
          // Shadow quality settings
          pointLight.shadow.mapSize.width = 1024;
          pointLight.shadow.mapSize.height = 1024;
          pointLight.shadow.bias = -0.005;
          pointLight.shadow.normalBias = 0.05;

          // Add the light to the scene and remember it
          child.parent.add(pointLight);
          lights.push(pointLight);

          if (DEBUG_MODE) console.log(`💡 Lamp "${child.name}" on`);
        }
      }
    });

    // Save lamp references so we can update them when mood changes
    setLampLights(lights);
    setLampMeshes(meshes);

    if (DEBUG_MODE) console.log(`💡 ${lampCount} lamps turned on`);

    /**
     * Scale and center the model to fit in the viewport
     *
     * We calculate a bounding box around the entire model to find:
     * - How big it is (width, height, depth)
     * - Where its center point is
     *
     * Then we scale it down to fit nicely and center it at the origin
     */
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    // Find the largest dimension to scale by
    const maxDim = Math.max(size.x, size.y, size.z);

    // Scale factor - tuned to fit nicely in the viewport
    // 3.7 is a magic number that works well for this apartment
    const scale = 3.7 / maxDim;

    // Apply the scale uniformly in all directions
    group.current.scale.setScalar(scale);

    // Reposition so the model's center is at the viewport's center
    // We multiply by scale because scaling affects position
    group.current.position.set(
      -center.x * scale,
      -center.y * scale,
      -center.z * scale,
    );

    // Add the processed model to our group
    group.current.add(clonedScene);
  }, [scene]);

  /**
   * Update lamp colors when mood changes
   *
   * This runs whenever the mood prop changes (from voice detection).
   * It updates both the point lights and the mesh materials to match
   * the new mood's color and intensity.
   */
  useEffect(() => {
    // Wait until we have lamps to update
    if (lampLights.length === 0 || lampMeshes.length === 0) return;

    // Get the color and intensity for this mood
    const preset = MOOD_PRESETS[mood] || MOOD_PRESETS.neutral;
    console.log(`💡 Changing lights to ${mood} mood:`, preset);

    // Update all the point lights
    lampLights.forEach((light) => {
      light.color.setHex(preset.color); // Change light color
      light.intensity = preset.intensity; // Change brightness
    });

    // Update all the lamp meshes to glow the right color
    lampMeshes.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.color.setHex(preset.color); // Base color
        mesh.material.emissive.setHex(preset.color); // Glow color
        mesh.material.emissiveIntensity = preset.intensity * 0.3; // Glow intensity
      }
    });
  }, [mood, lampLights, lampMeshes]);

  // Render the model group
  return <group ref={group} {...props} />;
}

// Preload the model for faster initial load
useGLTF.preload("/apartment2.glb");
