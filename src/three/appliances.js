import * as THREE from 'three';
import { geo, makeDisplayTexture } from './materials.js';
import {
  mesh, box, cyl, hHandle, vHandle, knob, hingedDoor,
  pullDrawer, wireRack, glassShelf, tray, fridgeGroceries,
  controlDisplay,
} from './parts.js';

/**
 * Pabrik peralatan dapur prosedural.
 * Setiap pabrik: createX(M, dims, opts) -> { group, movers, disposables, focus }
 * - `movers`: daftar { object, axis:'x'|'y'|'z', closed, open } untuk animasi.
 * - `disposables`: geometri/material sekali-pakai (tekstur canvas) utk dibersihkan.
 * - `focus`: { pos, target } titik kamera "Lihat bagian dalam".
 * Skala: 1 unit = 1 meter. Depan peralatan menghadap +Z lokal.
 */

export function tagProduct(group, productId) {
  group.traverse((o) => { o.userData.productId = productId; });
  group.userData.productId = productId;
}

// ---------------------------------------------------------------------------
// MICROWAVE — pintu ke samping (pivot kiri).
// ---------------------------------------------------------------------------
export function createMicrowave(M, dims, opts = {}) {
  const { w, h, d } = dims;
  const g = new THREE.Group();
  const disposables = [];
  const movers = [];

  const bodyMat = opts.premium ? M.steelDark : M.applianceBlack;
  const wall = 0.025;

  // Karkas: kiri, kanan, atas, bawah, belakang.
  g.add(box(wall, h, d, bodyMat, -w / 2 + wall / 2, 0, 0));
  g.add(box(wall, h, d, bodyMat, w / 2 - wall / 2, 0, 0));
  g.add(box(w, wall, d, bodyMat, 0, h / 2 - wall / 2, 0));
  g.add(box(w, wall, d, bodyMat, 0, -h / 2 + wall / 2, 0));
  g.add(box(w, h, 0.02, bodyMat, 0, 0, -d / 2 + 0.01));

  // Rongga interior terang + lampu.
  const iw = w - wall * 2;
  const ih = h - wall * 2;
  const cavity = box(iw, ih, 0.01, M.interior, 0, 0, -d / 2 + 0.025);
  cavity.castShadow = false;
  g.add(cavity);
  const lamp = box(0.05, 0.02, 0.02, M.led, iw / 2 - 0.06, ih / 2 - 0.03, -d / 2 + 0.05);
  lamp.castShadow = false;
  g.add(lamp);

  // Meja putar kaca + pemutar makanan (ayam prosedural sederhana).
  const plate = cyl(iw / 2 - 0.05, iw / 2 - 0.05, 0.012, M.glassShelf, 0, -ih / 2 + 0.035, -0.02);
  plate.castShadow = false;
  g.add(plate);
  const food = new THREE.Group();
  const chicken = mesh(geo.sphere(0.05), M.stoolSeat, 0, 0.045, 0);
  chicken.scale.set(1.2, 0.8, 1);
  food.add(chicken);
  food.position.set(0, -ih / 2 + 0.042, -0.02);
  g.add(food);

  // Panel kontrol kanan.
  const panelW = Math.min(0.12, w * 0.24);
  const panel = box(panelW, ih * 0.92, 0.012, M.plastic, w / 2 - wall - panelW / 2, 0, d / 2 - 0.005);
  g.add(panel);
  const dispTex = makeDisplayTexture('12:30', '900W');
  disposables.push(dispTex);
  const disp = controlDisplay(dispTex, panelW * 0.82, 0.055);
  disp.position.set(w / 2 - wall - panelW / 2, ih * 0.28, d / 2 + 0.002);
  disposables.push(disp.material);
  g.add(disp);
  for (let i = 0; i < 3; i++) {
    const b = cyl(0.011, 0.011, 0.012, M.plasticLight, w / 2 - wall - panelW / 2 + (i - 1) * 0.032, -ih * 0.08, d / 2 + 0.002, 12);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  const k = knob(M, 0.018);
  k.position.set(w / 2 - wall - panelW / 2, -ih * 0.28, d / 2 + 0.002);
  g.add(k);

  // Pintu: pivot di tepi kiri, kaca gelap + bingkai.
  const doorW = w - wall * 2 - panelW;
  const { pivot } = hingedDoor(M, doorW, h - 0.008, 0.024, 'left', bodyMat);
  pivot.position.set(-w / 2 + wall, 0, d / 2);
  const win = box(doorW - 0.09, h - 0.11, 0.006, M.blackGlass, doorW / 2, 0, 0.008);
  win.castShadow = false;
  pivot.add(win);
  const dh = hHandle(M, Math.min(0.14, h * 0.5));
  dh.rotation.z = Math.PI / 2;
  dh.position.set(doorW - 0.045, 0, 0.03);
  pivot.add(dh);
  g.add(pivot);
  movers.push({ object: pivot, axis: 'y', closed: 0, open: -Math.PI * 0.62, name: 'pintu' });

  // Kaki kecil.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.03, 0.02, 0.03, M.plastic, sx * (w / 2 - 0.05), -h / 2 - 0.01, sz * (d / 2 - 0.05)));
  }

  const focus = { pos: new THREE.Vector3(0, 0.05, d / 2 + 0.75), target: new THREE.Vector3(0, -0.02, -0.05) };
  g.userData.footprint = { w, d };
  return { group: g, movers, disposables, focus };
}

