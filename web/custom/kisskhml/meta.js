"use strict";
const BASE = "https://kisskh.ml";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36" };
exports.getMeta = async ({ link, providerContext }) => {
  const r = await providerContext.axios.get(link, { headers: H }); const $ = providerContext.cheerio.load(r.data || "");
  const title = $("h1").first().text().trim() || $("title").text().trim();
  const meta = { title, image: $('meta[property="og:image"]').attr("content") || "", synopsis: ($('meta[name="description"]').attr("content") || "").trim(), imdbId: "", type: "series", tags: [], cast: [], rating: "" };
  if (/\/series\//.test(link)) return { ...meta, linkList: [{ title: "Episodes", quality: "", episodesLink: link }] };
  return { ...meta, linkList: [{ title: "Episode", quality: "", directLinks: [{ title, link, type: "series" }] }] };
};
