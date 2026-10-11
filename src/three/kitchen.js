import * as THREE from 'three';
import { geo } from './materials.js';
import { mesh, box, cyl, hHandle, hingedDoor, pullDrawer } from './parts.js';

/**
 * createKitchen(M) — dapur modern bentuk L, skala 1 unit = 1 meter.
 * Denah (meter): x ∈ [-2.7, 2.7], z ∈ [-2.3, 2.3].
 * - Run utara (dinding belakang z=-2.3): kabinet bawah + counter + kabinet atas.
 * - Run barat (dinding x=-2.7): ceruk kulkas + kabinet bawah.
 * - Island di tengah + 2 stool + 2 lampu gantung.
 * Depan kabinet/laci menghadap +Z lokal.
 */

export const COUNTER_Y = 0.9;

function carcass(M, w, h, d, opts = {}) {
  const g = new THREE.Group();
  const t = 0.018;
  g.add(box(t, h, d, M.carcass, -w / 2 + t / 2, h / 2, 0));
  g.add(box(t, h, d, M.carcass, w / 2 - t / 2, h / 2, 0));
  if (!opts.openTop) {
    g.add(box(w - t * 2, t, d - 0.02, M.carcass, 0, h - t / 2, -0.01));
  }
  g.add(box(w - t * 2, t, d - 0.02, M.carcass, 0, t / 2, -0.01));
  const back = box(w - t * 2, h - t * 2, 0.012, M.carcass, 0, h / 2, -d / 2 + 0.008);
  back.castShadow = false;
  g.add(back);
  return g;
}

/**
 * Kabinet bawah reusable. Origin di lantai (tengah alas kabinet).
 * @param opts { doors:number, drawers:number(laci atas), openable:'doors'|'first-drawer'|... }
 */
export function createCabinet(M, w, opts = {}) {
  const { doors = 2, drawerTop = true, openTop = false } = opts;
  const g = new THREE.Group();
  const movers = [];
  const D = 0.58;
  const kickH = 0.1;
  const bodyH = 0.76;
  const front = D / 2;

  g.add(box(w - 0.06, kickH, D - 0.1, M.toeKick, 0, kickH / 2, -0.03));
  // openTop: kabinet bawah sink/kompor tanpa panel atas agar bak tanam muat.
  const c = carcass(M, w, bodyH, D, { openTop });
  c.position.y = kickH;
  g.add(c);

  const faceH = bodyH - 0.02;
  const faceY = kickH + bodyH / 2;
  const drawerH = drawerTop ? 0.16 : 0;
  const doorH = faceH - drawerH - (drawerTop ? 0.008 : 0);
  const doorY = kickH + doorH / 2 + 0.005;

  if (drawerTop) {
    const dr = pullDrawer(M, w - 0.02, drawerH, D - 0.1, M.wood);
    dr.position.set(0, kickH + bodyH - drawerH / 2 - 0.005, front - (D - 0.1) / 2 + 0.01);
    g.add(dr);
    movers.push({ object: dr, slide: 'z', closed: 0, open: 0.34, t: 0, target: 0, name: 'laci' });
  }
  const dw = (w - 0.01 * (doors + 1)) / doors;
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + 0.01 + dw / 2 + i * (dw + 0.01);
    const side = i % 2 === 0 ? 'left' : 'right';
    const { pivot } = hingedDoor(M, dw, doorH, 0.02, side, M.wood);
    const hingeX = side === 'left' ? x0 - dw / 2 : x0 + dw / 2;
    pivot.position.set(hingeX, doorY, front + 0.005);
    const hh = hHandle(M, Math.min(0.18, dw * 0.55));
    // Gagang di sisi jauh dari engsel agar tidak bertabrakan saat dibuka.
    hh.position.set(side === 'left' ? dw - 0.05 : -(dw - 0.05), doorH / 2 - 0.12, 0.025);
    pivot.add(hh);
    g.add(pivot);
    movers.push({ object: pivot, axis: 'y', closed: 0, open: side === 'left' ? -Math.PI * 0.58 : Math.PI * 0.58, t: 0, target: 0, name: `pintu ${i + 1}` });
  }
  g.userData.footprint = { w, d: D };
  return { group: g, movers };
}

