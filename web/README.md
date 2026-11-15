# vega-web

Vega providers ko kisi bhi website / JS app mein chalane ke liye (Cloudflare Worker proxy ke saath).

```html
<script type="module">
  import { createVega } from "https://cdn.jsdelivr.net/gh/adityaarya93506-wqxylo/vega-providers@main/web/vega-web.js";
  const vega = await createVega({ worker: "https://YOUR-WORKER.workers.dev" });
  const { catalog } = await vega.catalog("anikoto");
  const posts = await vega.getPosts("anikoto", { filter: catalog[0].filter, page: 1 });
  const meta = await vega.getMeta("anikoto", posts[0].link);
  // meta.linkList[..].episodesLink -> vega.getEpisodes(...), directLinks[..].link -> vega.getStream(...)
  // stream.playUrl ko hls.js / <video> mein do
</script>
```

API: `providers()`, `catalog(p)`, `getPosts(p,{filter,page})`, `getMeta(p,link)`, `getEpisodes(p,url)`, `getStream(p,link,type)`.

Worker ko `/api/proxy?url=<target>&headers=<base64url json>` support karna chahiye (GET/HEAD only).

## Limits
- `openWebView` (browser challenge) web par nahi chalta.
- Worker sirf GET/HEAD proxy karta hai, POST wale requests fail honge.
- Kuch sites Cloudflare worker IPs ko block karti hain (403).
