// Netlify Scheduled Function: berjalan tiap menit, mengambil feed terbaru
// dan menggabungkannya ke riwayat bersama di Netlify Blobs — supaya
// riwayat terus bertambah walau tidak ada pengunjung yang sedang membuka
// halaman, dan halaman yang baru dibuka langsung punya daftar panjang.
import { fetchUpstream } from "./feed.mjs";
import { mergeHistory } from "./_history.mjs";

export default async () => {
  for (const type of ["nft", "tokens"]) {
    try {
      const rows = await fetchUpstream(type);
      if (Array.isArray(rows)) await mergeHistory(type, rows);
    } catch { /* sumber sesekali gagal; menit berikutnya dicoba lagi */ }
  }
  return new Response("ok");
};

export const config = { schedule: "* * * * *" };
