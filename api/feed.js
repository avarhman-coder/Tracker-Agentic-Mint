// Vercel Edge Function: data OwnTracker untuk Agentic Mint Tracker.
//
// Jalur utama: indexer OwnTracker di VPS PakaiCloud (tracker-01) lewat HTTP
// langsung — data berumur detik, tanpa perantara commit GitHub.
// Cadangan: branch "data" repo GitHub (diterbitkan indexer cadangan tiap
// ±10 detik) dibaca lewat GitHub API dengan token (env GITHUB_TOKEN) karena
// respons API terautentikasi tidak ditahan CDN; tanpa token, raw dengan
// penembus cache per menit.
const REPO = "avarhman-coder/Tracker-Agentic-Mint";
const RAW = "https://raw.githubusercontent.com/" + REPO + "/data/data";
const VPS = "http://31.58.103.91:8787";
const MEMO = {};
const FILES = {
  nft: "nft.json",
  tokens: "tokens.json",
  contracts: "contracts.json",
  pulse: "pulse.json",
  tokenstats: "tokenstats.json",
};
const VPS_PATHS = {
  nft: "/api/pulse/feed",
  tokens: "/api/tokens/feed",
  contracts: "/api/pulse/contracts",
  pulse: "/api/pulse",
  tokenstats: "/api/tokens/stats",
};

function jsonResponse(body) {
  return new Response(body, {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function fromVPS(type) {
  const r = await fetch(VPS + VPS_PATHS[type], {
    headers: { "user-agent": "agentic-mint-tracker-v10-vps/1.0" },
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) throw new Error("vps " + r.status);
  return JSON.stringify(await r.json());
}

async function fromGitHub(type, token) {
  let r;
  if (token) {
    r = await fetch("https://api.github.com/repos/" + REPO + "/contents/data/" + FILES[type] + "?ref=data", {
      headers: {
        "authorization": "Bearer " + token,
        "accept": "application/vnd.github.raw+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "agentic-mint-tracker-v10-vps/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });
  } else {
    const bucket = Math.floor(Date.now() / 60000);
    r = await fetch(RAW + "/" + FILES[type] + "?v=" + bucket, {
      headers: { "user-agent": "agentic-mint-tracker-v10-vps/1.0" },
      signal: AbortSignal.timeout(5000),
    });
  }
  if (!r.ok) throw new Error("github " + r.status);
  return JSON.stringify(await r.json());
}

export default async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "nft";
  if (!FILES[type]) {
    return Response.json({ error: "unknown type" }, { status: 400 });
  }
  // Memo 8 detik per isolate: memangkas panggilan keluar dari polling
  // halaman (5 dtk) dan melindungi kuota API GitHub jalur cadangan.
  const now = Date.now();
  const hit = MEMO[type];
  if (hit && now - hit.at < 8000) {
    return jsonResponse(hit.body);
  }
  let body = null;
  try {
    body = await fromVPS(type);
  } catch (e) {
    try {
      body = await fromGitHub(type, process.env.GITHUB_TOKEN);
    } catch (e2) {
      return Response.json({ error: "data fetch failed", detail: String(e2) }, { status: 502 });
    }
  }
  MEMO[type] = { at: Date.now(), body };
  return jsonResponse(body);
};

export const config = { runtime: "edge" };
