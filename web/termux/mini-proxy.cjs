#!/usr/bin/env node
// mini-proxy.js - local stand-in for the Cloudflare worker's /api/proxy.
// Runs on YOUR phone/PC, so requests go out with your own IP (like your browser does).
// Termux: pkg install nodejs && node mini-proxy.js   then use http://127.0.0.1:8787 as the "worker" in vega-web.
const http = require("http");
const { Readable } = require("stream");
const PORT = +process.env.PORT || 8787;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const ALLOW = new Set(["user-agent", "referer", "origin", "accept", "accept-language", "cookie", "authorization", "x-requested-with", "x-api-key", "content-type"]);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Private-Network": "true", "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type" };
const unb = (s) => { try { s = s.replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(Buffer.from(s, "base64").toString()); } catch (e) { return {}; } };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const isHls = (u, ct) => /\.m3u8(\?|$)/i.test(u) || /mpegurl/i.test(ct || "");
function rewrite(text, base, hdrs) {
  const hp = Object.keys(hdrs).length ? "&headers=" + b64u(hdrs) : "";
  const rw = (v) => { v = v.trim(); if (!v || v.startsWith("data:")) return v; let abs; try { abs = new URL(v, base).href; } catch (e) { return v; } return "/api/proxy?url=" + encodeURIComponent(abs) + hp; };
  return text.split(/\r?\n/).map((l) => { const t = l.trim(); if (!t) return l; if (t.startsWith("#")) return t.includes('URI="') ? l.replace(/URI="([^"]+)"/g, (_, u) => 'URI="' + rw(u) + '"') : l; return rw(t); }).join("\n");
}
process.on("unhandledRejection", () => {});
process.on("uncaughtException", (e) => console.error("err:", e.message));
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (u.pathname === "/") { res.writeHead(200, { ...CORS, "Content-Type": "text/plain" }); return res.end("mini-proxy ok"); }
  if (u.pathname !== "/api/proxy" && u.pathname !== "/proxy") { res.writeHead(404, CORS); return res.end("not found"); }
  const target = u.searchParams.get("url");
  if (!target) { res.writeHead(400, CORS); return res.end("Missing url"); }
  const h = { "user-agent": UA, accept: "*/*", "accept-language": "en-US,en;q=0.9" }, kept = {};
  for (const [k, v] of Object.entries(unb(u.searchParams.get("headers") || ""))) { const key = k.toLowerCase(); if (ALLOW.has(key) && typeof v === "string" && v) { h[key] = v; kept[key] = v; } }
  if (req.headers.range) h.range = req.headers.range;
  const ac = new AbortController(); res.on("close", () => ac.abort());
  const chunks = []; if (req.method === "POST") for await (const c of req) chunks.push(c);
  try {
    const r = await fetch(target, { method: req.method === "POST" ? "POST" : req.method === "HEAD" ? "HEAD" : "GET", headers: h, body: req.method === "POST" ? Buffer.concat(chunks) : undefined, redirect: "follow", signal: ac.signal });
    const ct = r.headers.get("content-type") || "", out = { ...CORS };
    if (req.method !== "HEAD" && r.ok && isHls(target, ct)) {
      const text = await r.text();
      if (text.trimStart().startsWith("#EXTM3U")) { res.writeHead(200, { ...out, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" }); return res.end(rewrite(text, r.url || target, kept)); }
      res.writeHead(r.status, { ...out, "Content-Type": ct }); return res.end(text);
    }
    for (const k of ["content-type", "content-range", "accept-ranges", "etag"]) { const v = r.headers.get(k); if (v) out[k] = v; }
    res.writeHead(r.status, out);
    if (!r.body || req.method === "HEAD") return res.end();
    Readable.fromWeb(r.body).on("error", () => res.destroy()).pipe(res);
  } catch (e) { res.writeHead(502, CORS); res.end("proxy error: " + e.message); }
}).listen(PORT, process.env.HOST || "127.0.0.1", () => console.log("mini-proxy on http://127.0.0.1:" + PORT));
