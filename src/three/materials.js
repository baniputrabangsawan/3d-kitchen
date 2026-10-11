import * as THREE from 'three';

/**
 * Material & geometri bersama untuk seluruh dapur.
 * Semua geometri dibuat prosedural (Box/Cylinder/Torus/Plane);
 * tekstur sederhana dibuat via Canvas API. Tidak ada model unduhan.
 */

// ---------------------------------------------------------------------------
// Cache geometri: dipakai ulang antar build agar pergantian varian tidak
// menumpuk buffer GPU baru.
// ---------------------------------------------------------------------------
const geoCache = new Map();

function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

export const geo = {
  box: (w, h, d) =>
    cached(`b:${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (rt, rb, h, seg = 24) =>
    cached(`c:${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  torus: (r, t, arc = Math.PI * 2, rs = 12, ts = 24) =>
    cached(`t:${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  plane: (w, h) => cached(`p:${w}|${h}`, () => new THREE.PlaneGeometry(w, h)),
  sphere: (r, w = 20, h = 14) =>
    cached(`s:${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h)),
};

// ---------------------------------------------------------------------------
// Tekstur prosedural (Canvas API)
// ---------------------------------------------------------------------------
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grain(g, w, h, base, streak, lines = 46) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = streak;
  g.globalAlpha = 0.16;
  for (let i = 0; i < lines; i++) {
    const y = Math.random() * h;
    g.lineWidth = 1 + Math.random() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) {
      g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4 + (Math.random() - 0.5) * 3);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
}

function speckle(g, w, h, base, dots, n = 2600) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = dots[(Math.random() * dots.length) | 0];
    g.globalAlpha = 0.25 + Math.random() * 0.5;
    const s = 1 + Math.random() * 2.4;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 1;
}

export function makeFloorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#d9d5cf';
    g.fillRect(0, 0, w, h);
    const n = 2;
    const s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 214 + ((i * 7 + j * 13) % 3) * 4;
        g.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
        g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      }
    }
    g.strokeStyle = '#b9b4ab';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
}

export function makeBacksplashTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#e8e4dd';
    g.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 4;
    const tw = w / cols;
    const th = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < cols + 1; c++) {
        const off = r % 2 === 0 ? 0 : tw / 2;
        const x = c * tw + off;
        const v = 232 + ((r * 5 + c * 11) % 3) * 5;
        g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
        g.fillRect(x + 2, r * th + 2, tw - 4, th - 4);
      }
    }
  });
}

export function makeStoneTexture(kind) {
  if (kind === 'granite') {
    return canvasTexture(512, 512, (g, w, h) =>
      speckle(g, w, h, '#26262a', ['#0c0c0e', '#4a4a52', '#8a8a94', '#c9c9d2'], 5200));
  }
  if (kind === 'wood') {
    const t = canvasTexture(512, 512, (g, w, h) =>
      grain(g, w, h, '#a98052', '#6e4f2c', 60));
    return t;
  }
  // carrara: terang dengan urat abu-abu
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#f1efec';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9bcc2';
    for (let i = 0; i < 14; i++) {
      g.globalAlpha = 0.28 + Math.random() * 0.3;
      g.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 24) {
        g.lineTo(x, y + Math.sin(x * 0.015 + i * 2) * 14 + (Math.random() - 0.5) * 6);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

export function makeWoodTexture() {
  return canvasTexture(512, 512, (g, w, h) => grain(g, w, h, '#c9a06b', '#7d5a33', 52));
}

export function makeCooktopTexture() {
  return canvasTexture(512, 448, (g, w, h) => {
    g.fillStyle = '#101114';
    g.fillRect(0, 0, w, h);
    const rings = [
      [0.26, 0.3, 86], [0.74, 0.3, 86], [0.26, 0.74, 66], [0.74, 0.74, 66],
    ];
    for (const [fx, fy, r] of rings) {
      const x = fx * w;
      const y = fy * h;
      g.strokeStyle = '#3c3f45';
      g.lineWidth = 7;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#232529';
      g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, r - 14, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#1d1f23';
      g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill();
    }
  });
}

/** Panel display kecil (jam/suhu) untuk panel kontrol. */
export function makeDisplayTexture(text, sub = '') {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#0b0e12';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7df0c0';
    g.font = 'bold 56px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, sub ? h / 2 - 18 : h / 2);
    if (sub) {
      g.font = '28px monospace';
      g.fillStyle = '#4c9a78';
      g.fillText(sub, w / 2, h - 30);
    }
  });
}

