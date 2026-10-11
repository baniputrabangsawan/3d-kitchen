import * as THREE from 'three';

/**
 * Interaksi: raycasting pemilihan objek, hotspot HTML yang mengikuti objek
 * dan disembunyikan saat tertutup (uji oklusi via raycast), serta highlight.
 */

export function createPicker(camera, dom, getPickables) {
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downAt = 0;
  let downXY = [0, 0];

  function pick(cx, cy) {
    const rect = dom.getBoundingClientRect();
    ptr.x = ((cx - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((cy - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(getPickables(), true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.productId) o = o.parent;
      if (o && o.userData.productId) return { productId: o.userData.productId, point: h.point };
    }
    return null;
  }

  /** Klik (bukan drag) pada kanvas -> callback. Klik panel UI tidak sampai sini. */
  function onTap(cb) {
    dom.addEventListener('pointerdown', (e) => {
      downAt = performance.now();
      downXY = [e.clientX, e.clientY];
    });
    dom.addEventListener('pointerup', (e) => {
      const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
      if (performance.now() - downAt < 450 && moved < 7) {
        cb(pick(e.clientX, e.clientY));
      }
    });
  }

  return { pick, onTap, raycaster: ray };
}

// ---------------------------------------------------------------------------
// Hotspot
// ---------------------------------------------------------------------------
export function createHotspots(layer, camera, scene) {
  const items = new Map(); // productId -> { el, getPos, dot }
  const ray = new THREE.Raycaster();
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function add(productId, label, getPos) {
    remove(productId);
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.type = 'button';
    el.setAttribute('aria-label', `Pilih ${label}`);
    el.innerHTML = `<span class="hotspot-dot"></span><span class="hotspot-tag">${escapeHtml(label)}</span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      layer.dispatchEvent(new CustomEvent('hotspot', { detail: productId, bubbles: false }));
    });
    layer.appendChild(el);
    items.set(productId, { el, getPos });
  }

  function remove(productId) {
    const it = items.get(productId);
    if (it) { it.el.remove(); items.delete(productId); }
  }

  function clear() {
    for (const [, it] of items) it.el.remove();
    items.clear();
  }

  /** Posisikan + sembunyikan bila tertutup objek lain. */
  function update() {
    const w = layer.clientWidth;
    const h = layer.clientHeight;
    for (const [, it] of items) {
      const p = it.getPos();
      if (!p) { it.el.style.display = 'none'; continue; }
      v.copy(p).project(camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      if (behind || x < -40 || x > w + 40 || y < -40 || y > h + 40) {
        it.el.style.display = 'none';
        continue;
      }
      // Uji oklusi: raycast dari kamera ke titik; bila halangan lebih dekat, sembunyikan.
      dir.copy(p).sub(camera.position);
      const dist = dir.length();
      ray.set(camera.position, dir.normalize());
      ray.far = dist - 0.12;
      const hits = ray.intersectObjects(scene.children, true);
      const blocked = hits.length > 0;
      it.el.style.display = blocked ? 'none' : '';
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  }

  function setActive(productId) {
    for (const [id, it] of items) {
      it.el.classList.toggle('active', id === productId);
    }
  }

  function setVisible(visible) {
    layer.style.display = visible ? '' : 'none';
  }

  return { add, remove, clear, update, setActive, setVisible };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------------------------------------------------------------------------
// Highlight seleksi
// ---------------------------------------------------------------------------
export function createHighlighter() {
  let prev = null;
  const saved = new Map();

  function clear() {
    for (const [mat, e] of saved) {
      mat.emissive.setHex(e.hex);
      mat.emissiveIntensity = e.i;
    }
    saved.clear();
    prev = null;
  }

  function highlight(group) {
    clear();
    if (!group) return;
    prev = group;
    const mats = new Set();
    group.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) mats.add(o.material);
    });
    for (const m of mats) {
      if (!saved.has(m)) saved.set(m, { hex: m.emissive.getHex(), i: m.emissiveIntensity });
      m.emissive.setHex(0xc2372b);
      m.emissiveIntensity = 0.28;
    }
  }

  return { highlight, clear, get current() { return prev; } };
}
