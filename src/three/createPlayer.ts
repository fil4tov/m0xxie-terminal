import * as THREE from "three";
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
  group.rotation.set(-0.15, -0.3, -0.08);
  const mat = (
    color: THREE.ColorRepresentation,
    metalness = 0.1,
    roughness = 0.5,
  ) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const bodyMat = mat("#29372f", 0.5, 0.38),
    edgeMat = mat("#101812", 0.1, 0.62),
    doorMat = mat("#1c251f", 0.45, 0.3),
    metal = mat("#aab0a8", 0.85, 0.27),
    black = mat("#101410", 0.1, 0.64),
    tape = mat("#c2b89c", 0.02, 0.82),
    spoolMat = mat("#36291e", 0.05, 0.85),
    accent = mat("#cc5931", 0.28, 0.4),
    grillMat = mat("#0a100c", 0.1, 0.6);
  function box(
    w: number,
    h: number,
    d: number,
    r: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = group,
  ) {
    const s = new THREE.Shape(),
      a = -w / 2,
      b = -h / 2;
    s.moveTo(a + r, b);
    s.lineTo(a + w - r, b);
    s.quadraticCurveTo(a + w, b, a + w, b + r);
    s.lineTo(a + w, b + h - r);
    s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    s.lineTo(a + r, b + h);
    s.quadraticCurveTo(a, b + h, a, b + h - r);
    s.lineTo(a, b + r);
    s.quadraticCurveTo(a, b, a + r, b);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: d,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 8,
    });
    geo.translate(0, 0, -d / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    radius: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent: THREE.Object3D = group,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 48),
      material,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function textPanel(
    text: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color = "#d6d8c7",
    font = "bold 44px Arial",
    bg: string | null = null,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.max(64, Math.round((1024 * h) / w));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(text, 22, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  box(3.45, 2.28, 0.6, 0.15, 0, 0, 0, bodyMat);
  box(3.49, 2.24, 0.13, 0.13, 0, 0, -0.19, edgeMat);
  box(3.27, 2.11, 0.09, 0.12, 0, 0, 0.34, doorMat);
  // Inset cassette bay, tape shell, magnetic reels and protective window.
  box(2.93, 1.2, 0.07, 0.1, 0, 0.14, 0.405, black);
  box(2.7, 0.96, 0.035, 0.07, 0, 0.15, 0.455, tape);
  box(2.4, 0.65, 0.025, 0.14, 0, 0.09, 0.482, black);
  const reels: THREE.Group[] = [];
  for (const x of [-0.73, 0.73]) {
    cylinder(0.37, 0.018, x, 0.09, 0.51, spoolMat);
    const reel = new THREE.Group();
    reel.position.set(x, 0.09, 0.535);
    group.add(reel);
    cylinder(0.19, 0.035, 0, 0, 0, metal, reel);
    cylinder(0.077, 0.05, 0, 0, 0.025, black, reel);
    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.095, 0.025),
        black,
      );
      const angle = (i * Math.PI) / 3;
      spoke.position.set(
        Math.sin(angle) * 0.132,
        Math.cos(angle) * 0.132,
        0.025,
      );
      spoke.rotation.z = -angle;
      reel.add(spoke);
    }
    reels.push(reel);
  }
  box(
    0.49,
    0.17,
    0.02,
    0.01,
    0,
    0.07,
    0.52,
    new THREE.MeshPhysicalMaterial({
      color: "#747d6d",
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8,
    }),
  );
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#b0c7b1",
    metalness: 0.08,
    roughness: 0.18,
    transparent: true,
    opacity: 0.12,
    clearcoat: 1,
    depthWrite: false,
  });
  box(2.92, 1.18, 0.014, 0.08, 0, 0.14, 0.6, glass);
  textPanel(
    "M0XXIE",
    1.35,
    0.19,
    -0.81,
    0.85,
    0.415,
    "#e2e7d5",
    "bold 145px Arial",
  );
  textPanel("STEREO", 0.53, 0.1, 1.13, 0.86, 0.415, "#d0d7c8", "115px Arial");
  textPanel(
    "PERSONAL TAPES     /     SIDE A",
    2.35,
    0.12,
    0,
    0.53,
    0.5,
    "#2a3025",
    "bold 42px monospace",
  );
  textPanel(
    "MX–90",
    1.08,
    0.22,
    -0.91,
    -0.76,
    0.416,
    "#e2e7d5",
    "bold 160px Arial",
  );
  textPanel(
    "AUTO REVERSE",
    1.1,
    0.11,
    -0.9,
    -0.95,
    0.416,
    "#c4d1b9",
    "75px Arial",
  );
  textPanel(
    "HIGH POSITION / TYPE II",
    1.24,
    0.09,
    -0.83,
    -0.52,
    0.42,
    "#c4d1b9",
    "49px Arial",
  );
  // Speaker openings are shallow cylinders recessed into the front cover.
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 14; col++) {
      const xx = 0.3 + col * 0.073,
        yy = -0.52 - row * 0.073;
      if (col > 11 && row === 0) continue;
      cylinder(0.018, 0.011, xx, yy, 0.413, grillMat);
    }
  for (const x of [-1.5, 1.5])
    for (const y of [-0.93, 0.94]) {
      cylinder(0.042, 0.024, x, y, 0.41, metal);
      box(0.047, 0.006, 0.009, 0.001, x, y, 0.426, black);
    }
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.031, 16, 12),
    new THREE.MeshStandardMaterial({
      color: "#80a877",
      emissive: "#80ff99",
      emissiveIntensity: 0.2,
    }),
  );
  led.position.set(1.3, 0.63, 0.43);
  group.add(led);
  // Physical transport keys, with matching raycast actions.
  const buttons: THREE.Mesh[] = [];
  const specs: [TransportAction, string][] = [
    ["previous", "◀◀"],
    ["play", "▶"],
    ["stop", "■"],
    ["next", "▶▶"],
  ];
  specs.forEach(([action, label], i) => {
    const x = -0.94 + i * 0.61;
    const mesh = box(
      0.49,
      0.19,
      0.45,
      0.035,
      x,
      1.24,
      -0.015,
      action === "play" ? accent : metal,
    );
    mesh.userData.action = action;
    buttons.push(mesh);
    const tex = textPanel(
      label,
      0.28,
      0.08,
      x,
      1.245,
      0.238,
      "#17201a",
      "bold 170px Arial",
    );
    tex.userData.buttonLabel = true;
  });
  // Ridged volume wheel and headphone jack.
  const wheel = cylinder(0.2, 0.11, 1.77, 0.6, -0.02, black);
  wheel.rotation.set(0, 0, Math.PI / 2);
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 10;
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.022, 0.035),
      metal,
    );
    ridge.position.set(
      1.78,
      0.6 + Math.cos(a) * 0.197,
      Math.sin(a) * 0.197 - 0.02,
    );
    ridge.rotation.x = -a;
    group.add(ridge);
  }
  const jack = cylinder(0.085, 0.065, -1.78, 0.65, -0.02, metal);
  jack.rotation.set(0, 0, Math.PI / 2);
  const jackHole = cylinder(0.05, 0.075, -1.81, 0.65, -0.02, black);
  jackHole.rotation.set(0, 0, Math.PI / 2);
  // Accent strip on the original Phosphor deck.
  box(0.075, 1.92, 0.018, 0.015, -1.39, -0.02, 0.407, accent);
  let playing = false,
    visible = true,
    dragging = false,
    startX = 0,
    startY = 0,
    moved = false,
    targetX = -0.15,
    targetY = -0.3,
    lastTime = 0,
    raf = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function resize() {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.position.z = camera.aspect < 1.1 ? 8.2 : 6.5;
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
    return raycaster.intersectObjects(buttons)[0]?.object;
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
          targetY = Math.max(-1.1, Math.min(1.1, targetY + dx * 0.007));
          targetX = Math.max(-0.65, Math.min(0.6, targetX + dy * 0.005));
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
          button.position.y = 1.18;
          const timer = window.setTimeout(() => {
            button.position.y = 1.24;
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
    group.rotation.x += (targetX - group.rotation.x) * 0.12;
    group.rotation.y += (targetY - group.rotation.y) * 0.12;
    if (!reduced) {
      group.position.y = Math.sin(t * 0.0007) * 0.025;
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