/** Kabinet atas reusable. Origin di tengah-bawah kabinet. */
export function createWallCabinet(M, w, h = 0.72, d = 0.34, doors = 2) {
  const g = new THREE.Group();
  const movers = [];
  const c = carcass(M, w, h, d);
  g.add(c);
  // Interior: 1 rak tengah agar terlihat saat dibuka.
  const shelf = box(w - 0.05, 0.016, d - 0.05, M.interior, 0, h * 0.48, 0);
  shelf.castShadow = false;
  g.add(shelf);
  // Isi rak: gelas & mangkuk prosedural.
  for (let i = 0; i < 3; i++) {
    const cup = cyl(0.03, 0.024, 0.07, M.plasticLight, -w / 4 + i * 0.09, h * 0.48 + 0.045, 0, 12);
    cup.castShadow = false;
    g.add(cup);
  }
  const dw = (w - 0.01 * (doors + 1)) / doors;
  for (let i = 0; i < doors; i++) {
    const x0 = -w / 2 + 0.01 + dw / 2 + i * (dw + 0.01);
    const side = i % 2 === 0 ? 'left' : 'right';
    const { pivot } = hingedDoor(M, dw, h - 0.01, 0.02, side, M.wood);
    const hingeX = side === 'left' ? x0 - dw / 2 : x0 + dw / 2;
    pivot.position.set(hingeX, 0, d / 2 + 0.005);
    const hh = hHandle(M, Math.min(0.14, dw * 0.5));
    hh.position.set(side === 'left' ? dw - 0.045 : -(dw - 0.045), -h / 2 + 0.1, 0.025);
    pivot.add(hh);
    g.add(pivot);
    movers.push({ object: pivot, axis: 'y', closed: 0, open: side === 'left' ? -Math.PI * 0.55 : Math.PI * 0.55, t: 0, target: 0, name: `pintu atas ${i + 1}` });
  }
  return { group: g, movers };
}

function stool(M, x, z) {
  const g = new THREE.Group();
  g.add(cyl(0.17, 0.17, 0.05, M.stoolSeat, 0, 0.62, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = cyl(0.014, 0.014, 0.62, M.stoolLeg, sx * 0.12, 0.31, sz * 0.12, 10);
    leg.rotation.z = -sx * 0.1;
    leg.rotation.x = sz * 0.1;
    g.add(leg);
  }
  const ring = mesh(geo.torus(0.15, 0.008, Math.PI * 2), M.stoolLeg, 0, 0.2, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.position.set(x, 0, z);
  return g;
}

function pendant(M, x, z, withLight) {
  const g = new THREE.Group();
  g.add(cyl(0.008, 0.008, 0.55, M.applianceBlack, 0, 2.45, 0, 8));
  g.add(cyl(0.035, 0.17, 0.2, M.applianceBlack, 0, 2.12, 0));
  const bulb = mesh(geo.sphere(0.035), M.led, 0, 2.03, 0);
  bulb.castShadow = false;
  g.add(bulb);
  if (withLight) {
    const pt = new THREE.PointLight(0xffe6c0, 6, 4.5, 1.8);
    pt.position.set(0, 1.95, 0);
    g.add(pt);
  }
  g.position.set(x, 0, z);
  return g;
}

function plant(M, x, y, z) {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.055, 0.12, M.stoolSeat, 0, 0.06, 0, 14));
  for (let i = 0; i < 5; i++) {
    const leaf = mesh(geo.sphere(0.07), M.greens, 0, 0.2 + (i % 2) * 0.07, 0);
    leaf.scale.set(0.45, 1.15, 0.45);
    leaf.rotation.z = (i - 2) * 0.35;
    leaf.rotation.y = (i * 1.3);
    leaf.position.y = 0.2 + (i % 3) * 0.05;
    g.add(leaf);
  }
  g.position.set(x, y, z);
  return g;
}

