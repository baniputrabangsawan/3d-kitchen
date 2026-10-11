/**
 * Katalog produk — terpisah dari kode pembentuk geometri.
 * Seluruh data di bawah ini adalah DATA DEMONSTRASI dengan merek fiktif.
 */

export const BRAND = 'NusaDapur';
export const DEMO_NOTE = 'Data demonstrasi — spesifikasi & harga fiktif untuk keperluan demo.';

export const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'microwave', label: 'Microwave' },
  { id: 'oven', label: 'Oven' },
  { id: 'refrigerator', label: 'Kulkas' },
  { id: 'cooktop', label: 'Kompor' },
  { id: 'hood', label: 'Cooker Hood' },
  { id: 'sink', label: 'Sink & Keran' },
];

export function categoryLabel(id) {
  return (CATEGORIES.find((c) => c.id === id) || {}).label || id;
}

export function formatIDR(n) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
}

export function dimsLabel(d) {
  return `${Math.round(d.w * 100)} × ${Math.round(d.h * 100)} × ${Math.round(d.d * 100)} cm`;
}

/**
 * slot: ruang maksimum (meter) yang tersedia di kabinet untuk produk itu.
 * Varian yang melebihi slot akan ditolak dengan pesan.
 */
export const PRODUCTS = [
  {
    id: 'microwave',
    category: 'microwave',
    name: 'Microwave Rata',
    blurb: 'Microwave countertop dengan pintu kaca samping.',
    slot: { maxW: 0.68, maxH: 0.42, maxD: 0.5, where: 'ruang di atas counter (lebar maks. 68 cm)' },
    variants: [
      {
        id: 'mw-r25', name: 'Rata 25 Compact',
        dims: { w: 0.45, h: 0.29, d: 0.34 },
        capacity: '25 L', power: '900 W',
        material: 'Bodi baja lapis, pintu kaca gelap',
        price: 1899000,
        desc: 'Varian kompak untuk dapur mungil. Meja putar kaca dan 5 level daya dengan panel sentuh.',
      },
      {
        id: 'mw-r32', name: 'Rata 32 Standar',
        dims: { w: 0.55, h: 0.31, d: 0.4 },
        capacity: '32 L', power: '1.000 W',
        material: 'Bodi stainless, pintu kaca gelap',
        price: 2749000,
        desc: 'Varian standar dengan rongga lebih lega, mode defrost otomatis, dan kunci anak.',
      },
      {
        id: 'mw-r40', name: 'Rata 40 Jumbo',
        dims: { w: 0.72, h: 0.36, d: 0.46 },
        capacity: '40 L', power: '1.100 W',
        material: 'Bodi stainless, pintu kaca gelap',
        price: 3999000,
        desc: 'Varian jumbo untuk loyang besar. SENGAJA terlalu lebar untuk slot counter ini — untuk mendemonstrasikan validasi dimensi.',
      },
    ],
  },
  {
    id: 'oven',
    category: 'oven',
    name: 'Oven Tanam',
    blurb: 'Oven tanam eye-level dengan pintu lipat ke bawah.',
    slot: { maxW: 0.62, maxH: 0.62, maxD: 0.6, where: 'ceruk menara oven (lebar maks. 62 cm)' },
    variants: [
      {
        id: 'ov-t60', name: 'Tanam 60 Klasik',
        dims: { w: 0.6, h: 0.6, d: 0.55 },
        capacity: '71 L', power: '2.900 W',
        material: 'Stainless & kaca hitam',
        price: 4999000,
        desc: 'Oven tanam 60 cm dengan 8 fungsi masak, rak kawat ganda, dan kenop putar klasik.',
      },
      {
        id: 'ov-t60p', name: 'Tanam 60 Pyro',
        dims: { w: 0.6, h: 0.595, d: 0.565 },
        capacity: '76 L', power: '3.300 W',
        material: 'Kaca hitam penuh & stainless gelap',
        price: 7499000,
        desc: 'Varian premium: panel sentuh penuh, display digital, rel telescopic, dan pembersih pirolitik.',
      },
    ],
  },
  {
    id: 'refrigerator',
    category: 'refrigerator',
    name: 'Kulkas Dingin Duo',
    blurb: 'Kulkas dua pintu bersebelahan dengan interior lengkap.',
    slot: { maxW: 0.82, maxH: 1.94, maxD: 0.68, where: 'ceruk dinding barat' },
    variants: [
      {
        id: 'rf-2p', name: 'Dingin Duo 2 Pintu',
        dims: { w: 0.8, h: 1.9, d: 0.65 },
        capacity: '420 L', power: '150 W',
        material: 'Stainless anti-jari',
        price: 8999000,
        desc: 'Kulkas side-by-side dengan rak kaca, laci sayur, rak pintu, dan lampu interior.',
      },
    ],
  },
  {
    id: 'cooktop',
    category: 'cooktop',
    name: 'Kompor Api 4',
    blurb: 'Kompor tanam 4 tungku di atas oven bawah.',
    slot: { maxW: 0.62, maxH: 0.12, maxD: 0.56, where: 'lubang counter area masak' },
    variants: [
      {
        id: 'ct-4g', name: 'Api 4 Tungku',
        dims: { w: 0.6, h: 0.09, d: 0.52 },
        capacity: null, power: '3.500 W (induksi)',
        material: 'Kaca keramik hitam & dudukan besi cor',
        price: 3299000,
        desc: 'Kompor induksi 4 zona dengan penanda lingkaran, kenop depan, dan pengaman panas sisa.',
      },
    ],
  },
  {
    id: 'hood',
    category: 'hood',
    name: 'Cooker Hood Hisap 60',
    blurb: 'Penghisap asap cerobong di atas kompor.',
    slot: { maxW: 0.66, maxH: 1.1, maxD: 0.55, where: 'ruang di atas kompor' },
    variants: [
      {
        id: 'hd-60', name: 'Hisap 60 Cerobong',
        dims: { w: 0.6, h: 0.95, d: 0.5 },
        capacity: '650 m³/jam', power: '210 W',
        material: 'Stainless & kaca',
        price: 2999000,
        desc: 'Cooker hood cerobong dengan 3 kecepatan, filter aluminium cuci-ulang, dan lampu LED.',
      },
    ],
  },
  {
    id: 'sink',
    category: 'sink',
    name: 'Sink Cuci Granit',
    blurb: 'Bak cuci tanam dengan keran angsa.',
    slot: { maxW: 0.9, maxH: 0.25, maxD: 0.55, where: 'lubang counter area cuci' },
    variants: [
      {
        id: 'sk-1b', name: 'Cuci Granit 1 Bak',
        dims: { w: 0.86, h: 0.2, d: 0.5 },
        capacity: '32 L', power: null,
        material: 'Granit komposit & keran stainless',
        price: 1599000,
        desc: 'Bak tunggal granit anti-noda dengan keran leher angsa putar dan tuas single.',
      },
    ],
  },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

export function getVariant(product, variantId) {
  return product.variants.find((v) => v.id === variantId) || product.variants[0];
}

/** Cek apakah varian muat di slot; kembalikan {ok, message}. */
export function checkFit(product, variant) {
  const s = product.slot;
  const d = variant.dims;
  const bits = [];
  if (d.w > s.maxW + 1e-6) bits.push(`lebar ${Math.round(d.w * 100)} cm melebihi ${s.where} (${Math.round(s.maxW * 100)} cm)`);
  if (d.h > s.maxH + 1e-6) bits.push(`tinggi ${Math.round(d.h * 100)} cm melebihi batas ${Math.round(s.maxH * 100)} cm`);
  if (d.d > s.maxD + 1e-6) bits.push(`kedalaman ${Math.round(d.d * 100)} cm melebihi batas ${Math.round(s.maxD * 100)} cm`);
  if (!bits.length) return { ok: true, message: '' };
  return { ok: false, message: `Varian “${variant.name}” tidak muat: ${bits.join('; ')}.` };
}
