// Netlify Function: harga mint per transaksi untuk tab Token.
// Dipanggil halaman sebagai /api/mintcost?txs=0x..,0x.. (maks 25 hash).
//
// Feed token sumber tidak membawa harga, jadi biaya mint dilacak dari
// transaksi on-chain-nya sendiri:
//   1. value BNB pada tx > 0            -> BAYAR sebesar value itu (BNB)
//   2. ada Transfer USDT/USDC/BUSD/WBNB keluar dari wallet pengirim tx
//      pada receipt                       -> BAYAR sebesar transfer itu
//   3. selain itu                        -> GRATIS (hanya gas)
// Hasil per hash bersifat permanen (fakta tx tidak berubah), jadi
// respons di-cache lama di tepi Netlify dan di localStorage halaman.
const RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed4.defibit.io",
];
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const STABLES = {
  "0x55d398326f99059ff775485246999027b3197955": { sym: "USDT", dec: 18 },
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { sym: "USDC", dec: 18 },
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": { sym: "BUSD", dec: 18 },
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": { sym: "BNB", dec: 18 }, // WBNB
};

let rpcId = 1;
async function rpc(method, params) {
  let last;
  for (const u of RPCS) {
    try {
      const r = await fetch(u, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || "rpc error");
      return j.result;
    } catch (e) { last = e; }
  }
  throw last;
}

const fmtAmt = (raw, dec) => {
  const v = Number(BigInt(raw)) / 10 ** dec;
  return Number(v.toPrecision(6)).toString();
};

async function classify(hash) {
  const tx = await rpc("eth_getTransactionByHash", [hash]);
  if (!tx) return { paid: false, unknown: true };
  const value = BigInt(tx.value || "0x0");
  if (value > 0n) return { paid: true, amount: fmtAmt(value.toString(), 18), asset: "BNB" };
  const rc = await rpc("eth_getTransactionReceipt", [hash]);
  const from = (tx.from || "").toLowerCase();
  let paid = null;
  for (const log of rc?.logs || []) {
    const st = STABLES[(log.address || "").toLowerCase()];
    if (!st) continue;
    if ((log.topics?.[0] || "").toLowerCase() !== TRANSFER_TOPIC) continue;
    const lf = ("0x" + (log.topics?.[1] || "").slice(26)).toLowerCase();
    if (lf !== from) continue;
    const amt = BigInt(log.data || "0x0");
    if (amt > 0n && (!paid || amt > paid.raw)) paid = { raw: amt, st };
  }
  if (paid) return { paid: true, amount: fmtAmt(paid.raw.toString(), paid.st.dec), asset: paid.st.sym };
  return { paid: false };
}

export default async (req) => {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("txs") || "").split(",");
  const txs = [...new Set(raw.map((h) => h.trim().toLowerCase()).filter((h) => /^0x[0-9a-f]{64}$/.test(h)))].slice(0, 25);
  if (!txs.length) return Response.json({ costs: {} });
  const costs = {};
  for (let i = 0; i < txs.length; i += 5) {
    const chunk = txs.slice(i, i + 5);
    await Promise.all(chunk.map(async (h) => {
      try { costs[h] = await classify(h); } catch { costs[h] = { paid: false, unknown: true }; }
    }));
  }
  return Response.json({ costs }, { headers: { "cache-control": "public, s-maxage=86400" } });
};

export const config = { path: "/api/mintcost" };
