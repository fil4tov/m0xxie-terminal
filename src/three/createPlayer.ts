import * as THREE from "three";
import { buildFieldRecorder } from "./buildFieldRecorder";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { TransportAction } from "../hooks/useAudioPlayer";
export interface PlayerScene {
  setPlaying(value: boolean): void;
  dispose(): void;
}

export function createPlayer(
  container: HTMLDivElement,
  onAction: (action: TransportAction) => void,
): PlayerScene {
  const events = new AbortController();
  const timers = new Set<number>();
  let disposed = false;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.9, 7.6);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.append(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer),
    env = new RoomEnvironment();
  const environment = pmrem.fromScene(env, 0.04);
  scene.environment = environment.texture;
  env.dispose();
  pmrem.dispose();
  scene.environmentIntensity = 0.8;
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const key = new THREE.DirectionalLight(0xffeed5, 2.2);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8baeff, 0.9);
  fill.position.set(5, 0, 3);
  scene.add(fill);
  const group = new THREE.Group();
  scene.add(group);
  const { reels, buttons, led } = buildFieldRecorder(group);
  group.rotation.set(0.13, -0.42, -0.055);
  const targetRotation = group.quaternion.clone(),
    dragRotation = new THREE.Quaternion(),
    dragAxis = new THREE.Vector3();
  scene.environmentIntensity = 1.05;
  let playing = false,
    visible = true,
    dragging = false,
    startX = 0,
    startY = 0,
    moved = false,
    lastTime = 0,
    raf = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.position.z = Math.max(6.8, 7.3 / camera.aspect);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  function hit(e: PointerEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    let object: THREE.Object3D | undefined = raycaster.intersectObject(
      group,
      true,
    )[0]?.object;
    while (object && object !== group) {
      if (buttons.includes(object as THREE.Mesh)) return object;
      object = object.parent ?? undefined;
    }
    return undefined;
  }
  renderer.domElement.addEventListener(
    "pointerdown",
    (e) => {
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    },
    { signal: events.signal },
  );
  renderer.domElement.addEventListener(
    "pointermove",
    (e) => {
      if (dragging) {
        const dx = e.clientX - startX,
          dy = e.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) {
          // Apply each drag around fixed axes so turning stays responsive
          // even when the recorder is upside down or viewed from behind.
          dragAxis.set(dy * 0.005, dx * 0.007, 0);
          const angle = dragAxis.length();
          if (angle > 0) {
            dragRotation.setFromAxisAngle(dragAxis.normalize(), angle);
            targetRotation.premultiply(dragRotation).normalize();
          }
          startX = e.clientX;
          startY = e.clientY;
        }
      } else renderer.domElement.style.cursor = hit(e) ? "pointer" : "grab";
    },
    { signal: events.signal },
  );
  renderer.domElement.addEventListener(
    "pointerup",
    (e) => {
      if (!moved) {
        const button = hit(e);
        if (button) {
          const axis = (button.userData.pressAxis ?? "y") as "y" | "z";
          const rest = button.userData.restPosition ?? button.position[axis];
          button.userData.restPosition = rest;
          button.position[axis] = rest - 0.055;
          const timer = window.setTimeout(() => {
            button.position[axis] = rest;
            timers.delete(timer);
          }, 140);
          timers.add(timer);
          onAction(button.userData.action as TransportAction);
        }
      }
      dragging = false;
    },
    { signal: events.signal },
  );
  renderer.domElement.addEventListener(
    "pointercancel",
    () => (dragging = false),
    { signal: events.signal },
  );
  function draw(t: number) {
    raf = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    group.quaternion.slerp(targetRotation, 0.12);
    if (!reduced) {
      if (playing) reels.forEach((r) => (r.rotation.z -= dt * 1.7));
    }
    led.material.emissiveIntensity = playing ? 1.4 : 0.12;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(draw);
  }
  function start() {
    if (!raf && !disposed) {
      lastTime = performance.now();
      raf = requestAnimationFrame(draw);
    }
  }
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) start();
    },
    { signal: events.signal },
  );
  start();
  return {
    setPlaying(value: boolean) {
      playing = value;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visible = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      events.abort();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material])
          materials.add(material);
      });
      materials.forEach((material) => {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      environment.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
