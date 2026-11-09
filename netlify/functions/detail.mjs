// Netlify Function: identifikasi proyek untuk satu alamat kontrak/token BSC.
// Dipanggil halaman sebagai /api/detail?address=0x...&tokenId=123 (tokenId opsional)
//
// Tangga identifikasi (dari yang paling otoritatif):
// 1) On-chain langsung dari kontrak proyek itu sendiri:
//    name(), symbol(), dan metadata NFT tokenURI() — nama resmi, deskripsi
//    proyek menurut kontraknya, gambar, dan external_url bila dicantumkan.
//    Ini satu-satunya sumber yang selalu ada sejak mint pertama.
// 2) GeckoTerminal /info + DexScreener: website, Twitter/X, Telegram, Discord.
//    Sumber ini baru mengenal proyek setelah ada pool / terindeks, jadi untuk
//    mint yang sangat baru hasilnya bisa kosong — itu jujur ditampilkan.
// 3) Profil token DexScreener terbaru (token-profiles) bila alamatnya cocok.
//
// Kalau ketiga sumber tidak memberi tautan, panel di halaman menampilkan
// tautan pencarian berdasarkan alamat kontrak supaya tetap bisa ditelusuri.

const RPCS = [
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
];

async function rpcCall(to, data) {
  for (const u of RPCS) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(u, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const j = await r.json();
      if (j && j.result && j.result !== "0x") return j.result;
    } catch { /* coba RPC berikutnya */ }
  }
  return null;
}

function decodeString(hex) {
  if (!hex || hex === "0x") return null;
  const h = hex.slice(2);
  try {
    if (h.length >= 128) {
      const len = parseInt(h.slice(64, 128), 16);
      let s = "";
      for (let i = 0; i < len; i++) s += String.fromCharCode(parseInt(h.slice(128 + i * 2, 130 + i * 2), 16));
      return s;
    }
    // bytes32-style
    let s = "";
    for (let i = 0; i < h.length; i += 2) { const c = parseInt(h.slice(i, i + 2), 16); if (c) s += String.fromCharCode(c); }
    return s || null;
  } catch { return null; }
}

const padU = (n) => BigInt(n).toString(16).padStart(64, "0");
const SEL = { name: "0x06fdde03", symbol: "0x95d89b41", tokenURI: "0xc87b56dd" };

async function fetchJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "agentic-mint-tracker-netlify/1.1" }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

async function resolveMetadata(uri) {
  if (!uri) return null;
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      return JSON.parse(Buffer.from(uri.slice("data:application/json;base64,".length), "base64").toString("utf8"));
    }
    if (uri.startsWith("data:application/json,")) {
      return JSON.parse(decodeURIComponent(uri.slice("data:application/json,".length)));
    }
    let url = uri;
    if (url.startsWith("ipfs://")) url = "https://ipfs.io/ipfs/" + url.slice(7);
    if (url.startsWith("http")) return await fetchJson(url);
  } catch { /* metadata tidak terbaca */ }
  return null;
}

