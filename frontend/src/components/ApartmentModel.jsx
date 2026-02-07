import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function ApartmentModel(props) {
  const group = useRef();
  const { scene } = useGLTF("/apartment.glb");

  useEffect(() => {
    if (!scene) return;

    // Clone the scene to avoid mutating the original
    const clonedScene = scene.clone();

    // Compute bounding box of the model
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    // Calculate scale to fit model in a 3.7 unit space (larger for preview)
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3.7 / maxDim;

    // Center and scale the group
    if (group.current) {
      group.current.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale,
      );
      group.current.scale.setScalar(scale);
    }
  }, [scene]);

  return (
    <group ref={group} {...props}>
      <primitive object={scene} />
    </group>
  );
}
