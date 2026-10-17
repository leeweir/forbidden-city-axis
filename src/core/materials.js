import * as THREE from 'three';

const T = {}; // 程序化纹理
const glowMaterials = [];

function rand(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- 琉璃瓦：竖为瓦垄，横为瓦片接缝 ---------- */
T.roof = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#ac8330';
  ctx.fillRect(0, 0, w, h);
  const cols = 8;
  const cw = w / cols;
  for (let i = 0; i < cols; i++) {
    const x = i * cw;
    const g = ctx.createLinearGradient(x, 0, x + cw, 0);
    g.addColorStop(0, '#6a4a16');
    g.addColorStop(0.1, '#98701f');
    g.addColorStop(0.34, '#d9aa4c');
    g.addColorStop(0.48, '#f0cc7d');
    g.addColorStop(0.62, '#d8a747');
    g.addColorStop(0.88, '#8a611d');
    g.addColorStop(1, '#5e4014');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, cw, h);
  }
  for (let y = 0; y < h; y += 128) {
    ctx.fillStyle = 'rgba(48,31,7,.55)';
    ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = 'rgba(255,232,178,.18)';
    ctx.fillRect(0, y + 2, w, 2);
  }
  const r = rand(13);
  for (let i = 0; i < 2200; i++) {
    const x = r() * w;
    const y = r() * h;
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,238,198,.06)' : 'rgba(42,26,5,.09)';
    ctx.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
  }
});

