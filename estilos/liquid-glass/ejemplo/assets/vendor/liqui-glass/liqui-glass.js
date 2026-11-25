/* liqui-glass (vanilla) — port de la TÉCNICA del kernel de liqui-design (packages/glass/src:
   LiquiGlass.tsx + filterRegistry.ts + glass.css), MIT © 2026 Fan Li — ver LICENSE en esta carpeta.
   Origen: github.com/…/liqui-design @ 50f38714ba8e668917541f0c6f8f19f22592dc52 (2026-09-21).
   Qué se porta (sin React, sin tokens/tema):
     · LUT del perfil de superficie (Snell n=1.5 sobre una losa de altura h(t)) → magnitud de refracción en el bisel
     · mapa de desplazamiento en canvas: SDF de rectángulo redondeado, R = dx, B = dy, 128 neutro (muestrea hacia dentro)
     · imagen especular del rim (luz principal arriba-izquierda, contraluz abajo-derecha, banda gaussiana en el bisel)
     · <filter> SVG global: feImage(mapa) + feDisplacementMap, referenciado con backdrop-filter: url(#id)
     · capas separadas: A = blur+saturate, B = solo desplazamiento (así el blur no depende del decode del feImage),
       tinte, especular y "shine" (inset shadows)
   Cambios para vídeo determinista: los filtros y mapas se generan SINCRÓNICAMENTE al cargar el script y la imagen del
   mapa se precarga como <img> en el DOM, para que el decode ocurra antes del primer frame capturado; sin fade-in. */
