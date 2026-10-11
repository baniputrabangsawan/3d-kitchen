/**
 * Manajer animasi buka/tutup: halus, dapat dibalik di tengah jalan,
 * kecepatan konsisten via delta time, hormati prefers-reduced-motion.
 */

const REDUCED = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createAnimator() {
  const movers = new Set();
  return {
    register(m) {
      if (m.t === undefined) m.t = 0;
      if (m.target === undefined) m.target = 0;
      movers.add(m);
    },
    unregister(m) { movers.delete(m); },
    clear() { movers.clear(); },
    toggle(m) { m.target = m.target > 0.5 ? 0 : 1; },
    setAll(open) { for (const m of movers) m.target = open ? 1 : 0; },
    update(dt) {
      if (REDUCED()) {
        for (const m of movers) {
          m.t = m.target;
          applyMover(m);
        }
        return;
      }
      const speed = 2.6; // per detik
      for (const m of movers) {
        if (Math.abs(m.t - m.target) < 0.0005) {
          if (m.t !== m.target) { m.t = m.target; applyMover(m); }
          continue;
        }
        const dir = m.target > m.t ? 1 : -1;
        m.t = THREE_MATH.clamp(m.t + dir * speed * dt, 0, 1);
        applyMover(m);
      }
    },
  };
}

const THREE_MATH = {
  clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
};

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function applyMover(m) {
  const k = smooth(THREE_MATH.clamp(m.t, 0, 1));
  if (m.slide) {
    const base = m.basePos || (m.basePos = m.object.position.clone());
    if (m.slide === 'z') m.object.position.z = base.z + m.open * k;
    else if (m.slide === 'y') m.object.position.y = base.y + m.open * k;
    else if (m.slide === 'x') m.object.position.x = base.x + m.open * k;
    return;
  }
  const v = m.closed + (m.open - m.closed) * k;
  if (m.axis === 'x') m.object.rotation.x = v;
  else if (m.axis === 'y') m.object.rotation.y = v;
  else if (m.axis === 'z') m.object.rotation.z = v;
}
