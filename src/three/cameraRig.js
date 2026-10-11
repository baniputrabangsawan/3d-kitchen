import * as THREE from 'three';

/**
 * Kamera sinematik: orbit + zoom + pan manual (tanpa OrbitControls agar
 * perilaku sentuh/desktop seragam), preset halus, dan mode Explore (WASD).
 */

const REDUCED = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PRESETS = {
  overview: {
    label: 'Overview',
    pos: new THREE.Vector3(2.9, 2.5, 3.1),
    target: new THREE.Vector3(-0.5, 0.7, -0.9),
  },
  cooking: {
    label: 'Cooking Area',
    pos: new THREE.Vector3(0.5, 1.55, -0.15),
    target: new THREE.Vector3(0.2, 0.85, -2.05),
  },
  microwave: { label: 'Microwave', pos: null, target: null },
  oven: { label: 'Oven', pos: null, target: null },
  refrigerator: { label: 'Refrigerator', pos: null, target: null },
  island: {
    label: 'Island',
    pos: new THREE.Vector3(0.35, 1.7, 1.85),
    target: new THREE.Vector3(0.35, 0.75, -0.1),
  },
};

export function createCameraRig(dom, opts = {}) {
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);
  const target = PRESETS.overview.target.clone();
  camera.position.copy(PRESETS.overview.pos);

  const state = {
    yaw: 0, pitch: 0, dist: 0,
    mode: 'orbit',
    fly: null, // { p0,p1,t0,t1,dur,t }
    explore: { pos: new THREE.Vector3(0.6, 1.6, 1.4), yaw: Math.PI, pitch: -0.08 },
    onChange: opts.onChange || (() => {}),
  };

  function syncOrbitFromCamera() {
    const off = camera.position.clone().sub(target);
    state.dist = off.length();
    state.yaw = Math.atan2(off.x, off.z);
    state.pitch = Math.asin(THREE.MathUtils.clamp(off.y / state.dist, -1, 1));
  }
  syncOrbitFromCamera();

  function applyOrbit() {
    const cp = Math.cos(state.pitch);
    camera.position.set(
      target.x + state.dist * cp * Math.sin(state.yaw),
      target.y + state.dist * Math.sin(state.pitch),
      target.z + state.dist * cp * Math.cos(state.yaw),
    );
    camera.lookAt(target);
  }

  function flyTo(pos, tgt, dur = 1.15) {
    if (REDUCED()) dur = 0.01;
    state.mode = 'orbit';
    state.fly = {
      p0: camera.position.clone(), p1: pos.clone(),
      t0: target.clone(), t1: tgt.clone(),
      dur, t: 0,
    };
    syncOrbitFromCamera();
  }

  function goPreset(name, productFocus = {}) {
    let p = PRESETS[name];
    if ((name === 'microwave' || name === 'oven' || name === 'refrigerator') && productFocus[name]) {
      flyTo(productFocus[name].pos, productFocus[name].target);
      return;
    }
    if (p && p.pos) flyTo(p.pos, p.target);
  }

  function focusObject(worldPos, worldTarget, distScale = 1) {
    const dir = worldPos.clone().sub(worldTarget);
    if (dir.lengthSq() < 1e-6) dir.set(1, 0.5, 1.2);
    dir.normalize();
    const dist = THREE.MathUtils.clamp(1.35 * distScale, 0.7, 2.6);
    const pos = worldTarget.clone().addScaledVector(dir, dist);
    pos.y = Math.max(pos.y, worldTarget.y + 0.25);
    flyTo(pos, worldTarget);
  }

  /**
   * Bingkai seluruh dapur dari bounding box agar muat di viewport mobile.
   * Arah pandang dipertahankan (relatif terhadap target lama) bila ada;
   * bila tidak, pakai sudut overview yang menyenangkan di layar portrait.
   */
  function frameBounds(box, opts = {}) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const fitH = radius / Math.sin(Math.min(hFov, vFov) / 2);
    const fitV = radius / Math.sin(vFov / 2);
    const dist = THREE.MathUtils.clamp(Math.max(fitH, fitV) * 1.02, 2.2, 12);
    let dir;
    if (opts.keepDirection) {
      dir = camera.position.clone().sub(target);
      if (dir.lengthSq() < 1e-6) dir.set(0.55, 0.5, 1);
      dir.normalize();
      dir.y = Math.max(dir.y, 0.32);
      dir.normalize();
    } else {
      dir = new THREE.Vector3(0.62, 0.52, 1).normalize();
    }
    const pos = center.clone().addScaledVector(dir, dist);
    flyTo(pos, center, opts.dur ?? 1.0);
  }

  function update(dt) {
    if (state.fly) {
      const f = state.fly;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(f.p0, f.p1, e);
      target.lerpVectors(f.t0, f.t1, e);
      camera.lookAt(target);
      if (k >= 1) { state.fly = null; syncOrbitFromCamera(); }
      state.onChange();
      return;
    }
    if (state.mode === 'orbit') {
      state.pitch = THREE.MathUtils.clamp(state.pitch, -0.15, 1.35);
      state.dist = THREE.MathUtils.clamp(state.dist, 0.7, 9);
      // Jangan biarkan target keluar ruangan.
      target.x = THREE.MathUtils.clamp(target.x, -2.6, 2.6);
      target.y = THREE.MathUtils.clamp(target.y, 0.05, 2.3);
      target.z = THREE.MathUtils.clamp(target.z, -2.2, 2.2);
      applyOrbit();
      state.onChange();
    }
  }

  // ---- Kontrol orbit/zoom/pan (mouse + sentuh) ----
  let dragging = false;
  let panning = false;
  let lx = 0, ly = 0;
  let pinch = 0;
  let pinchDist = 0;

  function cancelFly() { state.fly = null; }

  dom.addEventListener('pointerdown', (e) => {
    if (state.mode === 'explore') return;
    dragging = true;
    panning = e.button === 2 || e.shiftKey;
    lx = e.clientX; ly = e.clientY;
    dom.setPointerCapture(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (!dragging || state.mode === 'explore') return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    cancelFly();
    if (panning) {
      const s = state.dist * 0.0011;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      target.addScaledVector(right, -dx * s);
      target.addScaledVector(up, dy * s);
      target.y = THREE.MathUtils.clamp(target.y, 0.05, 2.3);
    } else {
      state.yaw -= dx * 0.0052;
      state.pitch += dy * 0.0042;
    }
  });
  const endPointer = (e) => {
    dragging = false;
    try { dom.releasePointerCapture(e.pointerId); } catch { /* abaikan */ }
  };
  dom.addEventListener('pointerup', endPointer);
  dom.addEventListener('pointercancel', endPointer);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('wheel', (e) => {
    if (state.mode === 'explore') return;
    e.preventDefault();
    cancelFly();
    state.dist *= 1 + Math.sign(e.deltaY) * 0.09;
  }, { passive: false });

  dom.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinch = 2;
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  }, { passive: true });
  dom.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch === 2 && state.mode !== 'explore') {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (pinchDist > 0) {
        cancelFly();
        state.dist *= pinchDist / Math.max(40, d);
      }
      pinchDist = d;
    }
  }, { passive: true });
  dom.addEventListener('touchend', () => { pinch = 0; });

  // ---- Mode Explore ----
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (state.mode === 'explore') {
      keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  // Touch joystick di layar (dipanggil dari UI).
  const stick = { active: false, mx: 0, mz: 0 };

  function exploreUpdate(dt, colliders, bounds) {
    const ex = state.explore;
    // Putar pandang dengan drag.
    // (drag ditangani oleh UI overlay: menggeser yaw/pitch)
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 2.2 : 1.15;
    let mx = 0, mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    mx += stick.mx; mz += stick.mz;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const k = Math.min(1, len) * speed * dt;
      const sin = Math.sin(ex.yaw), cos = Math.cos(ex.yaw);
      // Kamera menghadap -Z lokal yaw.
      const nx = ex.pos.x + ((-sin) * mz + cos * mx) * k * -1;
      const nz = ex.pos.z + ((-cos) * mz - sin * mx) * k * -1;
      const r = 0.22;
      if (!hitsCollider(nx, nz, r, colliders) && inBounds(nx, nz, bounds)) {
        ex.pos.x = nx; ex.pos.z = nz;
      } else if (!hitsCollider(nx, ex.pos.z, r, colliders) && inBounds(nx, ex.pos.z, bounds)) {
        ex.pos.x = nx;
      } else if (!hitsCollider(ex.pos.x, nz, r, colliders) && inBounds(ex.pos.x, nz, bounds)) {
        ex.pos.z = nz;
      }
    }
    ex.pos.y = 1.6;
    camera.position.copy(ex.pos);
    const look = new THREE.Vector3(
      ex.pos.x - Math.sin(ex.yaw) * Math.cos(ex.pitch),
      ex.pos.y + Math.sin(ex.pitch),
      ex.pos.z - Math.cos(ex.yaw) * Math.cos(ex.pitch),
    );
    camera.lookAt(look);
    state.onChange();
  }

  function hitsCollider(x, z, r, colliders) {
    for (const c of colliders) {
      const nx = THREE.MathUtils.clamp(x, c.x0, c.x1);
      const nz = THREE.MathUtils.clamp(z, c.z0, c.z1);
      if (Math.hypot(x - nx, z - nz) < r) return true;
    }
    return false;
  }
  function inBounds(x, z, b) {
    return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  }

  function enterExplore() {
    state.mode = 'explore';
    state.fly = null;
    state.explore.pos.set(0.9, 1.6, 1.5);
    state.explore.yaw = Math.PI * 0.82;
    state.explore.pitch = -0.05;
    keys.clear();
  }
  function exitExplore() {
    state.mode = 'orbit';
    keys.clear();
    stick.active = false; stick.mx = 0; stick.mz = 0;
    flyTo(PRESETS.overview.pos, PRESETS.overview.target, 0.8);
  }

  /** Drag pandang di mode explore (dari overlay sentuh). */
  function lookDrag(dx, dy) {
    state.explore.yaw -= dx * 0.0042;
    state.explore.pitch = THREE.MathUtils.clamp(state.explore.pitch - dy * 0.0032, -1.1, 1.1);
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    camera, target, state, stick,
    update, exploreUpdate, flyTo, goPreset, focusObject, frameBounds,
    enterExplore, exitExplore, lookDrag, resize,
    syncOrbitFromCamera,
  };
}

export function reducedMotion() {
  return REDUCED();
}
