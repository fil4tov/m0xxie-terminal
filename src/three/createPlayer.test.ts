import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { createPlayer } from "./createPlayer";

const state = vi.hoisted(() => ({
  group: undefined as THREE.Group | undefined,
  frame: undefined as FrameRequestCallback | undefined,
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      setPixelRatio() {}
      setSize() {}
      render(scene: THREE.Scene, camera: THREE.Camera) {
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
      }
      dispose() {}
    },
    PMREMGenerator: class {
      fromScene() {
        return { texture: new actual.Texture(), dispose() {} };
      }
      dispose() {}
    },
  };
});

vi.mock("./buildFieldRecorder", () => ({
  buildFieldRecorder(group: THREE.Group) {
    state.group = group;
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.6));
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.15));
    button.position.z = 0.4;
    button.userData.action = "play";
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2));
    icon.position.z = 0.081;
    button.add(icon);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.02),
      new THREE.MeshStandardMaterial(),
    );
    group.add(body, button, led);
    return { reels: [], buttons: [button], led };
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup() {
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    state.frame = frame;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const container = document.createElement("div");
  const rect = { left: 0, top: 0, width: 600, height: 600 } as DOMRect;
  container.getBoundingClientRect = () => rect;
  const onAction = vi.fn();
  const player = createPlayer(container, onAction);
  const canvas = container.querySelector("canvas")!;
  canvas.getBoundingClientRect = () => rect;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  function pointer(type: string, x: number, y: number) {
    canvas.dispatchEvent(
      new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }),
    );
  }
  function settle() {
    for (let i = 0; i < 180; i++) state.frame!(i * 16);
  }
  function drag(dx: number, dy: number) {
    pointer("pointerdown", 300, 300);
    for (let i = 1; i <= 100; i++) {
      pointer("pointermove", 300 + (dx * i) / 100, 300 + (dy * i) / 100);
      state.frame!(i * 16);
    }
    pointer("pointerup", 300 + dx, 300 + dy);
    settle();
  }
  settle();
  return { player, onAction, pointer, drag, settle, group: state.group! };
}

it.each([
  [1, 0, 0.007],
  [0, 1, 0.005],
])(
  "rotates through the back and a full turn on axis (%s, %s)",
  (x, y, speed) => {
    const { player, group, drag, onAction } = setup();
    const original = group.quaternion.clone();
    drag((x * Math.PI) / speed, (y * Math.PI) / speed);
    expect(
      new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion).z,
    ).toBeLessThan(-0.8);
    drag((x * Math.PI) / speed, (y * Math.PI) / speed);
    expect(group.quaternion.angleTo(original)).toBeLessThan(0.04);
    expect(onAction).not.toHaveBeenCalled();
    player.dispose();
  },
);

it("keeps horizontal dragging responsive after tipping the player upright", () => {
  const { player, group, drag } = setup();
  drag(0, Math.PI / 2 / 0.005);
  const before = group.quaternion.clone();
  drag(Math.PI / 2 / 0.007, 0);
  const expected = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    .multiply(before);
  expect(group.quaternion.angleTo(expected)).toBeLessThan(0.04);
  player.dispose();
});

it("only activates visible buttons, including a click on their icons", () => {
  const { player, group, pointer, onAction } = setup();
  group.rotation.set(0, 0, 0);
  group.updateMatrixWorld(true);
  pointer("pointerdown", 300, 300);
  pointer("pointerup", 300, 300);
  expect(onAction).toHaveBeenCalledOnce();
  group.rotation.y = Math.PI;
  group.updateMatrixWorld(true);
  pointer("pointerdown", 300, 300);
  pointer("pointerup", 300, 300);
  expect(onAction).toHaveBeenCalledOnce();
  player.dispose();
});
