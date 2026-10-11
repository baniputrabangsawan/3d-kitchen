/**
 * DapurKu 3D — showroom dapur interaktif (Vite + Three.js).
 * Seluruh geometri prosedural; merek & angka = DATA DEMONSTRASI fiktif.
 */
import * as THREE from 'three';
import { createSharedMaterials, applyCabinetColor, applyCountertop, CABINET_COLORS, COUNTERTOPS } from './three/materials.js';
import { createKitchen, COUNTER_Y } from './three/kitchen.js';
import { createLights, applyLightQuality } from './three/lighting.js';
import { createCameraRig, PRESETS } from './three/cameraRig.js';
import { createAnimator } from './three/animator.js';
import { createPicker, createHotspots, createHighlighter } from './three/interaction.js';
import { tagProduct, createMicrowave, createOven, createRefrigerator, createCooktop, createHood, createSink } from './three/appliances.js';
import { PRODUCTS, BRAND, DEMO_NOTE, CATEGORIES, categoryLabel, formatIDR, dimsLabel, getProduct, getVariant, checkFit } from './data/catalog.js';
import { loadState, saveState, saveNow, resetState } from './data/storage.js';

const BUILDERS = {
  microwave: (M, v) => createMicrowave(M, v.dims, { premium: v.id === 'mw-r32' }),
  oven: (M, v) => createOven(M, v.dims, { premium: v.id === 'ov-t60p' }),
  refrigerator: (M, v) => createRefrigerator(M, v.dims),
  cooktop: (M, v) => createCooktop(M, v.dims),
  hood: (M, v) => createHood(M, v.dims),
  sink: (M, v) => createSink(M, v.dims),
};

const VFALLBACK = document.getElementById('gl-fallback');

let renderer = null;
let glOK = true;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  glOK = false;
  console.error('WebGL tidak tersedia:', err);
}

// ---------------------------------------------------------------------------
// State + elemen UI
// ---------------------------------------------------------------------------
const state = loadState();
const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const canvasWrap = $('canvas-wrap');
const hotspotLayer = $('hotspots');
const toast = $('toast');

let scene, camera, rig, lights, animator, picker, hotspots, highlighter;
let M;
let kitchen;
let kitchenBox = null;
let productNodes = new Map(); // productId -> { group, movers, disposables, focus, slot, anchor }
let pickables = [];
let selectedId = null;
let exploreMode = false;
let quality = state.quality || (isMobile() ? 'medium' : 'high');
const clock = new THREE.Clock();

const MOBILE_Q = '(max-width: 767px)';
function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia(MOBILE_Q).matches;
}

function showToast(msg, ms = 3200) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), ms);
}

// ---------------------------------------------------------------------------
// Inisialisasi 3D
// ---------------------------------------------------------------------------
function initGL() {
  renderer.setPixelRatio(mobilePixelCap(Math.min(window.devicePixelRatio || 1, 2)));
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvasWrap.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e4db');

  M = createSharedMaterials();
  applyCabinetColor(M, state.cabinet);
  applyCountertop(M, state.countertop);

  lights = createLights();
  scene.add(lights.group);

  kitchen = createKitchen(M);
  scene.add(kitchen.group);
  kitchenBox = new THREE.Box3().setFromObject(kitchen.group);

  animator = createAnimator();
  for (const m of kitchen.cabinetMovers) animator.register(m);

  rig = createCameraRig(renderer.domElement);
  camera = rig.camera;

  highlighter = createHighlighter();
  hotspots = createHotspots(hotspotLayer, camera, scene);
  hotspotLayer.addEventListener('hotspot', (e) => selectProduct(e.detail, true));

  picker = createPicker(camera, renderer.domElement, () => pickables);
  picker.onTap((hit) => {
    if (exploreMode) return;
    selectProduct(hit ? hit.productId : null, !!hit);
  });

  buildAllProducts();
  applyLightQuality(lights, renderer, quality);
  applyQualityPixelRatio();

  observeViewportResize();
  window.addEventListener('resize', resize);
  resize();
  // Kamera awal: di mobile bingkai seluruh dapur dari bounding box.
  if (isMobile() && kitchenBox) {
    rig.frameBounds(kitchenBox, { dur: 0.01 });
  }
}

function mobilePixelCap(dpr) {
  return isMobile() ? Math.min(dpr, 1.5) : dpr;
}

function disposeProduct(id) {
  const n = productNodes.get(id);
  if (!n) return;
  for (const m of n.movers) animator.unregister(m);
  scene.remove(n.group);
  n.group.traverse((o) => {
    if (o.isMesh && o.geometry && !isSharedGeo(o.geometry)) o.geometry.dispose();
  });
  for (const d of n.disposables) {
    if (d && d.isTexture) d.dispose();
    else if (d && d.isMaterial) d.dispose();
  }
  hotspots.remove(id);
  productNodes.delete(id);
}

function isSharedGeo() { return true; } // semua geometri berasal dari cache bersama

