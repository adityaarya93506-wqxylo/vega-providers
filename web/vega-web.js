// vega-web.js — run Vega providers in any web page / JS app, using your Cloudflare Worker as proxy.
// Usage (browser):
//   import { createVega } from "https://cdn.jsdelivr.net/gh/adityaarya93506-wqxylo/vega-providers@main/web/vega-web.js";
//   const vega = await createVega({ worker: "https://YOUR-WORKER.workers.dev" });
//   const posts = await vega.getPosts("1flex", { page: 1 });
const DEFAULT_BASE = "https://cdn.jsdelivr.net/gh/adityaarya93506-wqxylo/vega-providers@main";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
// Same list as the worker's ALLOWED_HEADERS
const ALLOWED = new Set(["user-agent", "referer", "origin", "accept", "accept-language", "cookie", "authorization", "x-requested-with", "x-api-key", "content-type"]);

const DEFAULT_CUSTOM = "https://raw.githubusercontent.com/adityaarya93506-wqxylo/vega-providers/main/web/custom"; // our own providers (no upstream conflicts)
const URLS_UPSTREAM = "https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json";
// Our own domain overrides live in web/urls-override.json, so upstream files stay untouched (no sync conflicts)
const OVERRIDES_URL = "https://raw.githubusercontent.com/adityaarya93506-wqxylo/vega-providers/main/web/urls-override.json";

