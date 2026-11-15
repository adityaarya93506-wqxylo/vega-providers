# vega-web

Vega providers ko kisi bhi website / JS app mein chalane ke liye (Cloudflare Worker proxy ke saath).

```html
<script type="module">
  import { createVega } from "https://cdn.jsdelivr.net/gh/adityaarya93506-wqxylo/vega-providers@main/web/vega-web.js";
  const vega = await createVega({ worker: "https://YOUR-WORKER.workers.dev" /*, allowPost: true */ });
  const { catalog } = await vega.catalog("anikoto");
  const posts = await vega.getPosts("anikoto", { filter: catalog[0].filter, page: 1 });
  const meta = await vega.getMeta("anikoto", posts[0].link);
  // meta.linkList[..].episodesLink -> vega.getEpisodes(...), directLinks[..].link -> vega.getStream(...)
  // stream.playUrl ko hls.js / <video> mein do
</script>
```

API: `providers()`, `catalog(p)`, `getPosts(p,{filter,page})`, `getMeta(p,link)`, `getEpisodes(p,url)`, `getStream(p,link,type)`.

## Worker
`/api/proxy?url=<target>&headers=<base64url json>` chahiye. Default worker sirf GET/HEAD karta hai.
Kai providers (castle, uhd, mod, 1flex, autoEmbed ...) POST use karte hain. POST ke liye worker mein 4 chhote badlav karo, phir `allowPost: true` do:

1. `ALLOWED_HEADERS` mein `"content-type"` add karo.
2. `CORS` mein `"Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS"`.
3. `/api/proxy` mein `fetchOpts` banane wali line ko aise badlo:
```js
const isPost = request.method === "POST";
const fetchOpts = { method: request.method === "HEAD" ? "HEAD" : isPost ? "POST" : "GET", headers, redirect: "follow" };
if (isPost) fetchOpts.body = await request.arrayBuffer();
```
4. Uske neeche `if (request.method !== "HEAD") {` ko `if (request.method !== "HEAD" && !isPost) {` karo (POST ko edge-cache nahi karna).

## Limits
- `openWebView` (browser challenge) web par nahi chalta.
- Kuch sites Cloudflare worker IPs ko block karti hain (403/429).
