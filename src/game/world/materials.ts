import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** Degradado de 4 tonos para el aspecto "dibujo animado" (cel-shading). */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([120, 180, 228, 255]);
    gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
    gradient.userData.shared = true;
  }
  return gradient;
}

export function toon(color: THREE.ColorRepresentation, params: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...params });
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    const list = Array.isArray(mat) ? mat : [mat];
    for (const m of list) {
      if (m.userData.shared) continue;
      const mm = m as THREE.MeshBasicMaterial;
      if (mm.map && !mm.map.userData.shared) mm.map.dispose();
      m.dispose();
    }
    const inst = obj as THREE.InstancedMesh;
    if (inst.isInstancedMesh) inst.dispose();
  });
}
