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

function setup(reduced = false) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
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
  function pointer(type: string, x: number, y: number, pointerType = "mouse") {
    const event = new MouseEvent(type, {
      clientX: x,
      clientY: y,
      bubbles: true,
    });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    canvas.dispatchEvent(event);
  }
  function advance(seconds: number, fps = 60) {
    const frames = Math.round(seconds * fps);
    for (let i = 0; i < frames; i++) state.frame!((time += 1000 / fps));
  }
  function settle() {
    advance(3);
  }
  function drag(dx: number, dy: number) {
    pointer("pointerdown", 300, 300);
    for (let i = 1; i <= 100; i++) {
      pointer("pointermove", 300 + (dx * i) / 100, 300 + (dy * i) / 100);
      advance(1 / 60);
    }
    pointer("pointerup", 300 + dx, 300 + dy);
    settle();
  }
  settle();
  return {
    player,
    onAction,
    pointer,
    drag,
    settle,
    advance,
    group: state.group!,
  };
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

it("slowly aligns an arbitrary pose before starting level, bounded oscillation", () => {
  const { player, group, drag, advance, onAction } = setup();
  vi.spyOn(Math, "random").mockReturnValue(0.1);
  drag(Math.PI / 0.007, 160);
  const turned = group.quaternion.clone();
  const front = new THREE.Quaternion();
  player.setPlaying(true);
  advance(0.5);
  expect(group.quaternion.angleTo(front)).toBeLessThan(turned.angleTo(front));
  expect(group.quaternion.angleTo(front)).toBeGreaterThan(1);
  advance(2.5);
  expect(group.quaternion.angleTo(front)).toBeGreaterThan(0.5);
  advance(3);
  expect(group.quaternion.angleTo(front)).toBeLessThan(0.001);
  const angles: number[] = [];
  for (let i = 0; i < 900; i++) {
    advance(0.05);
    angles.push(group.rotation.y);
    expect(Math.abs(group.rotation.x)).toBeLessThan(0.001);
    expect(Math.abs(group.rotation.z)).toBeLessThan(0.001);
  }
  expect(angles[0]).toBeLessThan(0);
  expect(Math.min(...angles)).toBeLessThan(-0.55);
  expect(Math.max(...angles)).toBeGreaterThan(0.55);
  expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(0.62);
  expect(angles[224]).toBeCloseTo(-THREE.MathUtils.degToRad(35), 3);
  expect(angles[674]).toBeCloseTo(THREE.MathUtils.degToRad(35), 3);
  expect(group.quaternion.angleTo(front)).toBeLessThan(0.001);
  expect(onAction).not.toHaveBeenCalled();
  player.dispose();
});

it.each([1, 10])(
  "freezes immediately on hover and resumes the same motion after %s seconds",
  (seconds) => {
    const { player, group, pointer, advance, drag } = setup();
    drag(100, 60);
    pointer("pointerleave", 650, 300);
    advance(2);
    player.setPlaying(true);
    advance(seconds);
    const frozen = group.quaternion.clone();
    pointer("pointerenter", 300, 300);
    advance(4);
    expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
    pointer("pointerleave", 650, 300);
    advance(2);
    expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
    advance(1 / 60);
    expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.03);
    advance(0.5);
    expect(group.quaternion.angleTo(frozen)).toBeGreaterThan(0.0001);
    expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.01);
    player.dispose();
  },
);

it("waits while hovered and freezes both alignment and oscillation when paused", () => {
  const { player, group, pointer, advance, drag } = setup();
  drag(100, 60);
  pointer("pointerenter", 300, 300);
  const original = group.quaternion.clone();
  player.setPlaying(true);
  advance(4);
  expect(group.quaternion.angleTo(original)).toBeLessThan(0.000001);
  pointer("pointerleave", 650, 300);
  advance(2);
  for (const elapsed of [1, 7]) {
    advance(elapsed);
    const paused = group.quaternion.clone();
    player.setPlaying(false);
    advance(5);
    expect(group.quaternion.angleTo(paused)).toBeLessThan(0.000001);
    player.setPlaying(true);
  }
  player.dispose();
});

it("supports manual rotation while playing and realigns only after the mouse leaves", () => {
  const { player, group, pointer, drag, advance } = setup();
  player.setPlaying(true);
  advance(10);
  pointer("pointerenter", 300, 300);
  drag(250, 150);
  const turned = group.quaternion.clone();
  advance(4);
  expect(group.quaternion.angleTo(turned)).toBeLessThan(0.001);
  pointer("pointerleave", 650, 300);
  advance(2);
  expect(group.quaternion.angleTo(turned)).toBeLessThan(0.001);
  advance(0.5);
  expect(group.quaternion.angleTo(turned)).toBeLessThan(0.3);
  advance(5.5);
  expect(group.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.001);
  player.dispose();
});