export function createKitchen(M) {
  const g = new THREE.Group();
  const cabinetMovers = [];
  const colliders = [];
  const addCollider = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1 });
  const cabinets = [];
  const tagCab = (group, id, label, movers) => {
    group.userData.cabinetId = id;
    cabinets.push({ id, label, group, movers });
  };

  // ---- Lantai & dinding ----
  const floor = mesh(geo.plane(5.4, 4.6), M.floor, 0, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  g.add(floor);
  const wallN = box(5.4, 2.6, 0.12, M.wall, 0, 1.3, -2.36);
  wallN.castShadow = false;
  const wallW = box(0.12, 2.6, 4.6, M.wall, -2.76, 1.3, 0);
  wallW.castShadow = false;
  g.add(wallN, wallW);
  // Lis lantai.
  g.add(box(5.4, 0.08, 0.02, M.plasticLight, 0, 0.04, -2.295));
  g.add(box(0.02, 0.08, 4.6, M.plasticLight, -2.695, 0.04, 0));
  // Karpet runner.
  const rugTex = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b3402e'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#d9d2c4';
    for (let i = 0; i < 5; i++) ctx.fillRect(0, 14 + i * 24, 256, 5);
    ctx.fillStyle = '#8c2f20'; ctx.fillRect(0, 0, 256, 8); ctx.fillRect(0, 120, 256, 8);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const rug = new THREE.Mesh(geo.plane(2.4, 0.9), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.7, 0.006, -0.95); // runner di lorong depan area cuci/masak
  rug.receiveShadow = true;
  g.add(rug);

  // ---- Backsplash utara: dari counter (0,9) hingga kabinet atas (1,75) ----
  const bs = mesh(geo.plane(3.43, 0.85), M.backsplash, -0.3, 1.325, -2.293);
  bs.castShadow = false;
  const bsW = mesh(geo.plane(1.43, 0.5), M.backsplash, -2.693, 1.15, 0.15);
  bsW.rotation.y = Math.PI / 2;
  bsW.castShadow = false;
  g.add(bs, bsW);

  // ---- Run utara: kabinet bawah (sink & kompor openTop agar bak tanam muat) ----
  const segs = [
    { x0: -2.0, w: 0.7, doors: 1 },   // bawah microwave
    { x0: -1.3, w: 0.85, doors: 2, openTop: true },  // bawah sink
    { x0: -0.45, w: 0.6, doors: 1 },  // bank laci
    { x0: 0.15, w: 0.6, doors: 1, openTop: true },   // bawah kompor
  ];
  for (const [i, s] of segs.entries()) {
    const cab = createCabinet(M, s.w - 0.015, { doors: s.doors, drawerTop: true, openTop: !!s.openTop });
    cab.group.position.set(s.x0 + s.w / 2, 0, -2.01);
    g.add(cab.group);
    cabinetMovers.push(...cab.movers);
    tagCab(cab.group, `kab-bawah-${i}`, 'Kabinet bawah', cab.movers);
  }
  addCollider(-2.03, 0.78, -2.3, -1.66);

  // Countertop utara: segmen penuh + strip depan/belakang di lubang sink & kompor
  // (kompor & sink "ditanam" — tidak berpotongan dengan slab utuh).
  for (const [a, b] of [[-2.03, -1.305], [-0.445, 0.14]]) {
    g.add(box(b - a, 0.04, 0.64, M.stone, (a + b) / 2, 0.88, -1.98));
  }
  // Lubang sink x[-1.305,-0.445]: strip depan & belakang.
  g.add(box(0.86, 0.04, 0.07, M.stone, -0.875, 0.88, -1.695));
  g.add(box(0.86, 0.04, 0.07, M.stone, -0.875, 0.88, -2.265));
  // Lubang kompor x[0.14,0.74]: strip depan & belakang.
  g.add(box(0.6, 0.04, 0.06, M.stone, 0.44, 0.88, -1.69));
  g.add(box(0.6, 0.04, 0.06, M.stone, 0.44, 0.88, -2.27));

  // ---- Kabinet atas (clearance 49 cm dari counter agar keran muat) ----
  const wc1 = createWallCabinet(M, 1.55, 0.72, 0.34, 2);
  wc1.group.position.set(-1.225, 1.75, -2.13);
  g.add(wc1.group);
  cabinetMovers.push(...wc1.movers);
  tagCab(wc1.group, 'kab-atas-0', 'Kabinet atas', wc1.movers);
  const wc2 = createWallCabinet(M, 0.6, 0.72, 0.34, 2);
  wc2.group.position.set(-0.15, 1.75, -2.13);
  g.add(wc2.group);
  cabinetMovers.push(...wc2.movers);
  tagCab(wc2.group, 'kab-atas-1', 'Kabinet atas kecil', wc2.movers);
  // Strip LED bawah kabinet atas (mengikuti posisi kabinet yang dinaikkan).
  for (const [cx, cw] of [[-1.225, 1.5], [-0.15, 0.55]]) {
    const strip = box(cw, 0.012, 0.03, M.led, cx, 1.375, -2.0);
    strip.castShadow = false;
    g.add(strip);
  }

  // ---- Menara oven (kanan run utara) ----
  const tower = new THREE.Group();
  const TX = 1.075, TW = 0.65;
  tower.add(box(TW - 0.06, 0.1, 0.5, M.toeKick, 0, 0.05, -0.03));
  // Bawah: pintu.
  const tb = carcass(M, TW, 0.78, 0.6); tb.position.y = 0.1; tower.add(tb);
  {
    const doorW = TW - 0.03;
    const { pivot } = hingedDoor(M, doorW, 0.74, 0.02, 'right', M.wood);
    pivot.position.set(TW / 2 - 0.01, 0.1 + 0.39, 0.305);
    const hh = hHandle(M, 0.2); hh.position.set(-(doorW - 0.05), 0.2, 0.025); pivot.add(hh);
    tower.add(pivot);
    cabinetMovers.push({ object: pivot, axis: 'y', closed: 0, open: Math.PI * 0.55, t: 0, target: 0, name: 'pintu menara' });
  }
  // Ceruk oven: disesuaikan ke slot 62×62×60 agar frame oven (0,6×0,6) pas.
  // Menara: kedalaman 0,62; muka menara z=-1,69 cocok dengan muka frame oven.
  tower.add(box(0.015, 0.64, 0.6, M.carcass, -TW / 2 + 0.0075, 1.25, 0));
  tower.add(box(0.015, 0.64, 0.6, M.carcass, TW / 2 - 0.0075, 1.25, 0));
  tower.add(box(TW, 0.02, 0.6, M.carcass, 0, 0.92, 0));
  tower.add(box(TW, 0.02, 0.6, M.carcass, 0, 1.58, 0));
  // Atas: kabinet pintu.
  const tt = carcass(M, TW, 0.47, 0.6); tt.position.y = 1.61; tower.add(tt);
  {
    const doorW = TW - 0.03;
    const { pivot } = hingedDoor(M, doorW, 0.44, 0.02, 'left', M.wood);
    pivot.position.set(-TW / 2 + 0.01, 1.61 + 0.235, 0.305);
    const hh = hHandle(M, 0.2); hh.position.set(doorW - 0.08, 0, 0.025); pivot.add(hh);
    tower.add(pivot);
    cabinetMovers.push({ object: pivot, axis: 'y', closed: 0, open: -Math.PI * 0.55, t: 0, target: 0, name: 'pintu menara atas' });
  }
  tower.position.set(TX, 0, -2.0);
  g.add(tower);
  tagCab(tower, 'menara', 'Menara oven', cabinetMovers.slice(-2));
  addCollider(0.72, 1.43, -2.3, -1.68);

  // ---- Ceruk + kabinet run barat ----
  // Kulkas freestanding di sudut: panel atas rapat + panel samping penutup.
  g.add(box(0.9, 0.04, 0.74, M.wood, -2.42, 1.93, -1.15));
  g.add(box(0.72, 1.9, 0.04, M.wood, -2.42, 0.95, -0.74));
  const wcab = createCabinet(M, 1.36, { doors: 2, drawerTop: true });
  wcab.group.rotation.y = Math.PI / 2;
  wcab.group.position.set(-2.41, 0, 0.15);
  g.add(wcab.group);
  cabinetMovers.push(...wcab.movers);
  tagCab(wcab.group, 'kab-barat', 'Kabinet barat', wcab.movers);
  const ctW = box(0.64, 0.04, 1.46, M.stone, -2.38, 0.88, 0.15);
  g.add(ctW);
  addCollider(-2.79, -2.1, -1.58, -0.72);   // kulkas (+ panel samping)
  addCollider(-2.7, -2.06, -0.58, 0.88);   // run barat

  // ---- Island ----
  const island = new THREE.Group();
  island.add(box(1.44, 0.1, 0.74, M.toeKick, 0, 0.05, 0));
  const ic = carcass(M, 1.5, 0.76, 0.8); ic.position.y = 0.1; island.add(ic);
  for (const side of [1, -1]) {
    for (let i = 0; i < 2; i++) {
      const dw = 0.71;
      const x0 = -0.75 + 0.01 + dw / 2 + i * (dw + 0.01);
      const hs = i % 2 === 0 ? 'left' : 'right';
      const { pivot } = hingedDoor(M, dw, 0.7, 0.02, hs, M.wood);
      // Sisi belakang dilihat dari -Z: kiri/kanan engsel tercermin.
      const hingeLeft = side > 0 ? hs === 'left' : hs === 'right';
      pivot.position.set(hingeLeft ? x0 - dw / 2 : x0 + dw / 2, 0.1 + 0.38, side * 0.405);
      const flip = side < 0 ? Math.PI : 0;
      pivot.rotation.y = flip;
      const hh = hHandle(M, 0.18);
      // Gagang di sisi jauh dari engsel, selalu menonjol keluar (arah lokal +Z).
      hh.position.set(hs === 'left' ? dw - 0.05 : -(dw - 0.05), 0.2, 0.025);
      pivot.add(hh);
      island.add(pivot);
      const swing = (hs === 'left' ? -1 : 1) * Math.PI * 0.55;
      cabinetMovers.push({
        object: pivot, axis: 'y', closed: flip, open: flip + swing,
        t: 0, target: 0, name: `pintu island ${side > 0 ? 'depan' : 'belakang'} ${i + 1}`,
      });
    }
  }
  island.add(box(1.62, 0.04, 0.92, M.stone, 0, 0.88, 0));
  island.position.set(0.35, 0, 0.15);
  g.add(island);
  tagCab(island, 'island', 'Kabinet island', cabinetMovers.slice(-4));
  addCollider(-0.46, 1.16, -0.31, 0.61);
  g.add(stool(M, 0.0, 0.95), stool(M, 0.7, 0.95));
  g.add(plant(M, -0.25, 0.9, 0.15));

  // ---- Lampu gantung ----
  g.add(pendant(M, 0.0, 0.15, true), pendant(M, 0.7, 0.15, true));

  // ---- Jam dinding di dinding barat (area kosong) ----
  {
    const clockG = new THREE.Group();
    const face = cyl(0.14, 0.14, 0.03, M.plasticLight, 0, 0, 0, 28);
    face.rotation.z = Math.PI / 2;
    clockG.add(face);
    const rim = mesh(geo.torus(0.14, 0.012, Math.PI * 2), M.applianceBlack, 0.005, 0, 0);
    rim.rotation.y = Math.PI / 2;
    clockG.add(rim);
    const hourH = box(0.008, 0.07, 0.008, M.applianceBlack, 0.02, 0.02, 0);
    hourH.rotation.x = -0.6;
    const minH = box(0.006, 0.105, 0.006, M.accent, 0.02, 0.035, 0);
    minH.rotation.x = 0.9;
    clockG.add(hourH, minH);
    clockG.position.set(-2.685, 1.95, 1.25);
    g.add(clockG);
  }

  const slots = {
    // microwave ber-origin di tengah: lift menaikkan setengah tinggi varian.
    microwave: { position: new THREE.Vector3(-1.65, 0.9, -2.02), rotationY: 0, lift: 'halfHeight' },
    oven: { position: new THREE.Vector3(TX, 1.25, -1.99), rotationY: 0 },
    refrigerator: { position: new THREE.Vector3(-2.445, 0.95, -1.15), rotationY: Math.PI / 2 },
    cooktop: { position: new THREE.Vector3(0.44, 0.902, -1.98), rotationY: 0 },
    hood: { position: new THREE.Vector3(0.44, 1.66, -2.02), rotationY: 0 },
    sink: { position: new THREE.Vector3(-0.875, 0.902, -1.98), rotationY: 0 },
  };
  // Catat footprint slot peralatan untuk collision mode Explore.
  addCollider(-2.05, -1.25, -2.3, -1.7); // microwave di counter (sudah dalam run utara)

  return { group: g, cabinetMovers, cabinets, colliders, slots, rugTex };
}
