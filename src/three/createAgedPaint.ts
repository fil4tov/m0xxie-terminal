import * as THREE from "three";

export function createAgedPaint() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const pixels = ctx.createImageData(512, 512);
  let seed = 73;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Fixed, mipmapped texture: the wear does not crawl as the camera moves.
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const edge = Math.min(x, y, 511 - x, 511 - y);
      const patina = Math.max(0, 1 - edge / 35) * 24;
      const mottling = Math.sin(x * 0.019) * Math.cos(y * 0.027) * 3;
      const shade = Math.round(244 - patina + mottling + (random() - 0.5) * 8);
      const i = (y * 512 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = shade;
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  // Small scuffs collect around the perimeter, leaving the central paint clean.
  for (let i = 0; i < 160; i++) {
    const side = Math.floor(random() * 4);
    const along = random() * 512;
    const inset = 5 + random() * 15;
    const x = side < 2 ? along : side === 2 ? inset : 512 - inset;
    const y = side >= 2 ? along : side === 0 ? inset : 512 - inset;
    ctx.strokeStyle =
      i % 3 === 0 ? "rgba(255,255,255,0.22)" : "rgba(65,61,49,0.22)";
    ctx.lineWidth = 0.5 + random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + (side < 2 ? 2 + random() * 6 : random() * 2),
      y + (side >= 2 ? 2 + random() * 6 : random() * 2),
    );
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return new THREE.MeshStandardMaterial({
    color: "#9e8c68",
    map: texture,
    metalness: 0.08,
    roughness: 0.79,
  });
}