// ---------------------------------------------------------------------------
// Pilihan desain (warna kabinet & material countertop)
// ---------------------------------------------------------------------------
export const CABINET_COLORS = [
  { id: 'oak', label: 'Oak Natural', color: '#c9a06b' },
  { id: 'white', label: 'Putih Bersih', color: '#ece9e3' },
  { id: 'sage', label: 'Sage Green', color: '#9caf88' },
  { id: 'graphite', label: 'Grafit', color: '#43484e' },
  { id: 'terracotta', label: 'Terracotta', color: '#c0714f' },
];

export const COUNTERTOPS = [
  { id: 'carrara', label: 'Marmer Carrara', kind: 'carrara' },
  { id: 'granite', label: 'Granit Hitam', kind: 'granite' },
  { id: 'wood', label: 'Kayu Solid', kind: 'wood' },
];

// ---------------------------------------------------------------------------
// Shared materials — satu instance dipakai seluruh scene.
// ---------------------------------------------------------------------------
export function createSharedMaterials() {
  const woodTex = makeWoodTexture();
  const M = {
    wood: new THREE.MeshStandardMaterial({ map: woodTex, color: '#c9a06b', roughness: 0.62, metalness: 0.04 }),
    woodInner: new THREE.MeshStandardMaterial({ color: '#b08c5c', roughness: 0.8 }),
    carcass: new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.85 }),
    interior: new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.9 }),
    cavityDark: new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.32, metalness: 0.9 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#6f747b', roughness: 0.45, metalness: 0.85 }),
    blackGlass: new THREE.MeshStandardMaterial({ color: '#14161b', roughness: 0.12, metalness: 0.75 }),
    applianceWhite: new THREE.MeshStandardMaterial({ color: '#f2f3f4', roughness: 0.35, metalness: 0.25 }),
    applianceBlack: new THREE.MeshStandardMaterial({ color: '#1c1e22', roughness: 0.4, metalness: 0.5 }),
    plastic: new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.7 }),
    plasticLight: new THREE.MeshStandardMaterial({ color: '#d7d3cb', roughness: 0.7 }),
    glassShelf: new THREE.MeshStandardMaterial({ color: '#cfe0e8', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 }),
    stone: new THREE.MeshStandardMaterial({ map: makeStoneTexture('carrara'), roughness: 0.32, metalness: 0.05 }),
    wall: new THREE.MeshStandardMaterial({ color: '#f3efe9', roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.5, metalness: 0.04 }),
    backsplash: new THREE.MeshStandardMaterial({ map: makeBacksplashTexture(), roughness: 0.25 }),
    cooktopGlass: new THREE.MeshStandardMaterial({ map: makeCooktopTexture(), roughness: 0.15, metalness: 0.4 }),
    burner: new THREE.MeshStandardMaterial({ color: '#26282d', roughness: 0.6, metalness: 0.6 }),
    grate: new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.7, metalness: 0.4 }),
    toeKick: new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.9 }),
    led: new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#ffe9b8', emissiveIntensity: 2.2 }),
    displayOff: new THREE.MeshStandardMaterial({ color: '#0b0e12', roughness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e8ebef', roughness: 0.15, metalness: 1.0 }),
    stoolSeat: new THREE.MeshStandardMaterial({ color: '#7a5c3e', roughness: 0.6 }),
    accent: new THREE.MeshStandardMaterial({ color: '#c2372b', roughness: 0.6 }),    stoolLeg: new THREE.MeshStandardMaterial({ color: '#26262a', roughness: 0.5, metalness: 0.7 }),
    milk: new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.6 }),
    milkCap: new THREE.MeshStandardMaterial({ color: '#2456c8', roughness: 0.5 }),
    apple: new THREE.MeshStandardMaterial({ color: '#c22f2f', roughness: 0.45 }),
    greens: new THREE.MeshStandardMaterial({ color: '#4d8a3d', roughness: 0.6 }),
    tray: new THREE.MeshStandardMaterial({ color: '#3d3f44', roughness: 0.5, metalness: 0.7 }),
  };
  M.floor.map.repeat.set(2.6, 2.1);
  M.backsplash.map.repeat.set(3, 1);
  return M;
}

/** Terapkan warna kabinet pilihan pengguna. */
export function applyCabinetColor(M, id) {
  const c = CABINET_COLORS.find((k) => k.id === id) || CABINET_COLORS[0];
  M.wood.color.set(c.color);
}

/** Terapkan material countertop pilihan pengguna. */
export function applyCountertop(M, id) {
  const c = COUNTERTOPS.find((k) => k.id === id) || COUNTERTOPS[0];
  const old = M.stone.map;
  M.stone.map = makeStoneTexture(c.kind);
  M.stone.needsUpdate = true;
  if (old) old.dispose();
}
