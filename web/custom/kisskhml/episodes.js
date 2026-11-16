"use strict";
const BASE = "https://kisskh.ml";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36" };
exports.getEpisodes = async ({ url, providerContext }) => {
  const r = await providerContext.axios.get(url, { headers: H }); const $ = providerContext.cheerio.load(r.data || ""); const eps = [];
  $("li[data-index]").each((_, li) => {
    const href = $(li).find("a").first().attr("href"); if (!href) return;
    const num = $(li).find(".epl-num").text().trim(); const t = $(li).find(".epl-title").text().trim();
    eps.push({ title: num ? "Episode " + num : t, link: href });
  });
  return eps.reverse();
};
