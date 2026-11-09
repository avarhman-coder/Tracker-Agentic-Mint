# Agentic Mint Tracker — paket universal (v7)

Build v7-universal — 10 November 2026. SATU paket, satu repo GitHub,
bisa jalan di hampir semua platform hosting modern tanpa mengubah isi:

| Platform | Cara | Yang dipakai |
|---|---|---|
| Vercel | Import repo / hubungkan Git | folder `api/` |
| Netlify | Import repo | `netlify/functions/` + `netlify.toml` |
| Cloudflare Pages | Hubungkan repo (tanpa build command) | folder `functions/` |
| Render / Railway / Fly / VPS / komputer sendiri | `npm start` atau `node server.mjs` | `server.mjs` + folder `api/` |

Domain bebas: domain apa pun (mis. .io, .xyz, .com) tinggal diarahkan
lewat DNS ke platform pilihanmu — paket ini tidak terikat domain.

Batasan jujur: hosting statis murni tanpa fungsi server (mis. GitHub
Pages saja) bisa menampilkan halamannya, tetapi data live-nya tidak
bisa dimuat — API sumber (ai.koncet.xyz) tidak mengizinkan pengambilan
langsung dari browser (CORS), jadi komponen server kecil di atas wajib
ada di suatu tempat. Fitur sama seperti v5: 4 tab (Mint NFT, Token,
Kontrak, JAGENT), tombol SINKRONKAN, dan tab Token dengan kolom
**Harga Mint** (GRATIS / jumlah bayar, dilacak dari transaksi on-chain)
+ **Harga Pasar** (USD dari DexScreener).

## Isi paket

- `index.html` — halamannya (dipakai semua platform).
- `package.json` — penanda modul JS (wajib ada).
- `api/` — fungsi server inti (dipakai Vercel, dan oleh `server.mjs`).
- `netlify/functions/` + `netlify.toml` — fungsi server untuk **Netlify**.
- `functions/` — adapter tipis untuk **Cloudflare Pages**.
- `server.mjs` — server Node tanpa dependensi untuk hosting Node/VPS.

Vercel mengabaikan folder `netlify/`, Netlify mengabaikan folder
`api/` — jadi keduanya aman berdampingan dalam satu repo.

## Cara pakai lewat GitHub

1. Buat repo baru di github.com.
2. Upload **ISI** folder ini ke akar repo (bukan foldernya): `index.html`
   dan `api/` harus di paling atas, jangan di dalam subfolder.
3. Hubungkan ke platform pilihanmu:
   - **Vercel:** Add New → Project → pilih repo ini → Deploy.
     (Atau proyek yang sudah ada: Settings → Git → Connect.)
   - **Netlify:** Add new site → Import an existing project → pilih
     repo ini → Deploy. Pengaturan build terbaca dari `netlify.toml`.
   - **Cloudflare Pages:** Create → Pages → Connect to Git → pilih repo
     ini, build command dikosongkan → Deploy.
   - **Hosting Node (Render/Railway/VPS):** arahkan start command ke
     `npm start`.
4. Update berikutnya cukup upload file yang berubah ke repo — deploy
   ulang berjalan otomatis.

## Perbedaan kecil antar platform

- Di Netlify ada riwayat bersama di server (Netlify Blobs): daftar
  baris tetap panjang walau dibuka dari browser/perangkat lain.
- Di Vercel riwayat terkumpul di localStorage browser yang membuka.
  Sisanya identik.
