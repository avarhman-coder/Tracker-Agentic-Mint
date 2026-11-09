// Penyimpanan riwayat feed di Netlify Blobs (tanpa paket npm — memakai
// konteks Blobs yang disuntikkan Netlify ke fungsi lewat env
// NETLIFY_BLOBS_CONTEXT). Kalau Blobs tidak tersedia/gagal, semua fungsi
// di sini diam-diam no-op dan feed kembali ke perilaku dasar (baris
// terbaru saja) — halaman tetap jalan.
const STORE = "tracker-history";

function blobsContext() {
  const raw = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* bukan JSON polos */ }
  try { return JSON.parse(Buffer.from(raw, "base64").toString("utf8")); } catch { return null; }
}

function blobUrl(ctx, key) {
  const api = (ctx.apiURL || "https://api.netlify.com").replace(/\/$/, "");
  return `${api}/api/v1/blobs/${ctx.siteID}/${STORE}/${encodeURIComponent(key)}`;
}

export async function blobGetJson(key) {
  const ctx = blobsContext();
  if (!ctx || !ctx.siteID || !ctx.token) return null;
  try {
    const r = await fetch(blobUrl(ctx, key), { headers: { authorization: `Bearer ${ctx.token}` } });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function blobPutJson(key, value) {
  const ctx = blobsContext();
  if (!ctx || !ctx.siteID || !ctx.token) return false;
  try {
    const r = await fetch(blobUrl(ctx, key), {
      method: "PUT",
      headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    return r.ok;
  } catch { return false; }
}

export function rowKey(type, r) {
  return type === "nft"
    ? `${r.tx}:${r.log_index}:${r.token_id}`
    : `${r.tx}:${r.token}:${r.agent}:${r.amount_raw}`;
}

// Gabungkan baris baru ke riwayat tersimpan (dedupe, urut terbaru, maks 500),
// simpan lagi, dan kembalikan riwayat lengkapnya. Mengembalikan baris mentah
// bila penyimpanan tidak tersedia.
export async function mergeHistory(type, freshRows) {
  const key = "feed:" + type;
  const stored = await blobGetJson(key);
  if (!Array.isArray(stored)) {
    // Penyimpanan belum terjangkau: tetap tanam baris pertama bila bisa.
    await blobPutJson(key, freshRows);
    return freshRows;
  }
  const seen = new Set(stored.map((r) => rowKey(type, r)));
  const merged = stored.slice();
  let changed = false;
  for (const r of freshRows) {
    const k = rowKey(type, r);
    if (!seen.has(k)) { seen.add(k); merged.push(r); changed = true; }
  }
  merged.sort((a, b) => (b.ts - a.ts) || (b.block - a.block));
  const capped = merged.slice(0, 500);
  if (changed) await blobPutJson(key, capped);
  return capped;
}
