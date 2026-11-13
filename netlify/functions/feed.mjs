// Netlify Function: baca data OwnTracker dari folder data/ repo GitHub ini sendiri
// Dipanggil halaman sebagai /api/feed?type=nft|tokens|contracts|pulse|tokenstats
//
// API sumber hanya memberi beberapa baris terbaru per panggilan (tanpa
// pagination), jadi untuk nft & tokens baris-baris itu digabungkan ke
// riwayat bersama di Netlify Blobs (lihat _history.mjs) — halaman yang
// baru dibuka langsung menerima riwayat panjang, bukan cuma 3 baris.
import { mergeHistory } from "./_history.mjs";

// v9: sumber = file data/ di repo GitHub ini sendiri (diterbitkan OwnTracker).
const RAW = "https://raw.githubusercontent.com/avarhman-coder/Tracker-Agentic-Mint/main/data";
const UPSTREAM = {
  nft: RAW + "/nft.json",
  tokens: RAW + "/tokens.json",
  contracts: RAW + "/contracts.json",
  pulse: RAW + "/pulse.json",
  tokenstats: RAW + "/tokenstats.json",
};

export async function fetchUpstream(type) {
  const bucket = Math.floor(Date.now() / 60000); // penembus cache CDN raw per menit
  const r = await fetch(UPSTREAM[type] + "?v=" + bucket, { headers: { "user-agent": "agentic-mint-tracker-netlify/1.3" } });
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
        "Netlify-CDN-Cache-Control": "no-store",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: "upstream fetch failed", detail: String(e) }, { status: 502 });
  }
};

export const config = { path: "/api/feed" };