/* ---------- 额枋旋子彩画 ---------- */
T.beam = canvasTexture(512, 128, (ctx, w, h) => {
  ctx.fillStyle = '#123a33';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c7a058';
  ctx.fillRect(0, 0, w, 4);
  ctx.fillRect(0, h - 4, w, 4);
  ctx.fillStyle = '#7f2b21';
  ctx.fillRect(0, 5, w, 3);
  ctx.fillRect(0, h - 8, w, 3);
  for (let i = 0; i < 8; i++) {
    const x = i * 64 + 32;
    ctx.fillStyle = '#174a52';
    ctx.beginPath();
    ctx.ellipse(x, h / 2, 21, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c7a058';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#c7a058';
    ctx.beginPath();
    ctx.arc(x, h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6d241d';
    ctx.beginPath();
    ctx.arc(x, h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c7a058';
    ctx.fillRect(x - 26, 13, 3, 5);
    ctx.fillRect(x + 23, 13, 3, 5);
    ctx.fillRect(x - 26, h - 18, 3, 5);
    ctx.fillRect(x + 23, h - 18, 3, 5);
    ctx.fillStyle = '#3f7d70';
    ctx.beginPath();
    ctx.arc(x - 30, h / 2, 5, 0, Math.PI * 2);
    ctx.arc(x + 30, h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
});

/* ---------- 斗拱带 ---------- */
T.dougong = canvasTexture(512, 128, (ctx, w, h) => {
  ctx.fillStyle = '#0f2d28';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    const x = i * 32;
    ctx.fillStyle = '#0a211d';
    ctx.fillRect(x, 0, 5, h);
    ctx.fillStyle = '#b48d45';
    ctx.fillRect(x + 7, 30, 19, 9);
    ctx.fillStyle = '#caa45b';
    ctx.fillRect(x + 12, 20, 9, 20);
    ctx.fillRect(x + 4, 55, 24, 7);
    ctx.fillStyle = '#7e2a1f';
    ctx.fillRect(x + 10, 66, 13, 9);
    ctx.fillStyle = '#2b6a5c';
    ctx.fillRect(x + 25, 33, 5, 4);
    ctx.fillRect(x + 2, 33, 5, 4);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(x + 7, 39, 19, 3);
    ctx.fillRect(x + 9, 75, 15, 6);
    ctx.fillStyle = '#caa45b';
    ctx.fillRect(x + 13, 88, 7, 7);
    ctx.fillRect(x + 13, 100, 7, 12);
  }
  ctx.fillStyle = '#d0aa60';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h - 3, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(0, 3, w, 4);
});

/* ---------- 隔扇门：一贴＝一间四扇 ---------- */
function drawDoor(ctx, w, h, glow) {
  ctx.fillStyle = glow ? '#000000' : '#5c1d17';
  ctx.fillRect(0, 0, w, h);
  const leaves = 4;
  const lw = w / leaves;
  for (let i = 0; i < leaves; i++) {
    const x = i * lw;
    const frame = glow ? '#ffc574' : '#b98f49';
    const lattice = glow ? '#ffcf86' : '#d8b264';
    const panel = glow ? '#140800' : '#4d1812';
    ctx.fillStyle = glow ? '#000' : '#3f120d';
    ctx.fillRect(x + 3, 3, lw - 6, h - 6);
    ctx.strokeStyle = frame;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(x + 5, 5, lw - 10, h - 10);
    // 格心
    const gy0 = 12;
    const gy1 = h * 0.6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 9, gy0, lw - 18, gy1 - gy0);
    ctx.clip();
    ctx.strokeStyle = lattice;
    ctx.lineWidth = 1.4;
    for (let d = -h; d < w + h; d += 18) {
      ctx.beginPath();
      ctx.moveTo(x + d, gy0);
      ctx.lineTo(x + d - (gy1 - gy0), gy1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + d, gy0);
      ctx.lineTo(x + d + (gy1 - gy0), gy1);
      ctx.stroke();
    }
    ctx.fillStyle = glow ? '#ffd993' : '#e0bd78';
    for (let yy = gy0 + 9; yy < gy1; yy += 18) {
      for (let xx = x + 15; xx < x + lw - 8; xx += 18) {
        ctx.beginPath();
        ctx.arc(xx, yy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (!glow) {
      ctx.fillStyle = '#2c0c09';
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x + 9, gy0, lw - 18, gy1 - gy0);
      ctx.globalAlpha = 1;
    }
    // 绦环板
    ctx.fillStyle = panel;
    ctx.fillRect(x + 9, gy1 + 8, lw - 18, h * 0.1);
    ctx.strokeStyle = frame;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x + 12, gy1 + 11, lw - 24, h * 0.1 - 6);
    ctx.fillStyle = glow ? '#c98a3c' : '#a87c3f';
    ctx.beginPath();
    ctx.ellipse(x + lw / 2, gy1 + 8 + h * 0.05, lw * 0.16, h * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
    // 裙板
    const py = gy1 + 8 + h * 0.1 + 8;
    ctx.fillStyle = panel;
    ctx.fillRect(x + 9, py, lw - 18, h - py - 14);
    ctx.strokeStyle = frame;
    ctx.strokeRect(x + 12, py + 3, lw - 24, h - py - 20);
    ctx.strokeRect(x + 16, py + 7, lw - 32, h - py - 28);
    if (!glow) {
      ctx.strokeStyle = 'rgba(216,178,100,.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x + lw / 2, py + (h - py) / 2, 9, 0.2, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + lw / 2 + 6, py + (h - py) / 2 - 4, 5, 0, Math.PI * 1.4);
      ctx.stroke();
    }
  }
  if (!glow) {
    // 门缝阴影
    for (let i = 1; i < leaves; i++) {
      ctx.fillStyle = 'rgba(20,4,2,.65)';
      ctx.fillRect(i * lw - 1.5, 4, 3, h - 8);
    }
  }
}
T.door = canvasTexture(512, 1024, (ctx, w, h) => drawDoor(ctx, w, h, false));
T.doorGlow = canvasTexture(512, 1024, (ctx, w, h) => drawDoor(ctx, w, h, true));

/* ---------- 菱花窗 ---------- */
function drawLattice(ctx, w, h, glow) {
  ctx.fillStyle = glow ? '#000' : '#4e1712';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = glow ? '#ffbe6a' : '#b58a48';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.strokeStyle = glow ? '#ffd48c' : '#d2ab66';
  ctx.lineWidth = 1.6;
  for (let d = -h; d < w + h; d += 26) {
    ctx.beginPath();
    ctx.moveTo(d, 6);
    ctx.lineTo(d + h, h - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(d, 6);
    ctx.lineTo(d - h, h - 6);
    ctx.stroke();
  }
  ctx.fillStyle = glow ? '#ffdca0' : '#e0bc78';
  for (let yy = 16; yy < h; yy += 26) {
    for (let xx = 16; xx < w; xx += 26) {
      ctx.beginPath();
      ctx.arc(xx, yy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!glow) {
    ctx.fillStyle = 'rgba(24,5,3,.4)';
    ctx.fillRect(6, 6, w - 12, h - 12);
  }
}
T.lattice = canvasTexture(256, 256, (ctx, w, h) => drawLattice(ctx, w, h, false));
T.latticeGlow = canvasTexture(256, 256, (ctx, w, h) => drawLattice(ctx, w, h, true));

/* ---------- 宫墙 ---------- */
T.wall = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#8d2d21';
  ctx.fillRect(0, 0, w, h);
  const r = rand(31);
  for (let i = 0; i < 3400; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r();
    ctx.fillStyle = a > 0.62 ? 'rgba(196,92,66,.08)' : a > 0.3 ? 'rgba(60,14,9,.09)' : 'rgba(255,190,150,.035)';
    ctx.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    ctx.fillStyle = 'rgba(46,10,6,.05)';
    ctx.fillRect(x, 0, 2 + r() * 8, h);
  }
  ctx.fillStyle = 'rgba(30,6,4,.12)';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
});

/* ---------- 汉白玉 ---------- */
T.marble = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#d4cab5';
  ctx.fillRect(0, 0, w, h);
  const r = rand(101);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,252,240,.09)' : 'rgba(120,108,88,.06)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.strokeStyle = 'rgba(120,110,92,.14)';
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = 1 + r() * 1.6;
    ctx.beginPath();
    let x = r() * w;
    let y = r() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * 160;
      y += (r() - 0.4) * 120;
      ctx.quadraticCurveTo(x + 30, y - 20, x, y);
    }
    ctx.stroke();
  }
});

T.marbleFloor = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#cec3ae';
  ctx.fillRect(0, 0, w, h);
  const r = rand(55);
  const n = 4;
  const s = w / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const shade = 200 + Math.floor(r() * 22);
      ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 27})`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  }
  ctx.strokeStyle = 'rgba(120,110,92,.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * s);
    ctx.lineTo(w, i * s);
    ctx.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,252,240,.06)' : 'rgba(110,98,78,.05)';
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
});

/* ---------- 城墙 / 砖 ---------- */
T.brick = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#787166';
  ctx.fillRect(0, 0, w, h);
  const bw = 128;
  const bh = 42;
  const r = rand(71);
  for (let row = 0; row < h / bh; row++) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < w + bw; x += bw) {
      const shade = 96 + Math.floor(r() * 26);
      ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`;
      ctx.fillRect(x + offset + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  ctx.strokeStyle = 'rgba(48,45,40,.42)';
  ctx.lineWidth = 2;
  for (let row = 0; row <= h / bh; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * bh);
    ctx.lineTo(w, row * bh);
    ctx.stroke();
  }
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)';
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
});