export default async (req) => {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").trim().toLowerCase();
  const tokenIdParam = url.searchParams.get("tokenId");
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return Response.json({ error: "bad address" }, { status: 400 });
  }
  const out = {
    address, name: null, symbol: null, description: null, price_usd: null,
    image_url: null, websites: [], twitter: null, telegram: null, discord: null,
    sources: [], found_links: false,
  };
  const pushSite = (u) => { if (u && !out.websites.includes(u)) out.websites.push(u); };
  const noteSource = (s) => { if (!out.sources.includes(s)) out.sources.push(s); };

  // --- 1) On-chain: nama/symbol resmi dari kontrak
  const [nm, sm] = await Promise.all([rpcCall(address, SEL.name), rpcCall(address, SEL.symbol)]);
  if (nm) { out.name = decodeString(nm) || out.name; if (out.name) noteSource("on-chain"); }
  if (sm) { out.symbol = decodeString(sm) || out.symbol; if (out.symbol) noteSource("on-chain"); }

  // --- 1b) On-chain: metadata NFT lewat tokenURI (coba id dari klik, lalu 1, lalu 0)
  const idsToTry = [];
  if (tokenIdParam != null && /^\d+$/.test(tokenIdParam)) idsToTry.push(tokenIdParam);
  idsToTry.push("1", "0");
  for (const id of [...new Set(idsToTry)]) {
    const uriHex = await rpcCall(address, SEL.tokenURI + padU(id));
    const uri = decodeString(uriHex);
    if (!uri) continue;
    const meta = await resolveMetadata(uri);
    if (meta) {
      noteSource("metadata on-chain (tokenURI)");
      if (!out.description && meta.description) out.description = String(meta.description).slice(0, 1200);
      if (meta.external_url) pushSite(meta.external_url);
      if (meta.website) pushSite(meta.website);
      if (meta.twitter) out.twitter = out.twitter || meta.twitter;
      if (meta.image && typeof meta.image === "string") {
        out.image_url = meta.image.startsWith("ipfs://") ? "https://ipfs.io/ipfs/" + meta.image.slice(7) : meta.image;
      }
      if (!out.name && meta.name) out.name = String(meta.name).replace(/\s+#?\d+\s*$/, "");
      break;
    }
  }

  // --- 2) GeckoTerminal /info
  const gt = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${address}/info`);
  if (gt?.data?.attributes) {
    const a = gt.data.attributes;
    noteSource("GeckoTerminal");
    out.name = out.name || a.name || null;
    out.symbol = out.symbol || a.symbol || null;
    if (!out.description && a.description) out.description = a.description;
    out.image_url = out.image_url || a.image_url || null;
    (a.websites || []).forEach(pushSite);
    if (a.twitter_handle) out.twitter = out.twitter || `https://x.com/${a.twitter_handle}`;
    if (a.telegram_handle) out.telegram = out.telegram || `https://t.me/${a.telegram_handle}`;
    if (a.discord_url) out.discord = out.discord || a.discord_url;
  }
  const gtPrice = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${address}`);
  if (gtPrice?.data?.attributes?.price_usd) out.price_usd = gtPrice.data.attributes.price_usd;

  // --- 2b) DexScreener pairs info
  const ds = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
  const pair = (ds?.pairs || []).find((p) => p.chainId === "bsc") || (ds?.pairs || [])[0];
  if (pair?.info) {
    noteSource("DexScreener");
    (pair.info.websites || []).forEach((w) => pushSite(w.url || w));
    (pair.info.socials || []).forEach((s) => {
      if (!s.url) return;
      if (s.type === "twitter") out.twitter = out.twitter || s.url;
      if (s.type === "telegram") out.telegram = out.telegram || s.url;
      if (s.type === "discord") out.discord = out.discord || s.url;
    });
  }

  // --- 3) Profil token DexScreener terbaru
  const profiles = await fetchJson("https://api.dexscreener.com/token-profiles/latest/v1");
  if (Array.isArray(profiles)) {
    const prof = profiles.find((p) => p.chainId === "bsc" && (p.tokenAddress || "").toLowerCase() === address);
    if (prof) {
      noteSource("Profil DexScreener");
      if (!out.description && prof.description) out.description = prof.description;
      out.image_url = out.image_url || prof.icon || null;
      (prof.links || []).forEach((l) => {
        const u = l.url || ""; if (!u) return;
        if (l.type === "website" || l.label === "Website") pushSite(u);
        else if (l.type === "twitter") out.twitter = out.twitter || u;
        else if (l.type === "telegram") out.telegram = out.telegram || u;
        else if (l.type === "discord") out.discord = out.discord || u;
        else pushSite(u);
      });
    }
  }

  out.found_links = Boolean(out.websites.length || out.twitter || out.telegram || out.discord);
  return new Response(JSON.stringify(out), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Netlify-CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      "Cache-Control": "public, max-age=300",
    },
  });
};

export const config = { path: "/api/detail" };