(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LUT_SIZE = 128;
  const lutCache = {};
  function surfaceLUT(profile) {
    if (lutCache[profile]) return lutCache[profile];
    const mag = new Float32Array(LUT_SIZE);
    const n = 1.5, T = 0.6;
    const h = profile === "squircle" ? (t) => Math.pow(1 - Math.pow(1 - t, 4), 0.25)
      : profile === "convex" ? (t) => Math.sqrt(1 - (1 - t) * (1 - t)) : (t) => 1 - (1 - t) * (1 - t);
    const eps = 1 / 1024; let max = 0;
    for (let i = 0; i < LUT_SIZE; i++) {
      const t = Math.max(i / (LUT_SIZE - 1), eps);
      const hi = Math.min(t + eps, 1), lo = Math.max(t - eps, 0);
      const slope = ((h(hi) - h(lo)) / (hi - lo)) * T;
      const thetaI = Math.atan(Math.abs(slope));
      const delta = thetaI - Math.asin(Math.sin(thetaI) / n);
      mag[i] = h(t) * T * Math.tan(delta); max = Math.max(max, mag[i]);
    }
    if (max > 0) for (let i = 0; i < LUT_SIZE; i++) mag[i] /= max;
    return (lutCache[profile] = mag);
  }
  const THETA_KEY = Math.atan2(-0.9, -0.45), THETA_COUNTER = Math.atan2(0.9, 0.5);

  function glassImages(W, H, radius, bezel, profile) {
    const scale = W * H > 32000 ? 0.5 : 1;
    const w = Math.ceil(W * scale), h = Math.ceil(H * scale), r0 = radius * scale, bz = bezel * scale;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const s = document.createElement("canvas"); s.width = w; s.height = h;
    const cx = c.getContext("2d"), sx = s.getContext("2d");
    const img = cx.createImageData(w, h), spec = sx.createImageData(w, h);
    const d8 = img.data, s8 = spec.data, lut = surfaceLUT(profile);
    const r = Math.min(r0, w / 2, h / 2), bx = w / 2 - r, by = h / 2 - r;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - bx, qy = Math.abs(py) - by;
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const L = Math.hypot(qx, qy) || 1; nx = (Math.sign(px) * qx) / L; ny = (Math.sign(py) * qy) / L; }
      else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
      const d = -sd / bz, inRim = d < 1 && d >= 0;
      const m = inRim ? lut[Math.min(Math.round(d * (LUT_SIZE - 1)), LUT_SIZE - 1)] : 0;
      const i = (y * w + x) * 4;
      d8[i] = Math.round(128 - nx * m * 127); d8[i + 1] = 128; d8[i + 2] = Math.round(128 - ny * m * 127); d8[i + 3] = 255;
      if (inRim) {
        const th = Math.atan2(py, px), band = Math.exp(-(((d - 0.2) / 0.4) ** 2));
        const c1 = Math.max(Math.cos(th - THETA_KEY), 0), c2 = Math.max(Math.cos(th - THETA_COUNTER), 0);
        const it = Math.min(band * (1.15 * c1 ** 3 + 0.75 * c2 ** 3.5), 1);
        s8[i] = s8[i + 1] = s8[i + 2] = 255; s8[i + 3] = Math.round(it * 255);
      }
    }
    cx.putImageData(img, 0, 0); sx.putImageData(spec, 0, 0);
    return { map: c.toDataURL(), specular: s.toDataURL() };
  }

  let host = null, nextId = 0;
  function ensureHost() {
    if (host) return host;
    host = document.createElementNS(SVG_NS, "svg");
    host.setAttribute("width", "0"); host.setAttribute("height", "0"); host.setAttribute("aria-hidden", "true");
    host.style.position = "absolute"; host.style.pointerEvents = "none";
    document.body.appendChild(host); return host;
  }
  function el(name, attrs) { const n = document.createElementNS(SVG_NS, name); for (const k in attrs) n.setAttribute(k, String(attrs[k])); return n; }
  const warm = [];
  function makeFilter(w, h, mapHref, refraction) {
    const id = "lq-refract-" + nextId++;
    const f = el("filter", { id, x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
    const im = el("feImage", { x: 0, y: 0, width: w, height: h, result: "map", preserveAspectRatio: "none" });
    im.setAttribute("href", mapHref); f.appendChild(im);
    f.appendChild(el("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: refraction, xChannelSelector: "R", yChannelSelector: "B" }));
    ensureHost().appendChild(f);
    // precarga del mapa como <img> real: el decode ocurre antes del primer frame (determinismo del render)
    const pre = new Image(); pre.src = mapHref; pre.style.cssText = "position:absolute;left:-9999px;width:4px;height:4px;opacity:0";
    document.body.appendChild(pre); warm.push(pre);
    return id;
  }

  /* Monta las capas del cristal DENTRO de `node` (que debe tener tamaño fijo en px y position relative/absolute).
     opts: { w, h, radius, bezel, refraction, blur, saturation, tint, tintDeep, specular, profile } */
  function mount(node, o) {
    const w = o.w, h = o.h, profile = o.profile || "squircle";
    const imgs = glassImages(w, h, o.radius, o.bezel, profile);
    const id = makeFilter(w, h, imgs.map, o.refraction);
    node.classList.add("lq");
    node.style.setProperty("--lq-radius", o.radius + "px");
    const mk = (cls, style) => { const s = document.createElement("span"); s.className = cls; Object.assign(s.style, style || {}); node.insertBefore(s, node.firstChild); return s; };
    // orden de inserción inverso (insertBefore firstChild): shine, specular, tint, refract, backdrop
    mk("lq-shine");
    if (o.specular > 0) mk("lq-specular", { backgroundImage: "url(" + imgs.specular + ")", opacity: o.specular });
    mk("lq-tint", { background: "linear-gradient(135deg," + (o.tint || "rgba(255,255,255,0.14)") + "," + (o.tintDeep || "rgba(255,255,255,0.04)") + ")" });
    mk("lq-refract", { backdropFilter: "url(#" + id + ")", webkitBackdropFilter: "url(#" + id + ")" });
    mk("lq-backdrop", { backdropFilter: "blur(" + (o.blur || 1) + "px) saturate(" + (o.saturation || 1.5) + ")", webkitBackdropFilter: "blur(" + (o.blur || 1) + "px) saturate(" + (o.saturation || 1.5) + ")" });
    return id;
  }
  window.LiquiGlass = { mount, glassImages };
})();
