// Netlify Function: proxy + cache untuk API publik ai.koncet.xyz
// Dipanggil halaman sebagai /api/feed?type=nft|tokens|contracts|pulse|tokenstats
//
// API sumber hanya memberi beberapa baris terbaru per panggilan (tanpa
// pagination), jadi untuk nft & tokens baris-baris itu digabungkan ke
// riwayat bersama di Netlify Blobs (lihat _history.mjs) — halaman yang
// baru dibuka langsung menerima riwayat panjang, bukan cuma 3 baris.
import { mergeHistory } from "./_history.mjs";

const UPSTREAM = {
  nft: "https://ai.koncet.xyz/api/pulse/feed?limit=60",
  tokens: "https://ai.koncet.xyz/api/tokens/feed?limit=80",
  contracts: "https://ai.koncet.xyz/api/pulse/contracts?limit=20",
  pulse: "https://ai.koncet.xyz/api/pulse",
  tokenstats: "https://ai.koncet.xyz/api/tokens/stats",
};

export async function fetchUpstream(type) {
  const r = await fetch(UPSTREAM[type], { headers: { "user-agent": "agentic-mint-tracker-netlify/1.3" } });
  if (!r.ok) throw new Error("upstream " + r.status);
  return r.json();
}

export default async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "nft";
  if (!UPSTREAM[type]) {
    return Response.json({ error: "unknown type" }, { status: 400 });
  }
  try {
    const data = await fetchUpstream(type);
    let body = data;
    if ((type === "nft" || type === "tokens") && Array.isArray(data)) {
      body = await mergeHistory(type, data);
    }
    return new Response(JSON.stringify(body), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Cache tepi Netlify: polling 5 detik dari banyak tab berbagi satu
        // panggilan fungsi + satu ambilan ke sumber selama 5 detik.
        "Netlify-CDN-Cache-Control": "public, max-age=5, stale-while-revalidate=10",
        "Cache-Control": "public, max-age=5",
      },
    });
  } catch (e) {
    return Response.json({ error: "upstream fetch failed", detail: String(e) }, { status: 502 });
  }
};

export const config = { path: "/api/feed" };