/* ---------- 广场地面 ---------- */
T.ground = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#a99e8a';
  ctx.fillRect(0, 0, w, h);
  const r = rand(17);
  const bw = 128;
  const bh = 64;
  for (let row = 0; row < h / bh; row++) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < w + bw; x += bw) {
      const s = 156 + Math.floor(r() * 24);
      ctx.fillStyle = `rgb(${s},${s - 6},${s - 22})`;
      ctx.fillRect(x + offset + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  ctx.strokeStyle = 'rgba(86,80,68,.22)';
  ctx.lineWidth = 2;
  for (let row = 0; row <= h / bh; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * bh);
    ctx.lineTo(w, row * bh);
    ctx.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,250,236,.05)' : 'rgba(70,62,50,.05)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
});

T.court = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#b4a992';
  ctx.fillRect(0, 0, w, h);
  const r = rand(23);
  const n = 4;
  const s = w / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const sh = 172 + Math.floor(r() * 20);
      ctx.fillStyle = `rgb(${sh},${sh - 8},${sh - 24})`;
      ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  }
  ctx.strokeStyle = 'rgba(92,84,70,.2)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * s);
    ctx.lineTo(w, i * s);
    ctx.stroke();
  }
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,250,236,.06)' : 'rgba(64,56,44,.04)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
});

/* ---------- 山花 / 檐底 ---------- */
T.gable = canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#6d2119';
  ctx.fillRect(0, 0, w, h);
  const r = rand(9);
  for (let x = 0; x < w; x += 12) {
    ctx.fillStyle = 'rgba(36,8,5,.22)';
    ctx.fillRect(x, 0, 4, h);
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,210,160,.04)' : 'rgba(30,6,4,.06)';
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
});

T.soffit = canvasTexture(256, 128, (ctx, w, h) => {
  ctx.fillStyle = '#3d1410';
  ctx.fillRect(0, 0, w, h);
  for (let x = 12; x < w; x += 24) {
    ctx.fillStyle = '#6e271d';
    ctx.fillRect(x, 0, 9, h);
    ctx.fillStyle = '#b08a4a';
    ctx.fillRect(x + 2, h * 0.42, 5, 5);
  }
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
});

/* ---------- 城门门扇：金钉 ---------- */
T.gateDoor = canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#5a1a14';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(30,6,4,.35)';
  ctx.fillRect(w / 2 - 2, 0, 4, h);
  for (let y = 22; y < h; y += 34) {
    for (let x = 20; x < w; x += 32) {
      if (Math.abs(x - w / 2) < 16) continue;
      ctx.fillStyle = '#b79150';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,190,.5)';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#a8813f';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);
});

