// Adapter Cloudflare Pages Functions -> memakai handler yang sama
// dengan versi Vercel di folder /api. Cloudflare memetakan berkas ini
// ke rute /api/jagent secara otomatis.
import handler from "../../api/jagent.js";
export const onRequest = (ctx) => handler(ctx.request);
