// Vercel Edge Function: baca data OwnTracker dari repo GitHub ini sendiri.
// Indexer OwnTracker (di mesin Muse) menerbitkan data ke folder data/ repo
// Tracker-Agentic-Mint tiap ±30 detik; file dibaca lewat raw.githubusercontent
// (cache CDN GitHub ±5 menit — halaman mengakumulasi baris, jadi tetap hidup).
// Tidak ada lagi ketergantungan ke ai.koncet.xyz.
const RAW = "https://raw.githubusercontent.com/avarhman-coder/Tracker-Agentic-Mint/main/data";
const FILES = {
  nft: "nft.json",
  tokens: "tokens.json",
  contracts: "contracts.json",
  pulse: "pulse.json",
  tokenstats: "tokenstats.json",
};

export default async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "nft";
  if (!FILES[type]) {
    return Response.json({ error: "unknown type" }, { status: 400 });
  }
  try {
    const bucket = Math.floor(Date.now() / 60000); // penembus cache CDN raw per menit
    const r = await fetch(RAW + "/" + FILES[type] + "?v=" + bucket, { headers: { "user-agent": "agentic-mint-tracker-v9-github/1.0" } });
    if (!r.ok) throw new Error("github raw " + r.status);
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (e) {
    return Response.json({ error: "github data fetch failed", detail: String(e) }, { status: 502 });
  }
};

export const config = { runtime: "edge" };