// ---------------------------------------------------------------------------
// OVEN — pintu lipat ke bawah (pivot bawah).
// ---------------------------------------------------------------------------
export function createOven(M, dims, opts = {}) {
  const { w, h, d } = dims;
  const g = new THREE.Group();
  const disposables = [];
  const movers = [];
  const wall = 0.03;
  const premium = opts.premium;

  const bodyMat = premium ? M.applianceBlack : M.steel;

  g.add(box(wall, h, d, bodyMat, -w / 2 + wall / 2, 0, 0));
  g.add(box(wall, h, d, bodyMat, w / 2 - wall / 2, 0, 0));
  g.add(box(w, wall, d, bodyMat, 0, h / 2 - wall / 2, 0));
  g.add(box(w, wall, d, bodyMat, 0, -h / 2 + wall / 2, 0));
  g.add(box(w, h, 0.02, bodyMat, 0, 0, -d / 2 + 0.01));

  const iw = w - wall * 2;
  const ih = h - 0.16 - wall; // ruang bawah panel kontrol
  const cy = -0.05;
  const cavity = box(iw, ih, 0.012, M.cavityDark, 0, cy, -d / 2 + 0.03);
  cavity.castShadow = false;
  g.add(cavity);

  // Elemen pemanas atas + lampu samping.
  const coil = mesh(geo.torus(0.09, 0.009, Math.PI * 2), M.steelDark, 0, cy + ih / 2 - 0.05, -0.1);
  coil.rotation.x = Math.PI / 2;
  g.add(coil);
  const lamp = box(0.04, 0.06, 0.015, M.led, -iw / 2 + 0.035, cy + 0.1, -d / 2 + 0.06);
  lamp.castShadow = false;
  g.add(lamp);

  // Rak kawat + loyang + ayam panggang.
  const rack = wireRack(M, iw - 0.06, d - 0.18);
  rack.position.set(0, cy - 0.06, -0.03);
  g.add(rack);
  const rack2 = wireRack(M, iw - 0.06, d - 0.18);
  rack2.position.set(0, cy + 0.08, -0.03);
  g.add(rack2);
  const t = tray(M, iw - 0.12, 0.3);
  t.position.set(0, cy - 0.048, -0.03);
  g.add(t);
  const roast = mesh(geo.sphere(0.06), M.stoolSeat, 0, cy - 0.005, -0.03);
  roast.scale.set(1.35, 0.75, 1);
  g.add(roast);
  for (let i = 0; i < 4; i++) {
    const leg = mesh(geo.sphere(0.012), M.stoolSeat, -0.05 + i * 0.033, cy + 0.035, -0.03);
    g.add(leg);
  }

  // Strip panel kontrol atas.
  const stripY = h / 2 - 0.06;
  g.add(box(w, 0.12, 0.03, premium ? M.blackGlass : bodyMat, 0, stripY, d / 2 - 0.005));
  const dispTex = makeDisplayTexture(premium ? '180°C' : '200°C', premium ? 'PYRO' : 'ATAS-BAWAH');
  disposables.push(dispTex);
  const disp = controlDisplay(dispTex, 0.15, 0.06);
  disp.position.set(0, stripY, d / 2 + 0.012);
  disposables.push(disp.material);
  g.add(disp);
  const nKnobs = premium ? 2 : 3;
  for (let i = 0; i < nKnobs; i++) {
    const k = knob(M, 0.017);
    k.position.set((i - (nKnobs - 1) / 2) * (premium ? 0.24 : 0.15) + (premium ? 0 : 0), stripY - (premium ? 0 : 0.0), d / 2 + 0.012);
    if (!premium && i === 1) k.position.x = 0.0;
    g.add(k);
  }

  // Pintu lipat bawah: pivot di garis BAWAH pintu (tepi bawah area kaca).
  const doorH = h - 0.12 - 0.01;
  const { pivot } = hingedDoor(M, w - 0.006, doorH, 0.045, 'bottom', bodyMat);
  pivot.position.set(0, h / 2 - 0.12 - doorH, d / 2 - 0.01);
  const win = box(w - 0.14, doorH - 0.16, 0.01, M.blackGlass, 0, doorH / 2, 0.02);
  win.castShadow = false;
  pivot.add(win);
  const inner = box(w - 0.1, doorH - 0.08, 0.008, M.steelDark, 0, doorH / 2, -0.02);
  inner.castShadow = false;
  pivot.add(inner);
  const handle = hHandle(M, w * 0.7);
  handle.position.set(0, doorH - 0.05, 0.035);
  pivot.add(handle);
  g.add(pivot);
  // Buka = putar +90° ke depan-bawah tanpa menembus lantai (pintu menara eye-level).
  movers.push({ object: pivot, axis: 'x', closed: 0, open: Math.PI * 0.52, name: 'pintu' });

  const focus = { pos: new THREE.Vector3(0, 0.1, d / 2 + 0.85), target: new THREE.Vector3(0, -0.05, -0.1) };
  g.userData.footprint = { w, d };
  return { group: g, movers, disposables, focus };
}

