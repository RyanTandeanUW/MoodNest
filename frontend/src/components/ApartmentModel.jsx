import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * ApartmentModel
 *
 * Loads the apartment GLB, computes its bounding box,
 * recenters it, and scales it so it fits perfectly inside
 * the preview container. This ensures the model always
 * appears centered and properly sized regardless of its
 * original coordinates inside Blender.
 */
export default function ApartmentModel(props) {
  const group = useRef();

  // Load the GLB scene
  const { scene } = useGLTF("/apartment.glb");

  useEffect(() => {
    if (!scene || !group.current) return;

    /**
     * IMPORTANT:
     * We clone the scene to avoid mutating the original GLTF.
     * This prevents issues if the model is reused elsewhere.
     */
    const clonedScene = scene.clone(true);

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

  return <group ref={group} {...props} />;
}
