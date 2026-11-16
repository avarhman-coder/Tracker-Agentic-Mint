// Vercel Edge Function: snapshot holder token untuk Agentic Mint Tracker.
//
// Data snapshot (daftar holder + minter awal yang sudah keluar) diterbitkan
// ke branch "data" repo GitHub di data/holders/<alamat-token>.json oleh
// pemindai holder (scan_holders.py + early_minters.py di workspace Muse).
// Dibaca lewat GitHub API dengan token (env GITHUB_TOKEN); tanpa token, raw
// dengan penembus cache per menit — pola yang sama dengan api/feed.js.
const REPO = "avarhman-coder/Tracker-Agentic-Mint";
const RAW = "https://raw.githubusercontent.com/" + REPO + "/data/data/holders";
const MEMO = {};

function jsonResponse(body, status) {
  return new Response(body, {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function fromGitHub(addr, token) {
  let r;
  if (token) {
    r = await fetch("https://api.github.com/repos/" + REPO + "/contents/data/holders/" + addr + ".json?ref=data", {
      headers: {
        "authorization": "Bearer " + token,
        "accept": "application/vnd.github.raw+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "agentic-mint-tracker-holders/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });
  } else {
    const bucket = Math.floor(Date.now() / 60000);
    r = await fetch(RAW + "/" + addr + ".json?v=" + bucket, {
      headers: { "user-agent": "agentic-mint-tracker-holders/1.0" },
      signal: AbortSignal.timeout(8000),
    });
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("github " + r.status);
  return await r.text();
}

export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const addr = (url.searchParams.get("token") || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    return jsonResponse(JSON.stringify({ error: "alamat token tidak valid" }), 400);
  }
  const now = Date.now();
  const hit = MEMO[addr];
  if (hit && now - hit.at < 60000) return jsonResponse(hit.body);
  try {
    const body = await fromGitHub(addr, process.env.GITHUB_TOKEN);
    if (body === null) {
      return jsonResponse(JSON.stringify({ error: "belum ada snapshot holder untuk token ini" }), 404);
    }
    MEMO[addr] = { at: now, body };
    return jsonResponse(body);
  } catch (e) {
    return jsonResponse(JSON.stringify({ error: "gagal memuat snapshot: " + e.message }), 502);
  }
}
