/**
 * Penyimpanan lokal: konfigurasi desain + varian + daftar penawaran.
 */
const KEY = 'dapur3d-state-v1';

const DEFAULTS = {
  cabinet: 'oak',
  countertop: 'carrara',
  quality: 'high',
  variants: {
    microwave: 'mw-r32',
    oven: 'ov-t60',
    refrigerator: 'rf-2p',
    cooktop: 'ct-4g',
    hood: 'hd-60',
    sink: 'sk-1b',
  },
  quote: [], // [{ productId, variantId, qty }]
  openDoors: {}, // productId -> true bila sedang dibuka
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
    s.variants = { ...DEFAULTS.variants, ...(s.variants || {}) };
    if (!Array.isArray(s.quote)) s.quote = [];
    if (typeof s.openDoors !== 'object' || !s.openDoors) s.openDoors = {};
    return s;
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let timer = null;
export function saveState(state) {
  // Tulis sinkron: seluruh pemicu penyimpanan adalah aksi klik diskrit,
  // sehingga tidak ada risiko reload terjadi sebelum state tersimpan.
  clearTimeout(timer);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* penuh/privat */ }
}

export function saveNow(state) {
  clearTimeout(timer);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* abaikan */ }
}

export function resetState() {
  try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
  return structuredClone(DEFAULTS);
}