// ---------------------------------------------------------------------------
// KULKAS — dua pintu samping (pivot kiri & kanan) + interior.
// ---------------------------------------------------------------------------
export function createRefrigerator(M, dims) {
  const { w, h, d } = dims;
  const g = new THREE.Group();
  const disposables = [];
  const movers = [];
  const wall = 0.04;

  // Bodi.
  g.add(box(w, h, d, M.applianceWhite, 0, 0, 0));
  // Rongga interior.
  const iw = w - wall * 2;
  const ih = h - 0.1;
  const cavity = box(iw, ih, 0.012, M.interior, 0, 0.02, -d / 2 + 0.045);
  cavity.castShadow = false;
  g.add(cavity);
  // Sekat tengah.
  g.add(box(0.03, ih, d - 0.12, M.applianceWhite, 0, 0.02, -0.02));

  // Rak kaca kiri + kanan, laci sayur bawah, rak pintu.
  for (const side of [-1, 1]) {
    const cx = side * (iw / 4);
    for (let i = 0; i < 3; i++) {
      const shelf = glassShelf(M, iw / 2 - 0.05, d - 0.2);
      shelf.position.set(cx, 0.42 - i * 0.26, -0.03);
      shelf.castShadow = false;
      g.add(shelf);
    }
    const drawer = box(iw / 2 - 0.06, 0.16, d - 0.22, M.plasticLight, cx, -0.62, -0.03);
    drawer.castShadow = false;
    g.add(drawer);
  }
  const groceries = fridgeGroceries(M);
  groceries.position.set(-iw / 4, 0.42, -0.03);
  g.add(groceries);
  const groceries2 = fridgeGroceries(M);
  groceries2.position.set(iw / 4, 0.16, -0.02);
  groceries2.rotation.y = Math.PI;
  g.add(groceries2);

  // Dua pintu.
  const doorT = 0.05;
  const dw = w / 2 - 0.004;
  const dh = h - 0.06;
  const left = hingedDoor(M, dw, dh, doorT, 'left', M.steel);
  left.pivot.position.set(-w / 2, 0.02, d / 2);
  const lh = vHandle(M, 0.55);
  lh.position.set(dw - 0.06, 0.1, doorT / 2 + 0.01);
  left.pivot.add(lh);
  // Rak dalam pintu kiri.
  for (let i = 0; i < 2; i++) {
    left.pivot.add(box(dw - 0.1, 0.05, 0.09, M.plasticLight, dw / 2, 0.25 - i * 0.35, -0.06));
  }
  g.add(left.pivot);
  movers.push({ object: left.pivot, axis: 'y', closed: 0, open: -Math.PI * 0.6, name: 'pintu kiri' });

  // Display menempel di pintu kiri (ikut terbuka).
  const dispTex = makeDisplayTexture('-18°', '3°');
  disposables.push(dispTex);
  const disp = controlDisplay(dispTex, 0.1, 0.13);
  disp.rotation.y = 0;
  disp.position.set(dw / 2, 0.62, doorT / 2 + 0.002);
  disposables.push(disp.material);
  left.pivot.add(disp);

  const right = hingedDoor(M, dw, dh, doorT, 'right', M.steel);
  right.pivot.position.set(w / 2, 0.02, d / 2);
  const rh = vHandle(M, 0.55);
  rh.position.set(-dw + 0.06, 0.1, doorT / 2 + 0.01);
  right.pivot.add(rh);
  g.add(right.pivot);
  movers.push({ object: right.pivot, axis: 'y', closed: 0, open: Math.PI * 0.6, name: 'pintu kanan' });

  // Kaki.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.05, 0.06, 0.05, M.toeKick, sx * (w / 2 - 0.06), -h / 2 + 0.03, sz * (d / 2 - 0.06)));
  }

  const focus = {
    pos: new THREE.Vector3(0.1, 0.1, d / 2 + 1.15),
    target: new THREE.Vector3(0, 0, -0.1),
  };
  g.userData.footprint = { w, d };
  return { group: g, movers, disposables, focus };
}