/* ---------- 御路石雕 ---------- */
T.ramp = canvasTexture(256, 512, (ctx, w, h) => {
  ctx.fillStyle = '#cec3ad';
  ctx.fillRect(0, 0, w, h);
  const r = rand(43);
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(255,252,240,.08)' : 'rgba(104,94,74,.08)';
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
  ctx.strokeStyle = 'rgba(112,102,84,.32)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.lineWidth = 1.4;
  for (let y = 60; y < h - 40; y += 92) {
    ctx.beginPath();
    ctx.moveTo(58, y);
    ctx.bezierCurveTo(96, y - 34, w - 78, y + 40, w - 54, y + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(78, y + 26, 16, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 78, y + 52, 12, 0.6, Math.PI * 2.1);
    ctx.stroke();
  }
});

/* ---------- 水面法线 ---------- */
T.waterNormal = (() => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = (x, y) =>
    Math.sin(x * 0.16 + Math.sin(y * 0.05) * 2.2) * 0.5 +
    Math.sin(y * 0.21 - x * 0.04) * 0.32 +
    Math.sin((x + y) * 0.09) * 0.18;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = height((x - 1 + size) % size, y);
      const hr = height((x + 1) % size, y);
      const hd = height(x, (y - 1 + size) % size);
      const hu = height(x, (y + 1) % size);
      let nx = (hl - hr) * 0.6;
      let ny = (hd - hu) * 0.6;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
})();