function buildProduct(productId) {
  const product = getProduct(productId);
  const variant = getVariant(product, state.variants[productId]);
  disposeProduct(productId);

  const built = BUILDERS[productId](M, variant);
  const slot = kitchen.slots[productId];
  built.group.position.copy(slot.position);
  // Microwave ber-origin tengah: dudukkan alasnya di permukaan counter.
  if (slot.lift === 'halfHeight') built.group.position.y += variant.dims.h / 2;
  built.group.rotation.y = slot.rotationY;
  tagProduct(built.group, productId);
  scene.add(built.group);
  for (const m of built.movers) animator.register(m);

  const open = !!state.openDoors[productId];
  for (const m of built.movers) { m.target = open ? 1 : 0; m.t = 0; }

  const worldAnchor = new THREE.Object3D();
  const anchorLocal = anchorFor(productId);
  worldAnchor.position.copy(anchorLocal);
  built.group.add(worldAnchor);

  const focusWorld = {
    pos: built.focus.pos.clone().applyMatrix4(rotY(slot.rotationY)).add(slot.position),
    target: built.focus.target.clone().applyMatrix4(rotY(slot.rotationY)).add(slot.position),
  };

  const node = { group: built.group, movers: built.movers, disposables: built.disposables, focus: focusWorld, anchor: worldAnchor, slot };
  productNodes.set(productId, node);
  pickables = [...productNodes.values()].map((n) => n.group);

  hotspots.add(productId, shortName(product), () => {
    const p = new THREE.Vector3();
    node.anchor.getWorldPosition(p);
    return p;
  });
}

function rotY(a) {
  return new THREE.Matrix4().makeRotationY(a);
}

function anchorFor(productId) {
  switch (productId) {
    case 'microwave': return new THREE.Vector3(-0.12, 0.3, 0.18);
    case 'oven': return new THREE.Vector3(0.18, 0.3, 0.3);
    case 'refrigerator': return new THREE.Vector3(0.2, 0.75, 0.35);
    case 'cooktop': return new THREE.Vector3(-0.2, 0.28, 0.25);
    case 'hood': return new THREE.Vector3(0.22, 0.32, 0.28);
    case 'sink': return new THREE.Vector3(0.22, 0.42, 0.25);
    default: return new THREE.Vector3(0, 0.3, 0.3);
  }
}

function shortName(p) {
  return { microwave: 'Microwave', oven: 'Oven', refrigerator: 'Kulkas', cooktop: 'Kompor', hood: 'Hood', sink: 'Sink' }[p.id] || p.name;
}

function buildAllProducts() {
  for (const p of PRODUCTS) buildProduct(p.id);
}

function applyQualityPixelRatio() {
  if (!renderer) return;
  const dpr = window.devicePixelRatio || 1;
  const cap = isMobile() ? 1.5 : 2;
  renderer.setPixelRatio(quality === 'low' ? Math.min(dpr, 1) : quality === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, cap));
}

// ---------------------------------------------------------------------------
// Seleksi + panel spesifikasi
// ---------------------------------------------------------------------------
const panel = $('spec-panel');
let currentFilter = 'all';

function selectProduct(id, fly) {
  selectedId = id;
  hotspots.setActive(id);
  if (id && glOK) {
    const n = productNodes.get(id);
    if (n) {
      highlighter.highlight(n.group);
      if (fly) rig.focusObject(n.focus.pos, n.focus.target);
    }
  } else {
    highlighter.highlight(null);
  }
  renderSpec();
  renderProductList(currentFilter);
  $('btn-interior').disabled = !id;
}

function openSheet() {
  // Di mobile, seleksi produk membuka sheet Detail; di desktop panel samping statis.
  if (!isMobile() || !selectedId) return;
  openMobileSheet('detail');
}

function closeSheet() {
  closeMobileSheet();
}

function variantOf(productId) {
  const p = getProduct(productId);
  return getVariant(p, state.variants[productId]);
}

// ---------------------------------------------------------------------------
// Bottom sheet mobile: satu state aktif (products | design | detail | settings)
// ---------------------------------------------------------------------------
let activeSheet = null; // null bila tertutup
let sheetTrigger = null;

function sheetEls() {
  return { sheet: $('mobile-sheet'), scrim: $('modal-scrim'), content: $('mobile-sheet-content'), title: $('sheet-title') };
}

const SHEET_TITLES = { products: 'Produk', design: 'Desain Dapur', detail: 'Detail Produk', settings: 'Pengaturan' };

function openMobileSheet(name, trigger = null) {
  if (!isMobile()) return;
  const { sheet, scrim, content, title } = sheetEls();
  if (activeSheet === name && sheet.classList.contains('open')) return;
  restoreSpecNodes();
  activeSheet = name;
  sheetTrigger = trigger || document.activeElement;
  title.textContent = SHEET_TITLES[name] || name;
  renderSheetContent(name);
  sheet.classList.remove('closing');
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  scrim.classList.add('on');
  scrim.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open', 'sheet-open');
  document.querySelectorAll('.mobile-stage-actions .stage-action').forEach((b) => {
    b.classList.toggle('active', b.dataset.sheet === name);
  });
  // Fokus ke sheet agar keyboard trap sederhana + screen reader sadar.
  window.requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
}

