// Netlify Function: daftar wallet JAGENT dari Google Sheet publik
// "JAGENT epochs 1-4" (registri wallet yang sudah mint JAGENT di jager).
// Dipanggil halaman sebagai /api/jagent saat tombol SINKRONKAN diketuk.
// Mengembalikan daftar ringkas: wallet, Agent ID, epoch, share, USDT dibayar,
// waktu mint pertama, saldo JAGENT sekarang + total ringkasannya.
const SHEET_ID = "1jcKyWK1JJ8uBchTS3p1ok18DeB7yrDb2ZDxOaNYF73Q";

export default async () => {
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`, {
      headers: { "user-agent": "agentic-mint-tracker-netlify/1.2" },
    });
    if (!r.ok) return Response.json({ error: "sheet fetch failed", status: r.status }, { status: 502 });
    const text = await r.text();
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const rows = j?.table?.rows || [];
    const wallets = [];
    let shares = 0, paid = 0, holding = 0;
    const epochs = {};
    for (const row of rows) {
      const c = row.c || [];
      const v = (i) => (c[i] && c[i].v != null ? c[i].v : null);
      const wallet = String(v(2) || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(wallet)) continue;
      const item = {
        w: wallet,
        e: v(0),
        a: v(3),
        s: v(4) || 0,
        p: v(6) || 0,
        f: v(7),
        j: v(9) || 0,
      };
      wallets.push(item);
      shares += item.s; paid += item.p;
      if (item.j > 0) holding++;
      epochs[item.e] = (epochs[item.e] || 0) + 1;
    }
    return new Response(JSON.stringify({
      synced_at: new Date().toISOString(),
      count: wallets.length,
      totals: { shares, paid_usdt: Math.round(paid * 100) / 100, holding, epochs },
      wallets,
    }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "Netlify-CDN-Cache-Control": "public, max-age=600, stale-while-revalidate=1200",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (e) {
    return Response.json({ error: "sheet parse failed", detail: String(e) }, { status: 502 });
  }
};

export const config = { runtime: "edge" };
