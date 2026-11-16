"use strict";
const BASE = "https://kisskh.ml";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36" };
function parse($) {
  const out = [], seen = new Set();
  $("article.bs").each((_, el) => {
    const a = $(el).find("a[href]").first(); const link = a.attr("href");
    if (!link || seen.has(link)) return; seen.add(link);
    const img = $(el).find("img").first(); const image = img.attr("data-src") || img.attr("src") || "";
    out.push({ title: (a.attr("title") || $(el).find(".tt").text() || "").trim(), link, image: image.startsWith("data:") ? "" : image });
  });
  return out;
}
async function load(url, ctx, signal) { const r = await ctx.axios.get(url, { headers: H, signal }); return ctx.cheerio.load(r.data || ""); }
exports.getPosts = async ({ filter, page = 1, signal, providerContext }) => {
  try { return parse(await load(BASE + (filter === "series" ? "/series/" : "/") + (page > 1 ? "page/" + page + "/" : ""), providerContext, signal)); } catch (e) { return []; }
};
exports.getSearchPosts = async ({ searchQuery, page = 1, signal, providerContext }) => {
  try { return parse(await load(BASE + "/?s=" + encodeURIComponent(searchQuery) + (page > 1 ? "&paged=" + page : ""), providerContext, signal)); } catch (e) { return []; }
};