function closeMobileSheet(returnFocus = true) {
  const { sheet, scrim } = sheetEls();
  if (!activeSheet && !sheet.classList.contains('open')) return;
  restoreSpecNodes();
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  activeSheet = null;
  document.querySelectorAll('.mobile-stage-actions .stage-action').forEach((b) => b.classList.remove('active'));
  const done = () => {
    sheet.classList.remove('open', 'closing');
    sheet.setAttribute('aria-hidden', 'true');
    if (!$('quote-drawer').classList.contains('open')) {
      scrim.classList.remove('on');
      scrim.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }
    document.body.classList.remove('sheet-open');
    if (returnFocus && sheetTrigger && document.contains(sheetTrigger)) sheetTrigger.focus({ preventScroll: true });
    sheetTrigger = null;
  };
  if (reduce) { done(); return; }
  sheet.classList.add('closing');
  window.setTimeout(done, 300);
}

function renderSheetContent(name) {
  const { content } = sheetEls();
  content.innerHTML = '';
  if (name === 'products') {
    const h = document.createElement('p');
    h.className = 'muted';
    h.textContent = 'Pilih peralatan untuk melihat detail. Pilihan aktif tetap tersimpan walau filter kategori berubah.';
    const ul = document.createElement('ul');
    ul.className = 'product-list';
    content.append(h, ul);
    renderProductList(currentFilter, ul);
  } else if (name === 'design') {
    const wrap = document.createElement('div');
    wrap.innerHTML = designControlsHTML();
    content.appendChild(wrap);
    renderDesignControls();
  } else if (name === 'detail') {
    const clone = document.createElement('div');
    clone.className = 'sheet-spec';
    // Pindahkan isi spec-body (satu sumber kebenaran) ke sheet selama terbuka.
    clone.append(...$('spec-body').childNodes);
    content.appendChild(clone);
    content.dataset.holdsSpec = '1';
  } else if (name === 'settings') {
    content.appendChild(buildSettingsPanel());
  }
}

/** Kembalikan node spec-body ke panel desktop saat sheet detail ditutup. */
function restoreSpecNodes() {
  const { content } = sheetEls();
  if (content.dataset.holdsSpec) {
    const holder = content.querySelector('.sheet-spec');
    if (holder) $('spec-body').append(...holder.childNodes);
    delete content.dataset.holdsSpec;
  }
}

function buildSettingsPanel() {
  const wrap = document.createElement('div');
  wrap.className = 'settings-panel';
  const mkBtn = (id, label, value) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = 'variant';
    b.innerHTML = `<strong>${label}</strong><br><small>${value}</small>`;
    return b;
  };
  const q = mkBtn('m-quality', 'Kualitas render', qualityLabel());
  q.addEventListener('click', () => {
    quality = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high';
    state.quality = quality;
    saveState(state);
    syncQualityButtons();
    if (glOK) { applyLightQuality(lights, renderer, quality); applyQualityPixelRatio(); }
    showToast(`Kualitas render: ${qualityLabel()}.`);
    renderSheetContent('settings');
  });
  const r1 = document.createElement('button');
  r1.type = 'button';
  r1.className = 'variant';
  r1.textContent = 'Lihat seluruh dapur';
  r1.addEventListener('click', () => { closeMobileSheet(); resetCameraView(); });
  const r2 = document.createElement('button');
  r2.type = 'button';
  r2.className = 'variant';
  r2.textContent = 'Reset seluruh konfigurasi';
  r2.addEventListener('click', () => { resetAllConfig(); renderSheetContent('settings'); });
  const grid = document.createElement('div');
  grid.className = 'variants';
  grid.append(q, r1, r2);
  const note = document.createElement('p');
  note.className = 'muted small';
  note.textContent = 'Kualitas rendah mematikan bayangan agar mulus di HP kentang. Reset mengembalikan warna, varian, pintu, dan penawaran.';
  wrap.append(grid, note);
  return wrap;
}