const b64u = (obj) =>
  btoa(JSON.stringify(obj).replace(/[\u0080-\uFFFF]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function pickHeaders(h) {
  const src = h && typeof h.toJSON === "function" ? h.toJSON() : h || {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const key = k.toLowerCase();
    if (ALLOWED.has(key) && typeof v === "string" && v) out[key] = v;
  }
  return out;
}

export function proxyUrl(worker, target, headers) {
  const h = pickHeaders(headers);
  return `${worker}/api/proxy?url=${encodeURIComponent(target)}` + (Object.keys(h).length ? `&headers=${b64u(h)}` : "");
}

// allowPost: set true only after your worker supports POST on /api/proxy (see README)
export async function createVega({ worker, base = DEFAULT_BASE, axios, cheerio, allowPost = false, customBase = DEFAULT_CUSTOM } = {}) {
  if (!worker) throw new Error("createVega: `worker` URL is required");
  worker = worker.replace(/\/+$/, "");
  base = base.replace(/\/+$/, "");
  axios = axios || (await import("https://esm.sh/axios@1.10.0")).default;
  cheerio = cheerio || (await import("https://esm.sh/cheerio@1.1.0"));
  const nativeFetch = globalThis.fetch.bind(globalThis);
  customBase = customBase.replace(/\/+$/, "");
  let customList;
  const customProviders = () => (customList = customList || nativeFetch(customBase + "/manifest.json").then((r) => (r.ok ? r.json() : [])).catch(() => []));
  // upstream urls.json + our overrides (cached 10 min)
  let urlsCache;
  const mergedUrls = () => {
    if (!urlsCache || Date.now() - urlsCache.t > 600000) {
      urlsCache = { t: Date.now(), p: (async () => {
        const j = (u) => nativeFetch(u).then((r) => r.json()).catch(() => ({}));
        const [a, b] = await Promise.all([j(URLS_UPSTREAM), j(OVERRIDES_URL)]);
        const out = { ...a };
        for (const [k, v] of Object.entries(b)) out[k] = { ...(a[k] || { name: k }), ...v };
        return out;
      })() };
    }
    return urlsCache.p;
  };

  const onlyGet = (method, url) => {
    const ok = /^(GET|HEAD)$/i.test(method) || (allowPost && /^POST$/i.test(method));
    if (!ok) throw new Error(`Worker proxy supports only GET/HEAD${allowPost ? "/POST" : ""}, got ${method.toUpperCase()} (${url})`);
  };

  // fetch() that provider code sees — everything goes through the worker
  const proxiedFetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url || String(input);
    if (url === URLS_UPSTREAM) return new Response(JSON.stringify(await mergedUrls()), { status: 200, headers: { "content-type": "application/json" } });
    const method = (init.method || "GET").toUpperCase();
    onlyGet(method, url);
    const hdrs = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init.headers;
    return nativeFetch(proxyUrl(worker, url, hdrs), { method, signal: init.signal, ...(method === "POST" ? { body: init.body } : {}) });
  };

  // axios instance that sends every request through the worker
  const inst = axios.create({
    adapter: async (config) => {
      const method = (config.method || "get").toUpperCase();
      const target = axios.getUri(config);
      if (target === URLS_UPSTREAM) return { data: JSON.stringify(await mergedUrls()), status: 200, statusText: "OK", headers: { "content-type": "application/json" }, config, request: {} };
      onlyGet(method, target);
      const res = await nativeFetch(proxyUrl(worker, target, config.headers), { method, signal: config.signal, ...(method === "POST" ? { body: config.data } : {}) });
      const binary = config.responseType === "arraybuffer" || config.responseType === "blob";
      const data = binary ? await res.arrayBuffer() : await res.text();
      const response = {
        data, status: res.status, statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()), config, request: {},
      };
      const ok = config.validateStatus ? config.validateStatus(res.status) : res.status >= 200 && res.status < 300;
      if (ok) return response;
      throw new axios.AxiosError(`Request failed with status code ${res.status}`, "ERR_BAD_RESPONSE", config, {}, response);
    },
  });
  for (const k of ["isAxiosError", "isCancel", "CancelToken", "AxiosError", "all", "spread"]) inst[k] = axios[k];

  const mem = new Map();
  const ls = globalThis.localStorage;
  const kvStore = {
    get: async (k) => { try { const v = ls ? ls.getItem("vega:" + k) : mem.get(k); return v == null ? undefined : ls ? JSON.parse(v) : v; } catch { return undefined; } },
    set: async (k, v) => { ls ? ls.setItem("vega:" + k, JSON.stringify(v)) : mem.set(k, v); },
    delete: async (k) => { const had = (await kvStore.get(k)) !== undefined; ls ? ls.removeItem("vega:" + k) : mem.delete(k); return had; },
    keys: async () => (ls ? Object.keys(ls).filter((k) => k.startsWith("vega:")).map((k) => k.slice(5)) : [...mem.keys()]),
    clear: async () => { for (const k of await kvStore.keys()) await kvStore.delete(k); },
  };

  const providerContext = {
    axios: inst, cheerio, Aes: {},
    commonHeaders: { "User-Agent": UA },
    kvStore,
    getCookies: async () => ({}),
    openWebView: async () => { throw new Error("openWebView (browser challenge) is not supported on web"); },
  };

  const cache = new Map();
  async function load(provider, name) {
    const key = provider + "/" + name;
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      const isCustom = (await customProviders()).some((p) => p.value === provider);
      const res = await nativeFetch(`${isCustom ? customBase : base + "/dist"}/${provider}/${name}.js`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Cannot load ${key}: HTTP ${res.status}`);
      const code = await res.text();
      const module = { exports: {} };
      const req = (id) => {
        if (id === "axios") return inst;
        if (id === "cheerio") return cheerio;
        throw new Error(`Provider "${provider}" needs Node module "${id}", not available on web`);
      };
      new Function("exports", "module", "require", "fetch", "process", code)(
        module.exports, module, req, proxiedFetch, { env: {}, versions: {}, platform: "browser" });
      return module.exports;
    })();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    return p;
  }
  const need = async (provider, name) => {
    const m = await load(provider, name);
    if (!m) throw new Error(`Provider "${provider}" has no ${name} module`);
    return m;
  };
  const list = async (v) => (typeof v === "function" ? v({ providerContext }) : v) || [];

  return {
    providerContext,
    proxyUrl: (u, h) => proxyUrl(worker, u, h),
    async providers() {
      const res = await nativeFetch(`${base}/manifest.json`);
      const up = await res.json();
      return [...up, ...(await customProviders())].filter((p) => !p.disabled);
    },
    async catalog(provider) {
      const m = await need(provider, "catalog");
      return { catalog: await list(m.catalog), genres: await list(m.genres) };
    },
    async getPosts(provider, { filter = "", page = 1, signal } = {}) {
      return (await need(provider, "posts")).getPosts({ filter, page, providerValue: provider, signal, providerContext });
    },
    async getMeta(provider, link) {
      return (await need(provider, "meta")).getMeta({ link, provider, providerContext });
    },
    async getEpisodes(provider, url) {
      return (await need(provider, "episodes")).getEpisodes({ url, providerContext });
    },
    async getStream(provider, link, type = "movie", { signal, isDownload } = {}) {
      const streams = await (await need(provider, "stream")).getStream({ link, type, signal, providerContext, isDownload });
      // playUrl = URL to give your <video>/hls.js player (goes through the worker)
      return streams.map((s) => ({ ...s, playUrl: s.type === "embed" || s.type === "iframe" ? s.link : proxyUrl(worker, s.link, s.headers) }));
    },
  };
}

if (typeof window !== "undefined") window.VegaWeb = { createVega, proxyUrl };