/* ---------- 匾额 ---------- */
const plaqueCache = new Map();
export function getPlaqueTexture(text) {
  if (plaqueCache.has(text)) return plaqueCache.get(text);
  const tex = canvasTexture(640, 200, (ctx, w, h) => {
    ctx.fillStyle = '#0b1011';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c8a45d';
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.strokeStyle = 'rgba(200,164,93,.5)';
    for (const [x, y] of [
      [38, 38], [w - 38, 38], [38, h - 38], [w - 38, h - 38],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }
    ctx.fillStyle = '#e2c27f';
    ctx.font = '600 88px "Songti SC", "Noto Serif CJK SC", "STSong", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spacing = text.length > 3 ? 4 : 16;
    const widths = [...text].map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
    let x = w / 2 - total / 2;
    [...text].forEach((c, i) => {
      ctx.fillText(c, x + widths[i] / 2, h / 2 + 4);
      x += widths[i] + spacing;
    });
    ctx.fillStyle = 'rgba(120,28,20,.9)';
    ctx.fillRect(w - 76, h - 66, 30, 30);
    ctx.fillStyle = '#e6cba0';
    ctx.font = '600 15px "Songti SC", serif';
    ctx.fillText('御', w - 61, h - 51);
  });
  plaqueCache.set(text, tex);
  return tex;
}

/* ---------- 材质 ---------- */
export const MAT = {
  roof: new THREE.MeshStandardMaterial({
    map: T.roof, roughness: 0.34, metalness: 0.3, envMapIntensity: 1.1,
    side: THREE.DoubleSide,
  }),
  ridge: new THREE.MeshStandardMaterial({
    color: 0xb68c3d, roughness: 0.28, metalness: 0.5, envMapIntensity: 1.2,
  }),
  gable: new THREE.MeshStandardMaterial({
    map: T.gable, roughness: 0.8, side: THREE.DoubleSide,
  }),
  beam: new THREE.MeshStandardMaterial({
    map: T.beam, roughness: 0.62, metalness: 0.08,
  }),
  dougong: new THREE.MeshStandardMaterial({
    map: T.dougong, roughness: 0.68, metalness: 0.06,
  }),
  wall: new THREE.MeshStandardMaterial({
    map: T.wall, roughness: 0.88,
  }),
  door: new THREE.MeshStandardMaterial({
    map: T.door, emissiveMap: T.doorGlow, emissive: 0xffb257,
    emissiveIntensity: 0, roughness: 0.58,
  }),
  lattice: new THREE.MeshStandardMaterial({
    map: T.lattice, emissiveMap: T.latticeGlow, emissive: 0xffbd6a,
    emissiveIntensity: 0, roughness: 0.6,
  }),
  marble: new THREE.MeshStandardMaterial({
    map: T.marble, roughness: 0.74,
  }),
  marbleFloor: new THREE.MeshStandardMaterial({
    map: T.marbleFloor, roughness: 0.7,
  }),
  brick: new THREE.MeshStandardMaterial({
    map: T.brick, roughness: 0.92,
  }),
  ground: new THREE.MeshStandardMaterial({
    map: T.ground, roughness: 0.97,
  }),
  court: new THREE.MeshStandardMaterial({
    map: T.court, roughness: 0.94,
  }),
  soffit: new THREE.MeshStandardMaterial({
    map: T.soffit, roughness: 0.82, side: THREE.DoubleSide,
  }),
  ramp: new THREE.MeshStandardMaterial({
    map: T.ramp, roughness: 0.8,
  }),
  gateDoor: new THREE.MeshStandardMaterial({
    map: T.gateDoor, roughness: 0.75,
  }),
  column: new THREE.MeshStandardMaterial({
    color: 0x84291f, roughness: 0.55,
  }),
  columnBase: new THREE.MeshStandardMaterial({
    color: 0xc8bda7, roughness: 0.8,
  }),
  gold: new THREE.MeshStandardMaterial({
    color: 0xd3ad63, roughness: 0.28, metalness: 0.82,
  }),
  bronze: new THREE.MeshStandardMaterial({
    color: 0x51402b, roughness: 0.46, metalness: 0.72,
  }),
  darkWood: new THREE.MeshStandardMaterial({
    color: 0x3c1d15, roughness: 0.78,
  }),
  treeTrunk: new THREE.MeshStandardMaterial({
    color: 0x40332a, roughness: 1,
  }),
  treeLeaf: new THREE.MeshStandardMaterial({
    color: 0x33422f, roughness: 1, flatShading: true,
  }),
  treeLeafLight: new THREE.MeshStandardMaterial({
    color: 0x475439, roughness: 1, flatShading: true,
  }),
  mountain: new THREE.MeshStandardMaterial({
    color: 0x2b3633, roughness: 1, flatShading: true,
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x6c6a60, roughness: 1, flatShading: true,
  }),
  earth: new THREE.MeshStandardMaterial({
    color: 0x756b5a, roughness: 1,
  }),
  water: new THREE.MeshStandardMaterial({
    color: 0x1a3436, roughness: 0.1, metalness: 0.86,
    normalMap: T.waterNormal, normalScale: new THREE.Vector2(0.28, 0.28),
  }),
  lantern: new THREE.MeshStandardMaterial({
    color: 0xbe3a26, emissive: 0xff6b3a, emissiveIntensity: 0.32, roughness: 0.42,
  }),
  star: new THREE.PointsMaterial({
    color: 0xfff3d6, size: 2.2, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false,
  }),
};

MAT.column.side = THREE.FrontSide;

const doorCache = new Map();
export function getDoorMaterial(repeat) {
  const key = `d${repeat}`;
  if (doorCache.has(key)) return doorCache.get(key);
  const map = T.door.clone();
  map.needsUpdate = true;
  map.repeat.set(repeat, 1);
  const glow = T.doorGlow.clone();
  glow.needsUpdate = true;
  glow.repeat.set(repeat, 1);
  const m = new THREE.MeshStandardMaterial({
    map, emissiveMap: glow, emissive: 0xffb257,
    emissiveIntensity: 0, roughness: 0.58,
  });
  doorCache.set(key, m);
  glowMaterials.push({ material: m, factor: 0.85 });
  return m;
}

const latticeCache = new Map();
export function getLatticeMaterial(rx, ry = 1) {
  const key = `l${rx}x${ry}`;
  if (latticeCache.has(key)) return latticeCache.get(key);
  const map = T.lattice.clone();
  map.needsUpdate = true;
  map.repeat.set(rx, ry);
  const glow = T.latticeGlow.clone();
  glow.needsUpdate = true;
  glow.repeat.set(rx, ry);
  const m = new THREE.MeshStandardMaterial({
    map, emissiveMap: glow, emissive: 0xffbd6a,
    emissiveIntensity: 0, roughness: 0.6,
  });
  latticeCache.set(key, m);
  glowMaterials.push({ material: m, factor: 1.15 });
  return m;
}

export const TEXTURES = T;

export function setNightGlow(night) {
  for (const { material, factor } of glowMaterials) {
    material.emissiveIntensity = night * factor;
  }
  MAT.lantern.emissiveIntensity = 0.16 + night * 2.2;
  MAT.star.opacity = Math.max(0, (night - 0.25) / 0.75) * 0.9;
}

export function updateWater(time) {
  T.waterNormal.offset.set(time * 0.008, time * 0.013);
}

export function applyEnvironment(renderer, envTexture) {
  return envTexture;
}
