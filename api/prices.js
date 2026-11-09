// Netlify Function: harga pasar (USD) batch untuk tab Token.
// Dipanggil halaman sebagai /api/prices?addrs=0x..,0x.. (maks 30 alamat).
//
// Harga mint token tidak tersedia di feed sumber, jadi yang ditampilkan
// adalah harga PASAR per token dari DexScreener (pair berlikuiditas
// tertinggi per token) — sama sumbernya dengan panel detail proyek.
// Token yang belum punya pair/harga dikembalikan tanpa entri (-> "—").
export default async (req) => {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("addrs") || "").split(",");
  const addrs = [...new Set(raw.map((a) => a.trim().toLowerCase()).filter((a) => /^0x[0-9a-f]{40}$/.test(a)))].slice(0, 30);
  if (!addrs.length) return Response.json({ prices: {} });
  try {
    const r = await fetch("https://api.dexscreener.com/tokens/v1/bsc/" + addrs.join(","), {
      headers: { "user-agent": "agentic-mint-tracker-netlify/1.4" },
    });
    if (!r.ok) throw new Error("dexscreener " + r.status);
    const pairs = await r.json();
    const best = new Map();
    for (const p of Array.isArray(pairs) ? pairs : []) {
      const base = (p.baseToken?.address || "").toLowerCase();
      const price = Number(p.priceUsd);
      if (!base || !addrs.includes(base) || !(price > 0)) continue;
      const liq = Number(p.liquidity?.usd || 0);
      if (!best.has(base) || liq > best.get(base).liq) best.set(base, { price, liq });
    }
    const prices = {};
    for (const [a, v] of best) prices[a] = v.price;
    return Response.json({ prices }, { headers: { "cache-control": "public, s-maxage=20" } });
  } catch (e) {
    return Response.json({ prices: {}, error: String(e.message || e) }, { headers: { "cache-control": "public, s-maxage=5" } });
  }
};

export const config = { runtime: "edge" };