function renderSpec() {
  const empty = $('spec-empty');
  const body = $('spec-body');
  if (!selectedId) {
    empty.style.display = '';
    body.style.display = 'none';
    closeSheet();
    return;
  }
  const p = getProduct(selectedId);
  const v = variantOf(selectedId);
  empty.style.display = 'none';
  body.style.display = '';

  $('spec-cat').textContent = categoryLabel(p.category);
  $('spec-name').textContent = `${BRAND} ${p.name} — ${v.name}`;
  $('spec-thumb').textContent = thumbFor(p.id);
  $('spec-price').textContent = formatIDR(v.price);
  $('spec-desc').textContent = v.desc;
  $('fit-msg').textContent = '';
  $('fit-msg').className = 'fit-msg';

  const rows = [
    ['Dimensi (P × T × D)', dimsLabel(v.dims)],
    ...(v.capacity ? [['Kapasitas', v.capacity]] : []),
    ...(v.power ? [['Daya', v.power]] : []),
    ['Material', v.material],
    ['Harga', formatIDR(v.price)],
  ];
  $('spec-rows').innerHTML = rows.map(([k, val]) =>
    `<div class="row"><dt>${k}</dt><dd>${val}</dd></div>`).join('');

  // Pilihan varian.
  $('variant-list').innerHTML = '';
  for (const vv of p.variants) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'variant' + (vv.id === v.id ? ' active' : '');
    b.textContent = vv.name;
    b.setAttribute('aria-pressed', vv.id === v.id ? 'true' : 'false');
    b.addEventListener('click', () => switchVariant(p.id, vv.id));
    $('variant-list').appendChild(b);
  }

  const fit = checkFit(p, v);
  if (!fit.ok) {
    $('fit-msg').textContent = fit.message;
    $('fit-msg').classList.add('warn');
  }

  const open = !!state.openDoors[selectedId];
  $('btn-toggle').textContent = open ? 'Tutup' : 'Buka';

  openSheet();
}

function thumbFor(id) {
  return { microwave: '▦', oven: '▤', refrigerator: '▦', cooktop: '◉', hood: '⛛', sink: '⛲' }[id] || '☐';
}

function switchVariant(productId, variantId) {
  const p = getProduct(productId);
  const v = getVariant(p, variantId);
  const fit = checkFit(p, v);
  if (!fit.ok) {
    showToast('Dimensi tidak cocok — ' + fit.message);
    return;
  }
  state.variants[productId] = variantId;
  saveState(state);
  buildProduct(productId);
  if (selectedId === productId) {
    const n = productNodes.get(productId);
    highlighter.highlight(n.group);
    renderSpec();
    rig.focusObject(n.focus.pos, n.focus.target);
  }
  showToast(`Varian ${v.name} dipasang.`);
}

// ---------------------------------------------------------------------------
// Toolbar, preset, mode, kualitas
// ---------------------------------------------------------------------------
function productFocusMap() {
  const map = {};
  for (const [id, n] of productNodes) map[id] = n.focus;
  return map;
}

function bindToolbar() {
  const catBar = $('cat-bar');
  const catButtons = [];
  for (const c of CATEGORIES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (c.id === 'all' ? ' active' : '');
    b.textContent = c.label;
    b.dataset.cat = c.id;
    b.addEventListener('click', () => {
      currentFilter = c.id;
      catBar.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      // Gulir chip aktif ke posisi terlihat (termasuk kategori terakhir).
      b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      renderProductList(c.id);
      if (activeSheet === 'products') renderSheetContent('products');
      // Fokus produk pertama kategori tsb bila spesifik.
      if (c.id !== 'all' && glOK) {
        const first = PRODUCTS.find((p) => p.category === c.id);
        if (first && productNodes.has(first.id)) {
          const n = productNodes.get(first.id);
          rig.focusObject(n.focus.pos, n.focus.target);
        }
      } else if (glOK) rig.goPreset('overview');
    });
    catButtons.push(b);
    catBar.appendChild(b);
  }

  const presetBar = $('preset-bar');
  const defs = [
    ['overview', 'Overview'], ['cooking', 'Cooking Area'], ['microwave', 'Microwave'],
    ['oven', 'Oven'], ['refrigerator', 'Refrigerator'], ['island', 'Island'],
  ];
  for (const [id, label] of defs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip ghost';
    b.textContent = label;
    b.addEventListener('click', () => {
      if (!glOK) return;
      if (['microwave', 'oven', 'refrigerator'].includes(id)) {
        const map = { microwave: 'microwave', oven: 'oven', refrigerator: 'refrigerator' };
        const pid = map[id];
        const n = productNodes.get(pid);
        if (n) { selectProduct(pid, false); rig.focusObject(n.focus.pos, n.focus.target); }
      } else {
        rig.goPreset(id);
      }
    });
    presetBar.appendChild(b);
  }

  $('btn-reset-cam').addEventListener('click', () => {
    if (!glOK) return;
    if (exploreMode) setExplore(false);
    resetCameraView();
  });
  $('btn-overview').addEventListener('click', () => {
    if (!glOK) return;
    if (exploreMode) setExplore(false);
    resetCameraView();
  });
  $('btn-explore').addEventListener('click', () => setExplore(!exploreMode));
  $('btn-settings').addEventListener('click', (e) => openMobileSheet('settings', e.currentTarget));
  $('btn-quality').addEventListener('click', () => {
    quality = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high';
    state.quality = quality;
    saveState(state);
    $('btn-quality').textContent = `Kualitas: ${qualityLabel()}`;
    if (glOK) { applyLightQuality(lights, renderer, quality); applyQualityPixelRatio(); }
    showToast(`Kualitas render: ${qualityLabel()}.`);
  });
  $('btn-quality').textContent = `Kualitas: ${qualityLabel()}`;
  $('btn-reset-all').addEventListener('click', () => resetAllConfig());

  // Tombol Produk/Desain di bawah viewport (mobile) membuka sheet.
  document.querySelectorAll('.mobile-stage-actions .stage-action').forEach((b) => {
    b.addEventListener('click', () => {
      const name = b.dataset.sheet;
      if (activeSheet === name) closeMobileSheet();
      else openMobileSheet(name, b);
    });
  });
}

