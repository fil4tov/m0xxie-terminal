import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createAgedPaint } from "./createAgedPaint";
import { createCassetteLabel, createTapeWinding } from "./createCassetteLabel";
import type { TransportAction } from "../hooks/useAudioPlayer";

export function buildFieldRecorder(group: THREE.Group) {
  const reels: THREE.Group[] = [];
  const buttons: THREE.Mesh[] = [];
  const material = (color: string, metalness = 0, roughness = 0.5) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const ink = material("#191c15", 0.15, 0.5);
  const rubber = material("#2c2b22", 0, 0.88);
  const silver = material("#b3b9b8", 0.8, 0.36);
  const darkMetal = material("#514d3d", 0.35, 0.56);
  const paper = material("#e8e3ce", 0, 0.87);
  const red = material("#be342f", 0.08, 0.4);
  const fieldPaint = createAgedPaint();

  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    radius = 0.04,
    parent: THREE.Object3D = group,
  ) {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, d / 2, w / 2, h / 2)),
      mat,
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function disc(
    r: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    parent: THREE.Object3D = group,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, depth, 40),
      mat,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function windowFrame(
    w: number,
    h: number,
    border: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
  ) {
    const outline = (
      path: THREE.Path,
      width: number,
      height: number,
      radius: number,
    ) => {
      const a = -width / 2,
        b = -height / 2;
      path.moveTo(a + radius, b);
      path.lineTo(-a - radius, b);
      path.quadraticCurveTo(-a, b, -a, b + radius);
      path.lineTo(-a, -b - radius);
      path.quadraticCurveTo(-a, -b, -a - radius, -b);
      path.lineTo(a + radius, -b);
      path.quadraticCurveTo(a, -b, a, -b - radius);
      path.lineTo(a, b + radius);
      path.quadraticCurveTo(a, b, a + radius, b);
    };
    const shape = new THREE.Shape();
    outline(shape, w, h, 0.045);
    const opening = new THREE.Path();
    outline(opening, w - border * 2, h - border * 2, 0.025);
    shape.holes.push(opening);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 8,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  function ring(
    r: number,
    tube: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    parent: THREE.Object3D = group,
  ) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 48), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function label(
    text: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    color = "#242723",
    face = "Arial",
    weight = "bold",
    parent: THREE.Object3D = group,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.max(64, Math.round((1024 * h) / w));
    const ctx = canvas.getContext("2d")!;
    let fontSize = canvas.height * 0.76;
    ctx.font = `${weight} ${fontSize}px ${face}`;
    while (ctx.measureText(text).width > 980 && fontSize > 10) {
      fontSize -= 2;
      ctx.font = `${weight} ${fontSize}px ${face}`;
    }
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function screw(
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = group,
  ) {
    disc(0.043, 0.018, x, y, z, darkMetal, parent);
    disc(0.029, 0.02, x, y, z + 0.008, silver, parent);
    const slot = box(0.041, 0.007, 0.006, x, y, z + 0.021, ink, 0.002, parent);
    slot.rotation.z = Math.PI / 4;
  }
  function perforations(
    cx: number,
    cy: number,
    width: number,
    height: number,
    z: number,
    spacing = 0.085,
  ) {
    const nx = Math.floor(width / spacing),
      ny = Math.floor(height / spacing);
    const holes = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.008, 10),
      ink,
      nx * ny,
    );
    const dummy = new THREE.Object3D();
    dummy.rotation.x = Math.PI / 2;
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        dummy.position.set(
          cx + (x - (nx - 1) / 2) * spacing,
          cy + (y - (ny - 1) / 2) * spacing,
          z,
        );
        dummy.updateMatrix();
        holes.setMatrixAt(y * nx + x, dummy.matrix);
      }
    group.add(holes);
  }
  function key(
    action: TransportAction,
    glyph: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    mat: THREE.Material,
    glyphColor = "#252727",
  ) {
    box(w + 0.055, h + 0.055, 0.05, x, y, z - 0.07, ink);
    const button = box(w, h, 0.15, x, y, z, mat, 0.045);
    button.userData.action = action;
    button.userData.pressAxis = "z";
    buttons.push(button);
    const icon = label(glyph, w * 0.52, h * 0.44, 0, 0, 0.081, glyphColor);
    group.remove(icon);
    button.add(icon);
    return button;
  }
  function cable(points: number[][], color: string, radius = 0.018) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...(p as [number, number, number]))),
    );
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, radius, 8, false),
      material(color, 0, 0.75),
    );
    group.add(mesh);
  }
  function cassette(x: number, y: number, z: number, scale: number) {
    const deck = new THREE.Group();
    deck.position.set(x, y, z);
    deck.scale.setScalar(scale);
    group.add(deck);
    const shell = material("#0d100e", 0.04, 0.82);
    const hub = material("#141711", 0.12, 0.55);
    const teeth = material("#9c9a7e", 0.25, 0.6);
    const tape = material("#342b1c", 0.15, 0.64);
    const winding = createTapeWinding();
    box(2.62, 1.63, 0.16, 0, 0, 0, shell, 0.07, deck);
    box(2.42, 0.91, 0.02, 0, 0, 0.094, ink, 0.009, deck);

    for (const [i, rx] of [-0.64, 0.64].entries()) {
      const radius = i === 0 ? 0.47 : 0.37;
      disc(radius, 0.034, rx, 0, 0.126, tape, deck);
      const tapeFace = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 64),
        winding,
      );
      tapeFace.position.set(rx, 0, 0.147);
      deck.add(tapeFace);
      const reel = new THREE.Group();
      reel.position.set(rx, 0, 0.156);
      deck.add(reel);
      disc(0.204, 0.022, 0, 0, 0, hub, reel);
      ring(0.19, 0.009, 0, 0, 0.019, darkMetal, reel);
      disc(0.126, 0.024, 0, 0, 0.019, ink, reel);
      for (let j = 0; j < 6; j++) {
        const angle = (j * Math.PI) / 3;
        const tooth = box(
          0.043,
          0.037,
          0.018,
          Math.sin(angle) * 0.132,
          Math.cos(angle) * 0.132,
          0.032,
          teeth,
          0.003,
          reel,
        );
        tooth.rotation.z = -angle;
      }
      reels.push(reel);
    }
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.152),
      createCassetteLabel(),
    );
    sticker.position.set(0, 0.15, 0.207);
    deck.add(sticker);
    box(1.82, 0.26, 0.047, 0, -0.63, 0.107, shell, 0.023, deck);
    for (const rx of [-0.76, -0.46, 0.46, 0.76]) {
      disc(0.053, 0.012, rx, -0.66, 0.137, ink, deck);
      ring(0.054, 0.006, rx, -0.66, 0.145, darkMetal, deck);
    }
    for (const rx of [-1.18, 1.18]) {
      for (const ry of [-0.7, 0.7]) screw(rx, ry, 0.094, deck);
    }
    screw(0, -0.54, 0.135, deck);
    return deck;
  }

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 12),
    new THREE.MeshStandardMaterial({
      color: "#a5d879",
      emissive: "#a3ff75",
      emissiveIntensity: 0.12,
    }),
  );
  group.add(led);

  // Rear shell ends at z=0.28, exactly where the front cover begins.
  box(3.95, 2.53, 0.6, 0, 0, -0.02, fieldPaint, 0.15);
  // Rear details use outward-facing local coordinates, including the lettering.
  const rear = new THREE.Group();
  rear.position.z = -0.32;
  rear.rotation.y = Math.PI;
  group.add(rear);
  for (const x of [-1.73, 1.73])
    for (const y of [-1.04, 1.04]) screw(x, y, 0.006, rear);

  // A shallow seam and inset-colored lid suggest a removable battery cover.
  box(2.88, 0.88, 0.018, 0, -0.53, 0.003, darkMetal, 0.04, rear);
  box(2.83, 0.83, 0.02, 0, -0.53, 0.016, fieldPaint, 0.04, rear);
  for (let i = 0; i < 4; i++)
    box(
      0.33,
      0.016,
      0.012,
      0.94,
      -0.43 - i * 0.065,
      0.03,
      darkMetal,
      0.005,
      rear,
    );
  label(
    "OPEN  ↓",
    0.42,
    0.085,
    0,
    -0.75,
    0.03,
    "#514d3d",
    "monospace",
    "normal",
    rear,
  );

  box(1.95, 0.66, 0.018, -0.37, 0.49, 0.007, darkMetal, 0.025, rear);
  label(
    "M0XXIE  /  FR–01",
    1.63,
    0.13,
    -0.37,
    0.66,
    0.021,
    "#d9d0b0",
    "monospace",
    "bold",
    rear,
  );
  label(
    "PORTABLE FIELD RECORDER",
    1.63,
    0.08,
    -0.37,
    0.49,
    0.021,
    "#b7b09b",
    "monospace",
    "normal",
    rear,
  );
  label(
    "DC 3V  ·  2 × AA   /   S/N 0001",
    1.63,
    0.07,
    -0.37,
    0.33,
    0.021,
    "#b7b09b",
    "monospace",
    "normal",
    rear,
  );
  for (let i = 0; i < 4; i++)
    box(
      0.46,
      0.026,
      0.01,
      1.08,
      0.67 - i * 0.12,
      0.002,
      darkMetal,
      0.005,
      rear,
    );

  box(3.98, 2.25, 0.32, 0, -0.04, -0.03, rubber, 0.08);
  box(3.89, 2.46, 0.12, 0, 0, 0.34, fieldPaint, 0.05);
  box(1.13, 1.34, 0.025, -1.18, 0.42, 0.416, darkMetal, 0.05);
  perforations(-1.18, 0.42, 1.0, 1.21, 0.437, 0.077);
  box(2.41, 1.73, 0.07, 0.67, 0.24, 0.42, ink, 0.09);
  cassette(0.67, 0.24, 0.47, 0.86);
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#c6d1b1",
    roughness: 0.1,
    metalness: 0.05,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    clearcoat: 1,
  });
  // The window sits inside a continuous door frame, anchored to the bay.
  // Its retaining lip overlaps the glass edge and hides the tape's side walls.
  // Each frame is one mesh: no coplanar overlapping rails at the corners.
  windowFrame(2.46, 1.72, 0.1, 0.27, 0.67, 0.24, 0.555, darkMetal);
  windowFrame(2.4, 1.665, 0.05, 0.024, 0.67, 0.24, 0.702, rubber);
  box(2.34, 1.57, 0.022, 0.67, 0.24, 0.671, glass, 0.008);
  box(2.45, 0.1, 0.12, 0.65, 1.16, 0.43, darkMetal, 0.025);
  box(1.97, 0.027, 0.014, 0.65, 1.181, 0.5, ink, 0.006);
  box(0.59, 0.3, 0.028, -1.41, -0.51, 0.421, ink, 0.025);
  box(0.5, 0.21, 0.015, -1.41, -0.51, 0.441, paper, 0.01);
  for (let i = 0; i < 8; i++)
    box(
      0.014,
      0.07,
      0.009,
      -1.61 + i * 0.056,
      -0.5,
      0.455,
      i > 5 ? red : ink,
      0.001,
    );
  const needle = box(0.016, 0.18, 0.01, -1.41, -0.53, 0.47, red, 0.001);
  needle.rotation.z = -0.4;
  disc(0.11, 0.085, -0.9, -0.49, 0.45, ink);
  ring(0.11, 0.012, -0.9, -0.49, 0.5, silver);
  label("M0XXIE", 0.78, 0.13, -1.28, -0.82, 0.416);
  label(
    "FIELD RECORDER  /  FR–01",
    1.15,
    0.07,
    -1.22,
    -1.02,
    0.416,
    "#404843",
    "monospace",
  );
  [
    ["previous", "◀◀"],
    ["play", "▶"],
    ["stop", "■"],
    ["next", "▶▶"],
  ].forEach(([action, glyph], i) => {
    const x = -0.35 + i * 0.52;
    const button = key(
      action as TransportAction,
      glyph,
      x,
      -0.89,
      0.49,
      0.46,
      0.43,
      action === "play" ? fieldPaint : darkMetal,
      action === "play" ? "#292b22" : "#d9d0b0",
    );
    for (let j = 0; j < 4; j++)
      box(
        0.36,
        0.006,
        0.007,
        0,
        -0.14 + j * 0.022,
        0.08,
        rubber,
        0.001,
        button,
      );
  });
  led.position.set(1.78, -0.65, 0.43);
  label("REC", 0.22, 0.07, 1.74, -0.49, 0.423, "#992f24");
  for (const x of [-1.81, 1.81])
    for (const y of [-1.12, 1.11]) screw(x, y, 0.42);
  // Both ends of the wrist loop terminate inside side-mounted ferrules.
  for (const y of [0.55, 1.02]) {
    box(0.075, 0.21, 0.23, -1.973, y, -0.07, darkMetal, 0.025);
    const ferrule = disc(0.074, 0.12, -2.015, y, -0.07, rubber);
    ferrule.rotation.set(0, 0, Math.PI / 2);
  }
  cable(
    [
      [-2.02, 0.55, -0.07],
      [-2.28, 0.6, -0.08],
      [-2.51, 1.02, -0.1],
      [-2.42, 1.45, -0.1],
      [-2.15, 1.46, -0.08],
      [-2.11, 1.1, -0.07],
      [-2.02, 1.02, -0.07],
    ],
    "#282927",
    0.032,
  );
  return { reels, buttons, led };
}
