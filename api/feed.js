// Vercel Edge Function: baca data OwnTracker dari branch "data" repo GitHub ini.
// Indexer OwnTracker menerbitkan data ke branch data tiap ±1 menit.
//
// Jalur utama: GitHub API dengan token (env GITHUB_TOKEN di Vercel) — respons
// API terautentikasi TIDAK ditahan CDN, jadi selalu segar. Ini penting karena
// raw.githubusercontent terbukti menahan salinan basi khusus file besar
// (tokens.json membeku berjam-jam di beberapa wilayah).
// Cadangan tanpa token: raw.githubusercontent dari branch data + penembus
// cache per menit (bisa tertinggal beberapa menit di wilayah tertentu).
const REPO = "avarhman-coder/Tracker-Agentic-Mint";
const RAW = "https://raw.githubusercontent.com/" + REPO + "/data/data";
const MEMO = {};
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
  const token = process.env.GITHUB_TOKEN;
  // Memo 8 detik per isolate: memangkas panggilan API GitHub dari polling
  // halaman (5 dtk) supaya kuota token tidak habis dan tidak kena rate-limit.
  const now = Date.now();
  const hit = MEMO[type];
  if (hit && now - hit.at < 8000) {
    return new Response(hit.body, {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  try {
    let r;
    if (token) {
      r = await fetch("https://api.github.com/repos/" + REPO + "/contents/data/" + FILES[type] + "?ref=data", {
        headers: {
          "authorization": "Bearer " + token,
          "accept": "application/vnd.github.raw+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "agentic-mint-tracker-v9-github/2.0",
        },
      });
    } else {
      const bucket = Math.floor(Date.now() / 60000);
      r = await fetch(RAW + "/" + FILES[type] + "?v=" + bucket, { headers: { "user-agent": "agentic-mint-tracker-v9-github/2.0" } });
    }
    if (!r.ok) throw new Error("github " + r.status);
    const data = await r.json();
    const body = JSON.stringify(data);
    MEMO[type] = { at: Date.now(), body };
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: "github data fetch failed", detail: String(e) }, { status: 502 });
  }
};

export const config = { runtime: "edge" };
