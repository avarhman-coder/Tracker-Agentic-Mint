// Vercel Edge Function: proxy + cache untuk API publik ai.koncet.xyz
// Dipanggil halaman sebagai /api/feed?type=nft|tokens|contracts|pulse|tokenstats
//
// Perbedaan dari versi Netlify: tidak ada riwayat bersama di server
// (Netlify Blobs tidak tersedia di Vercel). Halaman tetap mengakumulasi
// baris tanpa duplikat dan menyimpannya di localStorage browser, jadi
// daftar tetap panjang selama pemakaian dan tersimpan antar kunjungan
// di browser yang sama.
const UPSTREAM = {
  nft: "https://ai.koncet.xyz/api/pulse/feed?limit=60",
  tokens: "https://ai.koncet.xyz/api/tokens/feed?limit=80",
  contracts: "https://ai.koncet.xyz/api/pulse/contracts?limit=20",
  pulse: "https://ai.koncet.xyz/api/pulse",
  tokenstats: "https://ai.koncet.xyz/api/tokens/stats",
};

export default async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "nft";
  if (!UPSTREAM[type]) {
    return Response.json({ error: "unknown type" }, { status: 400 });
  }
  try {
    const r = await fetch(UPSTREAM[type], { headers: { "user-agent": "agentic-mint-tracker-vercel/1.0" } });
    if (!r.ok) throw new Error("upstream " + r.status);
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    });
  } catch (e) {
    return Response.json({ error: "upstream fetch failed", detail: String(e) }, { status: 502 });
  }
};

export const config = { runtime: "edge" };