// ---------------------------------------------------------------------------
// KOMPOR — kaca + 4 zona + kenop + dudukan.
// ---------------------------------------------------------------------------
export function createCooktop(M, dims) {
  const { w, h, d } = dims;
  const g = new THREE.Group();
  const top = box(w, 0.012, d, M.cooktopGlass, 0, 0, 0);
  top.receiveShadow = true;
  g.add(top);
  g.add(box(w - 0.02, h * 0.7, d - 0.02, M.applianceBlack, 0, -h / 2, 0));
  // Dudukan besi untuk panci tampak nyata.
  const spots = [
    [-w * 0.24, -d * 0.2], [w * 0.24, -d * 0.2],
    [-w * 0.24, d * 0.24], [w * 0.24, d * 0.24],
  ];
  for (const [x, z] of spots) {
    const ring = mesh(geo.torus(0.075, 0.011, Math.PI * 2), M.grate, x, 0.012, z);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    for (let a = 0; a < 4; a++) {
      const spoke = box(0.15, 0.006, 0.016, M.grate, x, 0.012, z);
      spoke.rotation.y = (a * Math.PI) / 4;
      g.add(spoke);
    }
  }
  // Panci di satu tungku.
  const pot = cyl(0.09, 0.085, 0.11, M.steelDark, -w * 0.24, 0.07, -d * 0.2);
  const lid = cyl(0.095, 0.095, 0.015, M.steel, -w * 0.24, 0.132, -d * 0.2);
  const lidKnob = mesh(geo.sphere(0.014), M.plastic, -w * 0.24, 0.148, -d * 0.2);
  g.add(pot, lid, lidKnob);
  // Strip kenop depan.
  g.add(box(w * 0.9, 0.045, 0.02, M.applianceBlack, 0, -0.01, d / 2 + 0.005));
  for (let i = 0; i < 4; i++) {
    const k = knob(M, 0.014);
    k.position.set((i - 1.5) * 0.11, -0.01, d / 2 + 0.012);
    g.add(k);
  }
  const focus = { pos: new THREE.Vector3(0, 0.65, d / 2 + 0.75), target: new THREE.Vector3(0, 0, 0) };
  g.userData.footprint = { w, d };
  return { group: g, movers: [], disposables: [], focus };
}