function resetCameraView() {
  if (!glOK || !rig) return;
  if (isMobile() && kitchenBox) rig.frameBounds(kitchenBox, { keepDirection: false });
  else rig.goPreset('overview');
}

function syncQualityButtons() {
  const label = `Kualitas: ${qualityLabel()}`;
  const b = $('btn-quality');
  if (b) b.textContent = label;
}

function resetAllConfig() {
  const s = resetState();
  Object.assign(state, s);
  quality = state.quality || (isMobile() ? 'medium' : 'high');
  syncQualityButtons();
  if (M) {
    applyCabinetColor(M, state.cabinet);
    applyCountertop(M, state.countertop);
  }
  renderDesignControls();
  if (glOK) {
    buildAllProducts();
    animator.setAll(false);
    resetCameraView();
  }
  state.openDoors = {};
  saveNow(state);
  selectProduct(null, false);
  renderQuote();
  showToast('Konfigurasi dikembalikan ke awal.');
}

function qualityLabel() {
  return { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' }[quality];
}

function setExplore(on) {
  exploreMode = on;
  $('btn-explore').classList.toggle('active', on);
  $('btn-explore').textContent = on ? 'Keluar Explore' : 'Mode Explore';
  $('explore-help').style.display = on ? '' : 'none';
  $('joystick').style.display = on ? '' : 'none';
  hotspots.setVisible(!on);
  if (!glOK) return;
  if (on) {
    rig.enterExplore();
    selectProduct(null, false);
    showToast('Mode Explore: WASD + mouse, atau joystick di mobile.');
  } else {
    rig.exitExplore();
  }
}

// ---------------------------------------------------------------------------
// Kontrol desain (warna kabinet & countertop)
// ---------------------------------------------------------------------------
function renderDesignControls() {
  // Render ke semua set kontrol yang ada (panel desktop + sheet mobile bila terbuka).
  const sets = [];
  const docCab = document.querySelector('.dock .design-cabinet-swatches');
  if (docCab) {
    sets.push({
      cab: docCab,
      ct: document.querySelector('.dock .design-counter-swatches'),
      nm: document.querySelector('.dock .design-cabinet-name'),
    });
  }
  const sheetCab = document.querySelector('#mobile-sheet-content .design-cabinet-swatches');
  if (sheetCab) {
    sets.push({
      cab: sheetCab,
      ct: document.querySelector('#mobile-sheet-content .design-counter-swatches'),
      nm: document.querySelector('#mobile-sheet-content .design-cabinet-name'),
    });
  }
  for (const { cab, ct, nm } of sets) {
    if (!cab || !ct) continue;
    cab.innerHTML = '';
    for (const c of CABINET_COLORS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (state.cabinet === c.id ? ' active' : '');
      b.style.background = c.color;
      b.title = c.label;
      b.setAttribute('aria-label', `Warna kabinet ${c.label}`);
      b.addEventListener('click', () => {
        state.cabinet = c.id;
        saveState(state);
        if (M) applyCabinetColor(M, c.id);
        renderDesignControls();
      });
      cab.appendChild(b);
    }
    if (nm) nm.textContent = (CABINET_COLORS.find((c) => c.id === state.cabinet) || {}).label || '';
    ct.innerHTML = '';
    for (const c of COUNTERTOPS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cts' + (state.countertop === c.id ? ' active' : '');
      b.textContent = c.label;
      b.addEventListener('click', () => {
        state.countertop = c.id;
        saveState(state);
        if (M) applyCountertop(M, c.id);
        renderDesignControls();
      });
      ct.appendChild(b);
    }
  }
}

// Struktur kontrol desain dipakai ulang di panel desktop & sheet mobile.
function designControlsHTML() {
  return `<h3>Warna kabinet — <span class="design-cabinet-name"></span></h3>
    <div class="design-cabinet-swatches swatches" role="group" aria-label="Warna kabinet"></div>
    <h3>Material countertop</h3>
    <div class="design-counter-swatches ct-list" role="group" aria-label="Material countertop"></div>`;
}

// ---------------------------------------------------------------------------
// Daftar produk (alternatif keyboard) + penawaran
// ---------------------------------------------------------------------------
function renderProductList(filter = 'all', target) {
  const list = target || $('product-list');
  if (!list) return;
  list.innerHTML = '';
  const visible = PRODUCTS.filter((p) => filter === 'all' || p.category === filter);
  // Filter tidak boleh menghilangkan pilihan aktif tanpa penjelasan:
  // bila produk terpilih tersaring, tampilkan penanda di atas daftar.
  if (selectedId && !visible.some((p) => p.id === selectedId)) {
    const p = getProduct(selectedId);
    const note = document.createElement('li');
    note.className = 'filter-note';
    note.innerHTML = `<button type="button" class="prod active"><span class="prod-thumb" aria-hidden="true">${thumbFor(p.id)}</span>` +
      `<span class="prod-text"><strong>${BRAND} ${p.name} (dipilih)</strong>` +
      `<small>Tersaring oleh kategori — ketuk untuk melihat, atau pilih “Semua”.</small></span></button>`;
    note.querySelector('button').addEventListener('click', () => selectProduct(p.id, true));
    list.appendChild(note);
  }
  for (const p of visible) {
    const v = variantOf(p.id);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'prod' + (selectedId === p.id ? ' active' : '');
    b.innerHTML = `<span class="prod-thumb" aria-hidden="true">${thumbFor(p.id)}</span>
      <span class="prod-text"><strong>${BRAND} ${p.name}</strong>
      <small>${v.name} · ${formatIDR(v.price)}</small></span>`;
    b.addEventListener('click', () => selectProduct(p.id, true));
    li.appendChild(b);
    list.appendChild(li);
  }
  // Kabinet: entri khusus yang membuka/menutup pintu & laci + fokus kamera.
  if (glOK && kitchen && kitchen.cabinets) {
    for (const c of kitchen.cabinets) {
      if (filter !== 'all') continue;
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'prod';
      b.innerHTML = `<span class="prod-thumb" aria-hidden="true">🗄</span>
        <span class="prod-text"><strong>${c.label}</strong>
        <small>Pintu &amp; laci dapat dibuka</small></span>`;
      b.addEventListener('click', () => toggleCabinet(c.id));
      li.appendChild(b);
      list.appendChild(li);
    }
  }
}

function toggleCabinet(cabinetId) {
  const c = (kitchen.cabinets || []).find((k) => k.id === cabinetId);
  if (!c) return;
  const anyClosed = c.movers.some((m) => (m.target ?? 0) < 0.5);
  for (const m of c.movers) m.target = anyClosed ? 1 : 0;
  const wp = new THREE.Vector3();
  c.group.getWorldPosition(wp);
  const ahead = wp.clone();
  ahead.z += 1.5; ahead.y += 0.55;
  if (cabinetId === 'kab-barat') { ahead.x += 1.5; ahead.z = wp.z; }
  rig.focusObject(ahead, new THREE.Vector3(wp.x, wp.y + 0.55, wp.z));
  selectProduct(null, false);
  showToast(anyClosed ? `${c.label} dibuka.` : `${c.label} ditutup.`);
}

function quoteLines() {
  return (state.quote || []).map((l) => {
    const p = getProduct(l.productId);
    const v = p ? getVariant(p, l.variantId) : null;
    return { ...l, product: p, variant: v, subtotal: v ? v.price * l.qty : 0 };
  }).filter((l) => l.product && l.variant);
}

function quoteTotal() {
  return quoteLines().reduce((a, l) => a + l.subtotal, 0);
}

function renderQuote() {
  const wrap = $('quote-items');
  const lines = quoteLines();
  $('quote-count').textContent = lines.reduce((a, l) => a + l.qty, 0);
  if (!lines.length) {
    wrap.innerHTML = '<p class="muted">Belum ada produk. Pilih peralatan lalu “Tambahkan ke penawaran”.</p>';
  } else {
    wrap.innerHTML = '';
    for (const l of lines) {
      const div = document.createElement('div');
      div.className = 'qline';
      div.innerHTML = `
        <div class="qline-info"><strong>${BRAND} ${l.product.name}</strong>
        <small>${l.variant.name} · ${formatIDR(l.variant.price)}</small></div>
        <div class="qline-ctl">
          <button type="button" data-act="dec" aria-label="Kurangi jumlah">−</button>
          <span aria-live="polite">${l.qty}</span>
          <button type="button" data-act="inc" aria-label="Tambah jumlah">+</button>
          <button type="button" data-act="del" aria-label="Hapus dari penawaran">✕</button>
        </div>
        <div class="qline-sub">${formatIDR(l.subtotal)}</div>`;
      div.querySelector('[data-act="dec"]').addEventListener('click', () => changeQty(l.productId, l.variantId, -1));
      div.querySelector('[data-act="inc"]').addEventListener('click', () => changeQty(l.productId, l.variantId, 1));
      div.querySelector('[data-act="del"]').addEventListener('click', () => removeLine(l.productId, l.variantId));
      wrap.appendChild(div);
    }
  }
  $('quote-total').textContent = formatIDR(quoteTotal());
}

function changeQty(productId, variantId, d) {
  const line = state.quote.find((l) => l.productId === productId && l.variantId === variantId);
  if (!line) return;
  line.qty += d;
  if (line.qty <= 0) state.quote = state.quote.filter((l) => l !== line);
  saveState(state);
  renderQuote();
}

function removeLine(productId, variantId) {
  state.quote = state.quote.filter((l) => !(l.productId === productId && l.variantId === variantId));
  saveState(state);
  renderQuote();
}

function bindQuote() {
  $('btn-quote').addEventListener('click', (e) => {
    // Di mobile, tutup sheet lain dulu — jangan menumpuk panel.
    if (activeSheet) {
      restoreSpecNodes();
      closeMobileSheet(false);
    }
    $('quote-drawer').classList.add('open');
    $('quote-drawer').setAttribute('aria-hidden', 'false');
    $('modal-scrim').classList.add('on');
    $('modal-scrim').setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    sheetTrigger = e.currentTarget;
    window.requestAnimationFrame(() => $('btn-quote-close').focus({ preventScroll: true }));
  });
  $('btn-quote-close').addEventListener('click', closeQuote);
  $('btn-export').addEventListener('click', exportJSON);
  $('btn-print').addEventListener('click', printQuote);
  $('btn-add-quote').addEventListener('click', () => {
    if (!selectedId) return;
    const v = variantOf(selectedId);
    const line = state.quote.find((l) => l.productId === selectedId && l.variantId === v.id);
    if (line) line.qty += 1;
    else state.quote.push({ productId: selectedId, variantId: v.id, qty: 1 });
    saveState(state);
    renderQuote();
    showToast(`${v.name} ditambahkan ke penawaran.`);
  });
}

function closeQuote() {
  $('quote-drawer').classList.remove('open');
  $('quote-drawer').setAttribute('aria-hidden', 'true');
  if (!activeSheet) {
    $('modal-scrim').classList.remove('on');
    $('modal-scrim').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }
  if (sheetTrigger && document.contains(sheetTrigger)) sheetTrigger.focus({ preventScroll: true });
  sheetTrigger = null;
}

function printQuote() {
  const lines = quoteLines();
  const rows = lines.map((l, i) => `<tr><td>${i + 1}</td><td>${BRAND} ${l.product.name} — ${l.variant.name}</td>` +
    `<td>${dimsLabel(l.variant.dims)}</td><td>${l.qty}</td>` +
    `<td>${formatIDR(l.variant.price)}</td><td>${formatIDR(l.subtotal)}</td></tr>`).join('');
  $('print-body').innerHTML =
    `<p>Tanggal: ${new Date().toLocaleString('id-ID')}</p>` +
    `<table><thead><tr><th>No</th><th>Produk</th><th>Dimensi</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>` +
    `<tbody>${rows || '<tr><td colspan="6">Belum ada item.</td></tr>'}</tbody></table>` +
    `<p><strong>Total: ${formatIDR(quoteTotal())}</strong></p>`;
  $('demo-note-print').textContent = DEMO_NOTE;
  window.print();
}

function exportJSON() {
  const data = {
    merek: BRAND,
    catatan: DEMO_NOTE,
    tanggal: new Date().toISOString(),
    konfigurasi: { kabinet: state.cabinet, countertop: state.countertop },
    item: quoteLines().map((l) => ({
      produk: l.product.name, varian: l.variant.name,
      dimensi_cm: dimsLabel(l.variant.dims),
      kapasitas: l.variant.capacity, daya: l.variant.power,
      harga_satuan: l.variant.price, jumlah: l.qty, subtotal: l.subtotal,
    })),
    total: quoteTotal(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'penawaran-dapur.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------------------------------------------------------------------------
// Tombol panel spesifikasi
// ---------------------------------------------------------------------------
function bindSpecButtons() {
  $('btn-sheet-close').addEventListener('click', () => {
    restoreSpecNodes();
    closeMobileSheet();
    if (!selectedId) renderSpec();
  });
  $('modal-scrim').addEventListener('click', () => {
    if ($('quote-drawer').classList.contains('open')) closeQuote();
    else if (activeSheet) {
      restoreSpecNodes();
      closeMobileSheet();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('quote-drawer').classList.contains('open')) closeQuote();
      else if (activeSheet) {
        restoreSpecNodes();
        closeMobileSheet();
      }
      if (exploreMode) setExplore(false);
    }
  });
  $('btn-toggle').addEventListener('click', () => {
    if (!selectedId || !glOK) return;
    const n = productNodes.get(selectedId);
    if (!n || !n.movers.length) {
      showToast('Produk ini tidak memiliki pintu/laci yang bisa dibuka.');
      return;
    }
    const open = !(state.openDoors[selectedId]);
    state.openDoors[selectedId] = open;
    if (!open) delete state.openDoors[selectedId];
    saveState(state);
    for (const m of n.movers) animator.toggle(m);
    $('btn-toggle').textContent = open ? 'Tutup' : 'Buka';
  });
  $('btn-interior').addEventListener('click', () => {
    if (!selectedId || !glOK) return;
    const n = productNodes.get(selectedId);
    if (!n) return;
    rig.focusObject(n.focus.pos, n.focus.target);
    if (n.movers.length && !state.openDoors[selectedId]) $('btn-toggle').click();
  });
}

// ---------------------------------------------------------------------------
// Joystick sentuh + drag pandang Explore
// ---------------------------------------------------------------------------
function bindExploreInput() {
  const joy = $('joystick');
  const nub = $('joy-nub');
  let joyId = null;
  let lookId = null;
  let lookXY = [0, 0];

  const setNub = (dx, dy) => { nub.style.transform = `translate(${dx}px, ${dy}px)`; };

  joy.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveStick(e); });
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    rig.stick.mx = 0; rig.stick.mz = 0;
    setNub(0, 0);
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  function moveStick(e) {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    setNub(dx * 34, dy * 34);
    rig.stick.mx = dx;
    rig.stick.mz = -dy;
  }

  // Drag di kanvas saat explore = memutar pandang.
  const cv = () => renderer.domElement;
  document.addEventListener('pointerdown', (e) => {
    if (!exploreMode || e.target !== cv()) return;
    lookId = e.pointerId;
    lookXY = [e.clientX, e.clientY];
  });
  document.addEventListener('pointermove', (e) => {
    if (!exploreMode || e.pointerId !== lookId) return;
    rig.lookDrag(e.clientX - lookXY[0], e.clientY - lookXY[1]);
    lookXY = [e.clientX, e.clientY];
  });
  const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
  document.addEventListener('pointerup', lookEnd);
  document.addEventListener('pointercancel', lookEnd);
}

// ---------------------------------------------------------------------------
// Loop render
// ---------------------------------------------------------------------------
const EXPLORE_BOUNDS = { x0: -2.45, x1: 2.45, z0: -2.05, z1: 2.05 };

function resize() {
  if (!glOK) return;
  const w = canvasWrap.clientWidth || 1;
  const h = canvasWrap.clientHeight || 1;
  renderer.setSize(w, h, false);
  rig.resize(w, h);
}

// ResizeObserver: perbarui renderer + aspect kamera mengikuti container,
// tanpa mereset posisi kamera pengguna.
let viewportRO = null;
function observeViewportResize() {
  if (!glOK || typeof ResizeObserver === 'undefined') return;
  if (viewportRO) viewportRO.disconnect();
  viewportRO = new ResizeObserver(() => resize());
  viewportRO.observe(canvasWrap);
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (exploreMode) {
    const cols = [...kitchen.colliders];
    for (const [, n] of productNodes) {
      const fp = n.group.userData.footprint;
      if (!fp) continue;
      // Footprint produk di dunia (rotasi slot hanya 0/90°).
      const rot = n.slot.rotationY;
      const w = Math.abs(rot) > 0.1 ? fp.d : fp.w;
      const d = Math.abs(rot) > 0.1 ? fp.w : fp.d;
      const hw = w / 2 + 0.05, hd = d / 2 + 0.05;
      cols.push({
        x0: n.group.position.x - hw, x1: n.group.position.x + hw,
        z0: n.group.position.z - hd, z1: n.group.position.z + hd,
      });
    }
    rig.exploreUpdate(dt, cols, EXPLORE_BOUNDS);
  } else {
    rig.update(dt);
  }
  animator.update(dt);
  hotspots.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Fallback tanpa WebGL: katalog + penawaran tetap berfungsi.
// ---------------------------------------------------------------------------
function initFallback() {
  VFALLBACK.style.display = '';
  canvasWrap.innerHTML = '<div class="no-gl"><p>Render 3D tidak tersedia di peramban ini. Katalog dan penawaran tetap dapat digunakan di bawah.</p></div>';
  // Matikan kontrol 3D.
  for (const id of ['btn-reset-cam', 'btn-explore', 'btn-quality', 'btn-toggle', 'btn-interior', 'btn-overview']) {
    const el = $(id);
    if (el) el.disabled = true;
  }
  // Tanpa WebGL, sheet Produk/Desain tetap berfungsi penuh.
  if (isMobile()) {
    document.querySelectorAll('.mobile-stage-actions .stage-action').forEach((b) => { b.disabled = false; });
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
function start() {
  bindToolbar();
  bindSpecButtons();
  bindQuote();
  renderDesignControls();
  renderProductList('all');
  renderQuote();
  renderSpec();
  $('demo-note').textContent = DEMO_NOTE;
  $('year').textContent = new Date().getFullYear();

  if (glOK) {
    try {
      initGL();
      bindExploreInput();
      loop();
    } catch (err) {
      console.error('Gagal memulai WebGL:', err);
      glOK = false;
      initFallback();
      showToast('Render 3D gagal dimulai — katalog tetap tersedia.');
    }
  } else {
    initFallback();
  }
  void COUNTER_Y;
  void PRESETS;
  void productFocusMap;
}

start();
