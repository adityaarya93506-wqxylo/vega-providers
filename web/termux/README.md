# mini-proxy (Termux / PC)

Cloudflare worker ki jagah apne phone par chalne wala proxy. Requests tumhare apne IP se jaati hain
(jaise browser se), isliye jo sites worker ko block karti hain (kisskh.do, 4khdhub, netmirror ...) wahan kaam ban sakta hai.

```bash
pkg install nodejs -y          # sirf pehli baar
curl -O https://raw.githubusercontent.com/adityaarya93506-wqxylo/vega-providers/main/web/termux/mini-proxy.cjs
node mini-proxy.cjs            # chalta rahe, band mat karna
```

Phir demo page mein **Local** button dabao (ya worker URL me `http://127.0.0.1:8787` likho) aur **Connect** karo.
POST support isme pehle se hai.
