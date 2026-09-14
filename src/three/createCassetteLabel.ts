import * as THREE from "three";

export function createTapeWinding() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#30291e";
  ctx.fillRect(0, 0, 512, 512);
  for (let r = 80; r < 256; r += 3) {
    ctx.strokeStyle = r % 2 ? "#574a3480" : "#17191070";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.75,
    metalness: 0.08,
  });
}

/** Paper label with a cut-out window, so the physical tape remains visible. */
export function createCassetteLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 480;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.lineTo(952, 0);
  ctx.lineTo(1000, 46);
  ctx.lineTo(1000, 480);
  ctx.lineTo(0, 480);
  ctx.lineTo(0, 46);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#c9c19d";
  ctx.fillRect(0, 0, 1000, 480);
  ctx.fillStyle = "#b84c2b";
  ctx.fillRect(0, 270, 1000, 210);
  ctx.fillStyle = "#d5cba7";
  ctx.fillRect(24, 270, 15, 210);
  ctx.fillRect(58, 270, 25, 210);

  // Seeded paper grain stays still, including when the model is rotated.
  let seed = 193;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 18000; i++) {
    ctx.fillStyle = random() > 0.5 ? "#4c392515" : "#fff3c51a";
    ctx.fillRect(random() * 1000, random() * 480, 1 + random() * 3, 1);
  }
  const patina = ctx.createLinearGradient(0, 0, 0, 480);
  patina.addColorStop(0, "#59432225");
  patina.addColorStop(0.18, "#59432200");
  patina.addColorStop(0.8, "#59432200");
  patina.addColorStop(1, "#59432238");
  ctx.fillStyle = patina;
  ctx.fillRect(0, 0, 1000, 480);
  ctx.strokeStyle = "#72684936";
  ctx.lineWidth = 1;
  for (const y of [67, 109, 151]) {
    ctx.beginPath();
    ctx.moveTo(82, y);
    ctx.lineTo(917, y);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(145, 121);
  ctx.rotate(-0.025);
  ctx.fillStyle = "#070906";
  ctx.font = 'bold italic 48px "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText("m0xxie / PERSONAL TAPES", 0, 0, 740);
  ctx.restore();
  ctx.fillStyle = "#292a21";
  ctx.font = "bold 35px Arial";
  ctx.fillText("A", 937, 267);
  ctx.font = "18px monospace";
  ctx.fillStyle = "#e5c396";
  ctx.fillText("NORMAL BIAS   /   C–90", 650, 455);

  ctx.fillStyle = "#111510";
  ctx.beginPath();
  ctx.roundRect(64, 148, 872, 308, 154);
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.roundRect(74, 158, 852, 288, 144);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.5,
    roughness: 0.94,
    metalness: 0,
  });
}
