// Adapter Cloudflare Pages Functions -> memakai handler yang sama
// dengan versi Vercel di folder /api. Cloudflare memetakan berkas ini
// ke rute /api/detail secara otomatis.
import handler from "../../api/detail.js";
export const onRequest = (ctx) => handler(ctx.request);