// ---------------------------------------------------------------------------
// COOKER HOOD — cerobong + kanopi + filter + lampu.
// ---------------------------------------------------------------------------
export function createHood(M, dims) {
  const { w, h, d } = dims;
  const g = new THREE.Group();
  const canopyH = 0.16;
  const chimW = 0.28;
  const chimH = h - canopyH;
  g.add(box(chimW, chimH, 0.26, M.steel, 0, canopyH + chimH / 2, -0.06));
  // Kanopi trapesium (pakai 2 boks miring agar prosedural sederhana).
  const canopy = box(w, 0.05, d, M.steel, 0, canopyH / 2 + 0.02, 0);
  g.add(canopy);
  const skirt = box(w * 0.82, 0.12, d * 0.8, M.steel, 0, 0.1, 0);
  g.add(skirt);
  // Panel kaca depan miring.
  const glass = box(w * 0.8, 0.02, 0.3, M.blackGlass, 0, 0.14, d * 0.1);
  glass.rotation.x = -0.28;
  g.add(glass);
  // Filter aluminium + lampu.
  g.add(box(w * 0.6, 0.015, d * 0.5, M.steelDark, 0, 0.035, -0.02));
  for (const sx of [-1, 1]) {
    const lamp = box(0.12, 0.012, 0.05, M.led, sx * 0.14, 0.028, 0.1);
    lamp.castShadow = false;
    g.add(lamp);
  }
  // Tombol.
  for (let i = 0; i < 3; i++) {
    const b = cyl(0.009, 0.009, 0.01, M.plastic, -0.05 + i * 0.05, 0.06, d * 0.32, 10);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  const focus = { pos: new THREE.Vector3(0.4, -0.35, d / 2 + 0.8), target: new THREE.Vector3(0, 0, 0) };
  g.userData.footprint = { w, d };
  return { group: g, movers: [], disposables: [], focus };
}

// ---------------------------------------------------------------------------
// SINK + KERAN — bak granit + keran angsa prosedural.
// ---------------------------------------------------------------------------
export function createSink(M, dims) {
  const { w, h, d } = dims;
  const g = new THREE.Group();
  const wall = 0.02;
  // Bak.
  g.add(box(w, wall, d, M.plasticLight, 0, 0, 0));
  g.add(box(w, h, wall, M.plasticLight, 0, -h / 2, -d / 2 + wall / 2));
  g.add(box(w, h, wall, M.plasticLight, 0, -h / 2, d / 2 - wall / 2));
  g.add(box(wall, h, d, M.plasticLight, -w / 2 + wall / 2, -h / 2, 0));
  g.add(box(wall, h, d, M.plasticLight, w / 2 - wall / 2, -h / 2, 0));
  // Bibir atas.
  g.add(box(w + 0.02, 0.015, 0.03, M.steel, 0, 0.008, -d / 2));
  g.add(box(w + 0.02, 0.015, 0.03, M.steel, 0, 0.008, d / 2));
  // Saringan.
  const drain = cyl(0.045, 0.045, 0.008, M.chrome, 0, 0.005, 0);
  g.add(drain);
  // Keran angsa: alas + tiang + leher lengkung (torus) + moncong + tuas.
  const fx = w / 2 - 0.12;
  const fz = -d / 2 + 0.06;
  g.add(cyl(0.035, 0.04, 0.02, M.chrome, fx, 0.02, fz));
  g.add(cyl(0.02, 0.02, 0.24, M.chrome, fx, 0.14, fz));
  const neck = mesh(geo.torus(0.09, 0.016, Math.PI), M.chrome, fx, 0.26, fz + 0.09);
  neck.rotation.y = Math.PI / 2;
  g.add(neck);
  g.add(cyl(0.016, 0.016, 0.05, M.chrome, fx, 0.245, fz + 0.18));
  const lever = box(0.09, 0.014, 0.02, M.chrome, fx + 0.05, 0.2, fz);
  lever.rotation.y = 0.3;
  g.add(lever);
  const focus = { pos: new THREE.Vector3(0.15, 0.5, d / 2 + 0.7), target: new THREE.Vector3(0, 0, 0) };
  g.userData.footprint = { w, d };
  return { group: g, movers: [], disposables: [], focus };
}
