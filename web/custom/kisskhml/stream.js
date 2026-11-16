"use strict";
const BASE = "https://kisskh.ml";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36" };
exports.getStream = async ({ link, providerContext }) => {
  const r = await providerContext.axios.get(link, { headers: H }); const $ = providerContext.cheerio.load(r.data || ""); const urls = [];
  $("iframe").each((_, f) => { const s = $(f).attr("src") || $(f).attr("data-src"); if (s) urls.push(s); });
  $("select.mirror option[value]").each((_, o) => {
    const v = $(o).attr("value"); if (!v) return;
    try { const dec = typeof atob === "function" ? atob(v) : Buffer.from(v, "base64").toString(); const m = /src=["']([^"']+)/.exec(dec); if (m) urls.push(m[1]); } catch (e) {}
  });
  const out = [], seen = new Set();
  for (let u of urls) {
    if (u.startsWith("//")) u = "https:" + u; if (!/^https?:/.test(u) || seen.has(u)) continue; seen.add(u);
    let host = ""; try { host = new URL(u).hostname; } catch (e) {}
    out.push({ server: host || "embed", link: u, type: "iframe" });
  }
  return out;
};