it("restarts the two-second delay whenever the cursor returns and leaves again", () => {
  const { player, group, pointer, advance } = setup();
  player.setPlaying(true);
  advance(10);
  pointer("pointerenter", 300, 300);
  const frozen = group.quaternion.clone();
  pointer("pointerleave", 650, 300);
  advance(1.5);
  expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
  pointer("pointerenter", 300, 300);
  advance(3);
  expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
  pointer("pointerleave", 650, 300);
  advance(2);
  expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
  advance(0.5);
  expect(group.quaternion.angleTo(frozen)).toBeGreaterThan(0.0001);
  expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.01);
  player.dispose();
});

it("respects reduced motion and still allows manual rotation", () => {
  const { player, group, drag, advance } = setup(true);
  const original = group.quaternion.clone();
  player.setPlaying(true);
  advance(20);
  expect(group.quaternion.angleTo(original)).toBeLessThan(0.000001);
  drag(100, 50);
  expect(group.quaternion.angleTo(original)).toBeGreaterThan(0.5);
  player.dispose();
});

it("keeps the same animation speed at different frame rates", () => {
  const first = setup();
  vi.spyOn(Math, "random").mockReturnValue(0.8);
  first.player.setPlaying(true);
  first.advance(37, 30);
  const at30fps = first.group.quaternion.clone();
  first.player.dispose();
  const second = setup();
  second.player.setPlaying(true);
  second.advance(37, 120);
  expect(second.group.quaternion.angleTo(at30fps)).toBeLessThan(0.001);
  second.player.dispose();
});

it("adds a smooth random pitch in parallel with yaw and can skip the next pitch", () => {
  const { player, group, advance, pointer, drag } = setup();
  drag(100, 60);
  pointer("pointerleave", 650, 300);
  advance(2);
  // Ten-second upward tilt, ten seconds level, then a smaller downward tilt.
  vi.spyOn(Math, "random")
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0.75)
    .mockReturnValueOnce(0.8)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.1)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.9)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.1)
    .mockReturnValue(0.1);
  player.setPlaying(true);
  advance(6);
  expect(group.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.001);
  for (let i = 1; i <= 300; i++) {
    const before = group.quaternion.clone();
    advance(0.1);
    const seconds = i / 10;
    expect(group.rotation.y).toBeCloseTo(
      -THREE.MathUtils.degToRad(35) * Math.sin((seconds * Math.PI * 2) / 45),
      5,
    );
    expect(Math.abs(group.rotation.x)).toBeLessThanOrEqual(
      THREE.MathUtils.degToRad(7),
    );
    expect(Math.abs(group.rotation.z)).toBeLessThan(0.001);
    expect(group.quaternion.angleTo(before)).toBeLessThan(0.025);
    if (i === 50) {
      expect(group.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(6), 3);
      const frozen = group.quaternion.clone();
      pointer("pointerenter", 300, 300);
      advance(20);
      expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
      pointer("pointerleave", 650, 300);
      player.setPlaying(false);
      advance(20);
      expect(group.quaternion.angleTo(frozen)).toBeLessThan(0.000001);
      player.setPlaying(true);
      // The two-second acceleration advances the animation by one second.
      advance(2);
      i += 10;
    }
    if (i >= 100 && i <= 200)
      expect(Math.abs(group.rotation.x)).toBeLessThan(0.001);
    if (i === 250)
      expect(group.rotation.x).toBeCloseTo(-THREE.MathUtils.degToRad(3), 3);
  }
  player.dispose();
});

it.each([30, 120])(
  "ramps up for two seconds after the delay, then advances at normal speed (%s fps)",
  (fps) => {
    const { player, group, pointer, advance } = setup();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    player.setPlaying(true);
    advance(46, fps);
    pointer("pointerenter", 300, 300);
    pointer("pointerleave", 650, 300);
    advance(2, fps);
    expect(Math.abs(group.rotation.y)).toBeLessThan(0.000001);
    const progressAt = (seconds: number) =>
      -THREE.MathUtils.degToRad(35) * Math.sin((seconds * Math.PI * 2) / 45);
    advance(0.5, fps);
    expect(group.rotation.y).toBeCloseTo(progressAt(0.02734375), 5);
    advance(1.5, fps);
    expect(group.rotation.y).toBeCloseTo(progressAt(1), 5);
    advance(1, fps);
    expect(group.rotation.y).toBeCloseTo(progressAt(2), 5);
    advance(1, fps);
    expect(group.rotation.y).toBeCloseTo(progressAt(3), 5);
    player.dispose();
  },
);

it.each([false, true])(
  "skips unnecessary alignment on first play while preserving the hover delay (hovered: %s)",
  (hovered) => {
    const { player, group, pointer, advance } = setup();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    if (hovered) pointer("pointerenter", 300, 300);
    player.setPlaying(true);
    if (hovered) {
      advance(8);
      expect(group.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(
        0.000001,
      );
      pointer("pointerleave", 650, 300);
      advance(2);
      expect(group.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(
        0.000001,
      );
    }
    advance(0.5);
    expect(group.rotation.y).toBeLessThan(-0.001);
    expect(group.rotation.y).toBeGreaterThan(-0.01);
    advance(1.5);
    expect(group.rotation.y).toBeCloseTo(
      -THREE.MathUtils.degToRad(35) * Math.sin((Math.PI * 2) / 45),
      5,
    );
    player.dispose();
  },
);
