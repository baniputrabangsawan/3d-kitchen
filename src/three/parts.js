import * as THREE from 'three';
import { geo } from './materials.js';

/**
 * Pabrik komponen kecil yang dipakai ulang di seluruh dapur:
 * panel, gagang, kenop, engsel, pintu ber-pivot, dan laci geser.
 * Semua memakai geometri & material bersama (hemat GPU).
 */

export function mesh(g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  return mesh(geo.box(w, h, d), mat, x, y, z);
}

export function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 20) {
  return mesh(geo.cyl(rt, rb, h, seg), mat, x, y, z);
}

/** Gagang bar horizontal (sumbu X), dudukan menonjol ke +Z (depan). */
export function hHandle(M, len = 0.16) {
  const g = new THREE.Group();
  const bar = cyl(0.009, 0.009, len, M.chrome, 0, 0, 0.035);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const s of [-1, 1]) {
    const st = cyl(0.006, 0.006, 0.035, M.chrome, (s * (len / 2 - 0.02)), 0, 0.018);
    st.rotation.x = Math.PI / 2;
    g.add(st);
  }
  return g;
}

/** Gagang bar vertikal (sumbu Y), dudukan menonjol ke +X (untuk pintu kulkas). */
export function vHandle(M, len = 0.5) {
  const g = new THREE.Group();
  g.add(cyl(0.011, 0.011, len, M.chrome, 0.045, 0, 0));
  for (const s of [-1, 1]) {
    const st = cyl(0.007, 0.007, 0.045, M.chrome, 0.022, s * (len / 2 - 0.03), 0);
    st.rotation.z = Math.PI / 2;
    g.add(st);
  }
  return g;
}

export function knob(M, r = 0.016) {
  const g = new THREE.Group();
  const k = cyl(r, r * 1.15, 0.03, M.chrome, 0, 0, 0.015);
  k.rotation.x = Math.PI / 2;
  g.add(k);
  return g;
}

/** Silinder engsel kecil. */
export function hinge(M, h = 0.07) {
  return cyl(0.008, 0.008, h, M.steelDark, 0, 0, 0, 10);
}

/**
 * Pintu dengan pivot tepat di garis engsel.
 * @param {number} w lebar pintu, {number} h tinggi, {number} t tebal
 * @param hinge 'left' | 'right' | 'bottom'
 * @returns { pivot: Group (posisikan di garis engsel), door: Mesh }
 */
export function hingedDoor(M, w, h, t, hingeSide, doorMat) {
  const pivot = new THREE.Group();
  let door;
  if (hingeSide === 'bottom') {
    door = box(w, h, t, doorMat, 0, h / 2, 0);
    pivot.add(door);
    for (const s of [-1, 1]) {
      const hg = hinge(M);
      hg.position.set(s * (w / 2 - 0.03), 0.02, 0);
      pivot.add(hg);
    }
  } else {
    const sx = hingeSide === 'left' ? 1 : -1;
    door = box(w, h, t, doorMat, (sx * w) / 2, 0, 0);
    pivot.add(door);
    for (const s of [-1, 1]) {
      const hg = hinge(M);
      hg.position.set(0, s * (h / 2 - 0.06), 0);
      pivot.add(hg);
    }
  }
  return { pivot, door };
}

/**
 * Laci tarik: panel depan + bak terbuka (alas + 3 sisi) agar isi terlihat.
 * Grup diposisikan saat tertutup; digeser +Z (atau sumbu lain) untuk dibuka.
 */
export function pullDrawer(M, w, h, d, frontMat) {
  const g = new THREE.Group();
  const t = 0.016;
  g.add(box(w, h, 0.02, frontMat, 0, 0, d / 2)); // panel depan
  const handle = hHandle(M, Math.min(0.2, w * 0.5));
  handle.position.set(0, h * 0.18, d / 2 + 0.01);
  g.add(handle);
  const bw = w - 0.06;
  const bd = d - 0.05;
  g.add(box(bw, 0.014, bd, M.woodInner, 0, -h / 2 + 0.05, -0.01)); // alas
  g.add(box(bw, 0.09, 0.012, M.woodInner, 0, -h / 2 + 0.1, -0.01 + bd / 2)); // belakang
  g.add(box(0.012, 0.09, bd, M.woodInner, -bw / 2, -h / 2 + 0.1, -0.01)); // kiri
  g.add(box(0.012, 0.09, bd, M.woodInner, bw / 2, -h / 2 + 0.1, -0.01)); // kanan
  g.add(box(bw, 0.05, 0.012, M.woodInner, 0, -h / 2 + 0.08, -0.01 - bd / 2 + 0.006)); // dalam-depan
  void t;
  return g;
}

/** Rak kawat oven: bingkai + jeruji tipis. */
export function wireRack(M, w, d) {
  const g = new THREE.Group();
  const r = 0.004;
  g.add(box(w, r * 2, r * 2, M.steelDark, 0, 0, d / 2));
  g.add(box(w, r * 2, r * 2, M.steelDark, 0, 0, -d / 2));
  g.add(box(r * 2, r * 2, d, M.steelDark, -w / 2, 0, 0));
  g.add(box(r * 2, r * 2, d, M.steelDark, w / 2, 0, 0));
  const n = Math.max(3, Math.floor(w / 0.045));
  for (let i = 1; i < n; i++) {
    g.add(box(r * 1.4, r * 1.4, d, M.steelDark, -w / 2 + (w * i) / n, 0, 0));
  }
  return g;
}

/** Rak kaca kulkas. */
export function glassShelf(M, w, d) {
  return box(w, 0.008, d, M.glassShelf, 0, 0, 0);
}

/** Baki/loyang datar. */
export function tray(M, w, d, h = 0.025) {
  const g = new THREE.Group();
  g.add(box(w, 0.008, d, M.tray, 0, 0, 0));
  g.add(box(w, h, 0.008, M.tray, 0, h / 2, d / 2));
  g.add(box(w, h, 0.008, M.tray, 0, h / 2, -d / 2));
  g.add(box(0.008, h, d, M.tray, -w / 2, h / 2, 0));
  g.add(box(0.008, h, d, M.tray, w / 2, h / 2, 0));
  return g;
}

/** Karton susu + apel + sayur untuk isi kulkas. */
export function fridgeGroceries(M) {
  const g = new THREE.Group();
  const milk = box(0.09, 0.2, 0.09, M.milk, -0.12, 0.1, 0);
  const cap = box(0.035, 0.03, 0.035, M.milkCap, -0.12, 0.215, 0);
  g.add(milk, cap);
  const apple = mesh(geo.sphere(0.038), M.apple, 0.05, 0.038, 0.02);
  const apple2 = mesh(geo.sphere(0.038), M.apple, 0.12, 0.038, -0.04);
  const greens = box(0.16, 0.09, 0.12, M.greens, 0.02, 0.045, 0.02);
  g.add(apple, apple2, greens);
  return g;
}

/** Display digital: bidang dengan tekstur canvas; daftarkan tex/mat ke disposables. */
export function controlDisplay(tex, w = 0.16, h = 0.08) {
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const o = new THREE.Mesh(geo.plane(w, h), mat);
  o.userData.tex = tex;
  o.userData.mat = mat;
  return o;
}
