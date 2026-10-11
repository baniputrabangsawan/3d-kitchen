# DapurKu 3D

Showroom dapur 3D interaktif berbasis **Vite + JavaScript + Three.js**. Semua bentuk dapur, kabinet, peralatan, interior, dan aksesori dibuat prosedural di JavaScript—tanpa Blender, GLB/GLTF, model unduhan, atau embed pihak ketiga.

> **Catatan:** Merek, spesifikasi, dan harga adalah **data demonstrasi fiktif**.

## Menjalankan aplikasi

Prasyarat: Node.js 20+ (disarankan Node.js 24 LTS).

```bash
npm install
npm run dev
```

Buka alamat yang tampil di terminal (default: `http://localhost:5173`).

Perintah lain:

```bash
npm run build    # build produksi ke dist/
npm run preview  # preview hasil build
```

## Fitur utama

- Dapur L modern lengkap: lantai, dua dinding, backsplash, kabinet bawah/atas, menara oven, island, stool, lampu gantung, karpet, dan jam dinding.
- Microwave, oven, kulkas 2 pintu, kompor 4 zona, cooker hood, sink, dan keran dengan detail prosedural.
- Interior oven, microwave, dan kulkas (rak, loyang, bahan makanan, lampu, laci, dan rak pintu).
- Pintu microwave/kulkas/kabinet dan pintu oven ke bawah; laci kabinet dapat dianimasikan dengan halus serta dibalik di tengah animasi.
- Kamera orbit, zoom, pan; preset Overview, Cooking Area, Microwave, Oven, Refrigerator, serta Island.
- **Mode Explore:** WASD/panah + mouse di desktop; joystick + drag untuk menoleh di mobile. Collider mencegah kamera melewati dinding, island, kabinet, dan peralatan utama.
- Hotspot dengan raycast oklusi, pemilihan objek 3D, dan panel spesifikasi berbahasa Indonesia.
- Alternatif aksesibel berupa daftar produk HTML yang dapat dinavigasi keyboard; daftar kabinet dapat membuka/menutup pintu serta laci.
- Varian microwave dan oven; validasi dimensi mencegah varian yang tidak muat dipasang.
- Pilihan warna kabinet dan material countertop secara langsung.
- Daftar penawaran: tambah item, ubah jumlah, hapus, total Rupiah, ekspor JSON, dan cetak.
- Konfigurasi, varian, kondisi pintu, dan penawaran disimpan ke `localStorage`.
- Fallback katalog/penawaran tetap dapat digunakan jika WebGL tidak tersedia.
- Kualitas rendah/sedang/tinggi, pixel ratio dibatasi, bayangan adaptif, dan dukungan `prefers-reduced-motion`.

## Struktur proyek

```text
src/
├── data/
│   ├── catalog.js       # katalog produk, varian, harga, validasi ukuran
│   └── storage.js       # localStorage konfigurasi & penawaran
├── three/
│   ├── appliances.js    # pabrik microwave, oven, kulkas, kompor, hood, sink
│   ├── animator.js      # animasi delta-time untuk pintu/laci
│   ├── cameraRig.js     # orbit, preset, dan Explore WASD/mobile
│   ├── interaction.js   # raycast, hotspot teroklusi, highlighter
│   ├── kitchen.js       # dapur L, kabinet reuse, island, collider
│   ├── lighting.js      # pencahayaan lembut & kualitas bayangan
│   ├── materials.js     # material/geometri bersama + tekstur Canvas API
│   └── parts.js         # komponen reusable: engsel, handle, laci, rak
├── main.js              # orkestrasi scene, UI, katalog, quote
└── styles.css           # UI responsif desktop/mobile + gaya cetak
index.html               # shell aplikasi
```

## Kontrol

| Aksi | Desktop | Mobile |
| --- | --- | --- |
| Orbit | Drag | Seret satu jari |
| Zoom | Scroll | Cubit dua jari |
| Geser pandangan | Klik kanan atau Shift + drag | — |
| Explore | WASD/panah, Shift untuk lari | Joystick dan drag untuk menoleh |
| Pilih | Klik hotspot/objek atau daftar produk | Ketuk hotspot/daftar produk |

## Validasi

Build produksi dijalankan dengan:

```bash
npm run build
```

Hasil build berada di `dist/`.
