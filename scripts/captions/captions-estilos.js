/* captions-estilos.js — captions elegibles por vídeo: 'natural' o 'premium'. Guía: modulos/captions/ESTILOS.md
 *
 * UMD sin dependencias (navegador y node). Todo es función pura de t (determinista, sin Math.random ni Date).
 *   CaptionsEstilos.componer(grupos, opciones)  → bloques   (node-safe: no toca el DOM)
 *   CaptionsEstilos.eventos(bloques, opciones)  → [{k, t, label, sfx}] dónde poner efectos (la base no suena)
 *   CaptionsEstilos.tokensDesdeCSS(documento)   → tokens leídos de las variables de marca (--fuente-*, --texto, --acento…)
 *   CaptionsEstilos.montar(cfg)                 → { update(t), bloques }   (navegador)
 *
 * Entrada común: grupos = [{ t0, t1, ws: [{ txt, s, tono }] }]  (tono: 'az' positivo | 'am' problema | null;
 *   también se aceptan 'positivo' / 'problema'). Sirve cualquier lista de palabras con tiempo agrupadas de 1 a 3.
 *
 * PREMIUM: los grupos se juntan en BLOQUES (una frase compuesta: base sobria + línea de énfasis en otra fuente, con
 * interlineado negativo), cada bloque con plantilla de layout, entrada y salida propias. Lo decide el plan:
 *   opciones.escenaDe(t) → id de escena        opciones.plan.escenas[id] = { plano, zona:[x0,y0,x1,y1], tpl:[...], ... }
 *   opciones.plan.bloques["texto normalizado del bloque"] = { tpl, roles, entrada, salida, detras, cx, cy, ... }  (override)
 */
(function (root) {
  "use strict";

  /* ------------------------------------------------------------------ utilidades puras */
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var ap = function (t, t0, d) { return d <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / d, 0, 1); };
  var E = {
    lin: function (u) { return clamp(u, 0, 1); },
    out3: function (u) { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); },
    expo: function (u) { u = clamp(u, 0, 1); return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u); },
    in2: function (u) { u = clamp(u, 0, 1); return u * u; },
    in4: function (u) { u = clamp(u, 0, 1); return u * u * u * u; },
    back: function (u) { u = clamp(u, 0, 1); var c = 1.5; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }
  };
  var norm = function (s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9% ]+/g, "").replace(/\s+/g, " ").trim(); };

  /* ------------------------------------------------------------------ tokens por defecto (NEUTROS; en un proyecto usa tokensDesdeCSS(document)) */
  var SANS = '"Helvetica Neue", Arial, sans-serif', MONO = 'Menlo, Consolas, monospace';
  var TOKENS = {
    base:     { familia: SANS, peso: 600, tam: 54, tracking: -0.01, estilo: "normal", mayus: false },
    // énfasis: el ROL decide la tipografía y el tratamiento; el COLOR lo decide el tono (az positivo / am problema)
    roles: {
      bloque:   { familia: SANS, peso: 800, tam: 104, tracking: -0.03, estilo: "normal", mayus: false, degradado: true },
      acento:   { familia: SANS, peso: 700, tam: 120, tracking: -0.01, estilo: "italic", mayus: false },
      elegante: { familia: SANS, peso: 400, tam: 116, tracking: 0, estilo: "normal", mayus: false },
      grito:    { familia: SANS, peso: 800, tam: 116, tracking: 0.01, estilo: "normal", mayus: true, degradado: true, brilloFuerte: true },
      dato:     { familia: MONO, peso: 500, tam: 46, tracking: 0.14, estilo: "normal", mayus: true }
    },
    natural: { familia: SANS, peso: 800, tam: 66 },
    color: { texto: "#f3f1ec", az: "#7aa2ff", am: "#ff6b5e", neutro: "#f3f1ec", hondo: "10,11,14" },
    brillo: { az: "122,162,255", am: "255,107,94", neutro: "243,241,236" },
    solape: 0.2,                 // interlineado negativo base↔énfasis, en fracción del tamaño del énfasis
    seguro: { x0: 40, y0: 240, x1: 1040, y1: 1460, botonesX: 900, botonesY: 1160 }   // reel 9:16 (modulos/zonas-seguras)
  };

  /* ------------------------------------------------------------------ tokens desde la marca (variables CSS del <style id="marca">) */
  function rgb(c) {   // "#rrggbb" | "#rgb" | "rgb(r, g, b)" → "r,g,b"
    c = String(c || "").trim();
    var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { var h = m[1].length === 3 ? m[1].split("").map(function (x) { return x + x; }).join("") : m[1]; return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }).join(","); }
    m = c.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
    return m ? [m[1], m[2], m[3]].join(",") : null;
  }
  function tokensDesdeCSS(doc, extra) {
    doc = doc || root.document;
    var cs = root.getComputedStyle ? root.getComputedStyle(doc.documentElement) : null;
    var v = function (n, d) { var x = cs ? cs.getPropertyValue(n).trim() : ""; return x || d; };
    var tit = v("--fuente-titulos", SANS), txt = v("--fuente-texto", SANS), mono = v("--fuente-mono", MONO);
    var peso = Number(v("--peso-titulos", "800")) || 800;
    var texto = v("--texto", TOKENS.color.texto), pos = v("--acento", TOKENS.color.az), neg = v("--negativo", TOKENS.color.am), hondo = v("--fondo-hondo", "#0a0b0e");
    var tk = {
      base: { familia: txt, peso: 600, tam: 54, tracking: -0.01, estilo: "normal", mayus: false },
      roles: {
        bloque:   { familia: tit, peso: peso, tam: 104, tracking: -0.03, estilo: "normal", mayus: false, degradado: true },
        acento:   { familia: tit, peso: peso, tam: 120, tracking: -0.01, estilo: "italic", mayus: false },
        elegante: { familia: tit, peso: 400, tam: 116, tracking: 0, estilo: "normal", mayus: false },
        grito:    { familia: tit, peso: peso, tam: 116, tracking: 0.01, estilo: "normal", mayus: true, degradado: true, brilloFuerte: true },
        dato:     { familia: mono, peso: 500, tam: 46, tracking: 0.14, estilo: "normal", mayus: true }
      },
      natural: { familia: tit, peso: peso, tam: 66 },
      color: { texto: texto, az: pos, am: neg, neutro: texto, hondo: rgb(hondo) || TOKENS.color.hondo },
      brillo: { az: rgb(pos) || TOKENS.brillo.az, am: rgb(neg) || TOKENS.brillo.am, neutro: rgb(texto) || TOKENS.brillo.neutro },
      solape: TOKENS.solape, seguro: TOKENS.seguro
    };
    if (extra) Object.keys(extra).forEach(function (k) { tk[k] = typeof extra[k] === "object" && !Array.isArray(extra[k]) ? Object.assign({}, tk[k], extra[k]) : extra[k]; });
    return tk;
  }
  var TONO = { positivo: "az", problema: "am", az: "az", am: "am" };

  /* ------------------------------------------------------------------ repertorio (parámetros medidos en referentes reales) */
  // Entradas de la BASE (sobria, sin espectáculo) y del ÉNFASIS (rota, nunca dos iguales seguidas).
  var ENTRADAS_BASE = ["pop", "arco", "corte"];
  var ENTRADAS_ENFASIS = ["letras", "zoom", "barrido", "slide", "sube", "slam", "cae"];
  var SALIDAS = ["estela", "fundido", "corte", "subida"];
  var DUR = { pop: 0.28, arco: 0.42, corte: 0, letras: 0.11, letrasPaso: 0.033, zoom: 0.22, barrido: 0.26, slide: 0.33, sube: 0.30, slam: 0.26, cae: 0.26, caePaso: 0.066,
              estela: 0.2, fundido: 0.3, subida: 0.24 };
  // sonido por entrada (categoría lógica → efecto de modulos/sonido/sfx en SFX). La base no suena.
  var SONIDO = { letras: "cap-brillo", cae: "cap-tick", slide: "cap-roce", grito: null };
  var SFX = { "cap-brillo": "pop", "cap-tick": "tick", "cap-roce": "swipe" };

  /* ------------------------------------------------------------------ componer: grupos → bloques (premium) */
  function componer(grupos, op) {
    op = op || {};
    var plan = op.plan || { escenas: {}, bloques: {} };
    var escenaDe = op.escenaDe || function () { return "S"; };
    var maxPal = op.maxPalabras || 9, maxHueco = op.maxHueco == null ? 0.7 : op.maxHueco;
    // Agrupación a nivel de PALABRA: un bloque se cierra (a) tras su remate (la palabra con tono, si la siguiente no lo es:
    // los conectores que siguen pasan al bloque siguiente), (b) en puntuación (w.fin), (c) al cambiar de escena,
    // (d) en un hueco de voz > maxHueco, (e) al llegar a maxPalabras. Excepción a (a): una sola palabra que cierra la frase
    // ("nadie más.") se queda con su remate. Los grupos de origen solo dan el t1 (cuánto aguanta).
    var P = [];
    grupos.forEach(function (g, gi) { g.ws.forEach(function (w, k) { P.push({ txt: w.txt, s: w.s, tono: TONO[w.tono] || null, fin: !!w.fin, gi: gi, ultimo: k === g.ws.length - 1, t1g: g.t1 }); }); });
    var B = [], cur = null;
    P.forEach(function (w, k) {
      var esc = escenaDe(w.s + 0.001), prev = P[k - 1];
      var nuevo = !cur || cur.esc !== esc || cur.ws.length >= maxPal || (prev && w.s - prev.s > maxHueco + 0.6) ||
        (prev && prev.fin) || (prev && prev.tono && !w.tono && !w.fin) || (prev && prev.gi !== w.gi && grupos[w.gi].solo);
      if (nuevo) { cur = { esc: esc, ws: [], grupos: [] }; B.push(cur); }
      cur.ws.push(w); if (cur.grupos.indexOf(w.gi) < 0) cur.grupos.push(w.gi);
    });
    B.forEach(function (b, i) {
      var u = b.ws[b.ws.length - 1], sig = B[i + 1];
      b.t1 = u.ultimo ? u.t1g : (sig ? sig.ws[0].s : u.t1g);
      b.ws = b.ws.map(function (w) { return { txt: w.txt, s: w.s, tono: w.tono, fin: w.fin }; });
    });
    // overrides por texto (robusto a cambios de voz: el texto no cambia, los tiempos sí)
    var rotEnf = 0, ultimaEnt = null, ultimaBaseEnt = null, ultRol = null;
    var ROLES_ROT = op.rolesRotacion || ["bloque", "acento", "elegante", "bloque", "acento"];
    // índice dentro de la escena (rota plantillas y zonas por escena, no por todo el vídeo)
    var cuenta = {}; B.forEach(function (b) { b.iEsc = cuenta[b.esc] = (cuenta[b.esc] == null ? 0 : cuenta[b.esc] + 1); });
    var vistas = {}, total = {};
    B.forEach(function (b) { b.clave = norm(b.ws.map(function (w) { return w.txt; }).join(" ")); total[b.clave] = (total[b.clave] || 0) + 1; });
    B.forEach(function (b, i) {
      b.i = i; var n = vistas[b.clave] = (vistas[b.clave] || 0) + 1;
      // override por texto; si el texto se repite: "texto#2", "texto#3"… o "texto#fin" para la última aparición
      var esc = plan.escenas[b.esc] || {};
      var ov = (n === total[b.clave] && n > 1 && plan.bloques[b.clave + "#fin"]) || (n > 1 && plan.bloques[b.clave + "#" + n]) || plan.bloques[b.clave] || {};
      b.ov = ov; b.escPlan = esc;
      // líneas: runs de base / énfasis (las palabras con tono son énfasis)
      var lineas = [], L = null;
      b.ws.forEach(function (w, k) {
        var enf = ov.enfasis ? ov.enfasis.indexOf(norm(w.txt)) >= 0 : !!w.tono;
        if (ov.todoBase) enf = false;
        var tipo = enf ? "enf" : "base";
        if (!L || L.tipo !== tipo) { L = { tipo: tipo, ws: [] }; lineas.push(L); }
        L.ws.push(k);
      });
      // bases largas: se parten en líneas equilibradas (5 → 3+2, 7 → 4+3), nunca una palabra suelta colgando
      var maxB = ov.maxBaseLinea || esc.maxBaseLinea || 4;
      lineas = lineas.reduce(function (acc, ln) {
        if (ln.tipo !== "base" || ln.ws.length <= maxB) { acc.push(ln); return acc; }
        var n = Math.ceil(ln.ws.length / maxB), base = Math.floor(ln.ws.length / n), resto = ln.ws.length % n, q = 0;
        for (var r = 0; r < n; r++) { var c = base + (r < resto ? 1 : 0); acc.push({ tipo: "base", ws: ln.ws.slice(q, q + c) }); q += c; }
        return acc;
      }, []);
      // un bloque sin énfasis es una línea base sola (o dos si es larga)
      b.lineas = lineas;
      // rol del énfasis: override, si no rotación sin repetir el anterior
      lineas.forEach(function (ln) {
        if (ln.tipo !== "enf") { ln.rol = "base"; return; }
        var r = ov.rol || null;
        if (!r) { do { r = ROLES_ROT[rotEnf++ % ROLES_ROT.length]; } while (r === ultRol && ROLES_ROT.length > 1); }
        ln.rol = r; ultRol = r;
        var tonos = ln.ws.map(function (k) { return b.ws[k].tono; }).filter(Boolean);
        ln.tono = ov.tono || tonos[0] || "az";
      });
      // plantilla de layout
      var tpls = ov.tpl ? [ov.tpl] : (esc.tpl || ["apilado"]);
      b.tpl = tpls[b.iEsc % tpls.length];
      if (b.tpl === "escalera" && !lineas.some(function (l) { return l.tipo === "base" && l.ws.length >= 2 && l.ws.length <= 3; })) b.tpl = "escalon";
      b.detras = !!ov.detras;
      // entrada de la base y del énfasis (rotación sin repetir)
      var eb = ov.entradaBase || (esc.entradaBase ? esc.entradaBase[i % esc.entradaBase.length] : "pop");
      b.entradaBase = eb; ultimaBaseEnt = eb;
      var lista = esc.entradas || ["letras", "zoom", "barrido", "slide", "sube", "slam"];
      var ee = ov.entrada || null;
      if (!ee) { var k = i; do { ee = lista[k++ % lista.length]; } while (ee === ultimaEnt && lista.length > 1); }
      if (lineas.some(function (l) { return l.tipo === "enf"; })) ultimaEnt = ee;
      b.entrada = ee;
      // tiempos: la base aparece palabra a palabra (cuando se dice); el énfasis arranca con su primera palabra
      b.t0 = b.ws[0].s - 0.03;
    });
    // salidas: depende de lo que viene detrás
    B.forEach(function (b, i) {
      var sig = B[i + 1], ov = b.ov;
      var cambiaEscena = !sig || sig.esc !== b.esc;
      var hueco = sig ? sig.t0 - b.t1 : 9;
      var sal = ov.salida || (cambiaEscena ? (b.escPlan.salidaCorte || "estela") : (hueco > 0.5 ? "subida" : (b.escPlan.salida || "fundido")));
      b.salida = sal;
      // fin visible: el siguiente bloque releva (fundido cruzado) o el bloque aguanta hasta su t1 natural
      if (sig && !cambiaEscena) b.tFin = sal === "fundido" ? sig.t0 - 0.06 : Math.min(b.t1, sig.t0) - DUR[sal];
      else b.tFin = b.t1 - (DUR[sal] || 0);
      if (ov.tFin != null) b.tFin = ov.tFin;
      if (b.tFin < b.ws[b.ws.length - 1].s + 0.25) b.tFin = b.ws[b.ws.length - 1].s + 0.25;
    });
    return B;
  }

  /* ------------------------------------------------------------------ eventos de sonido (node-safe) */
  // Solo suenan las entradas de énfasis por letras (brillo), las letras que caen (ticks) y los deslizamientos (roce).
  // La base no suena. evitar = instantes con SFX ya puestos. Cada evento trae sfx = efecto sugerido de la librería del repo.
  function eventos(bloques, op) {
    op = op || {};
    var evitar = op.evitar || [], margen = op.margen == null ? 0.25 : op.margen, out = [];
    // rangos = colas largas ya sonando ([t0, t1], p. ej. una campanilla de 1,8 s): un brillo encima no se oye como evento nuevo
    var rangos = op.rangos || [];
    var libre = function (t) { return !evitar.some(function (x) { return Math.abs(x - t) < margen; }) && !rangos.some(function (r) { return t > r[0] - margen && t < r[1]; }) && !out.some(function (e) { return Math.abs(e.t - t) < margen; }); };
    bloques.forEach(function (b) {
      var ln = b.lineas.filter(function (l) { return l.tipo === "enf"; })[0];
      if (!ln) return;
      var t = b.ws[ln.ws[0]].s - 0.05;
      var k = (ln.rol === "grito" && SONIDO.grito) || SONIDO[b.entrada];
      if (!k) return;
      if (b.entrada === "cae") {   // un tick por letra, como mucho 4
        var n = Math.min(4, ln.ws.map(function (j) { return b.ws[j].txt; }).join("").length);
        for (var q = 0; q < n; q++) { var tq = +(t + q * DUR.caePaso * 2).toFixed(3); out.push({ k: "cap-tick", t: tq, label: "cap-" + b.i + "-tick" + q }); }
        if (ln.rol === "grito" && SONIDO.grito && libre(t - 0.12)) out.push({ k: SONIDO.grito, t: +(t - 0.12).toFixed(3), label: "cap-" + b.i + "-grito" });
        return;
      }
      if (libre(t)) out.push({ k: k, t: +t.toFixed(3), label: "cap-" + b.i + "-" + b.entrada });
    });
    out.forEach(function (e) { e.sfx = SFX[e.k] || null; });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  /* ------------------------------------------------------------------ DOM (navegador) */
  function montar(cfg) {
    var doc = cfg.documento || root.document;
    var tk = cfg.tokens || TOKENS;
    var frente = cfg.capaFrente, detras = cfg.capaDetras || cfg.capaFrente;
    var escenaDe = cfg.escenaDe || function () { return "S"; };
    if (cfg.estilo === "natural") return montarNatural(cfg, doc, frente, escenaDe);

    var bloques = cfg.bloques;
    var el = function (tag, css, cls) { var e = doc.createElement(tag); if (css) e.style.cssText = css; if (cls) e.className = cls; return e; };
    var sombraBase = "0 3px 18px rgba(" + tk.color.hondo + ",0.85), 0 1px 3px rgba(" + tk.color.hondo + ",0.9)";
    function estiloFuente(f) {
      return "font-family:" + f.familia + ";font-weight:" + f.peso + ";font-size:" + f.tam + "px;letter-spacing:" + f.tracking + "em;font-style:" + f.estilo +
        ";line-height:1;white-space:nowrap;" + (f.mayus ? "text-transform:uppercase;" : "");
    }
    function pintarEnfasis(span, rol, tono) {
      var c = tk.color[tono] || tk.color.az, g = tk.brillo[tono] || tk.brillo.az, f = tk.roles[rol];
      if (rol === "dato") { span.style.color = c; span.style.textShadow = sombraBase; return; }
      if (f.degradado) {   // degradado vertical texto → acento (los acentos grandes nunca en color plano) + brillo del acento
        span.style.backgroundImage = "linear-gradient(180deg," + tk.color.texto + " 8%," + c + " 72%)";
        span.style.webkitBackgroundClip = "text"; span.style.backgroundClip = "text"; span.style.color = "transparent";
        span.style.filter = f.brilloFuerte ? "drop-shadow(0 0 10px rgba(" + g + ",0.9)) drop-shadow(0 0 30px rgba(" + g + ",0.55)) drop-shadow(0 8px 18px rgba(" + tk.color.hondo + ",0.7))"
          : "drop-shadow(0 0 14px rgba(" + g + ",0.55)) drop-shadow(0 8px 18px rgba(" + tk.color.hondo + ",0.7))";
        span.style.padding = "0.06em 0.04em 0.16em"; return;
      }
      span.style.color = rol === "elegante" ? tk.color.texto : c;
      span.style.textShadow = (rol === "elegante" ? "0 0 22px rgba(" + g + ",0.45), " : "0 0 18px rgba(" + g + ",0.7), 0 0 42px rgba(" + g + ",0.35), ") + "0 6px 20px rgba(" + tk.color.hondo + ",0.8)";
      span.style.padding = "0.04em 0.06em 0.14em";
    }
    // DOM de cada bloque: un contenedor por bloque y una caja por línea; la línea de énfasis de un bloque 'detras' vive en la capa de detrás
    bloques.forEach(function (b) {
      b.dom = el("div", "position:absolute;left:0;top:0;opacity:0;transform-origin:50% 50%;will-change:transform,opacity,filter", "capP");
      frente.appendChild(b.dom);
      if (b.detras) { b.domDetras = el("div", "position:absolute;left:0;top:0;opacity:0;will-change:transform,opacity,filter", "capP capDetras"); detras.appendChild(b.domDetras); }
      b.lineas.forEach(function (ln, li) {
        var f = ln.tipo === "base" ? tk.base : tk.roles[ln.rol];
        var ep = b.escPlan || {};
        var tamOv = ln.tipo === "base" ? b.ov.tamBase : b.ov.tamEnf;
        var esc_ = ln.tipo === "base" ? (b.ov.escalaBase || ep.escalaBase || 1) : (b.ov.escalaEnf || ep.escalaEnf || 1);
        if (tamOv || esc_ !== 1) { f = Object.assign({}, f, { tam: Math.round(tamOv || f.tam * esc_) }); }
        ln.f = f;
        ln.dom = el("div", "position:absolute;left:0;top:0;" + estiloFuente(f) + "transform-origin:0% 60%");
        (b.detras && ln.tipo === "enf" ? b.domDetras : b.dom).appendChild(ln.dom);
        ln.spans = [];
        ln.ws.forEach(function (k, j) {
          var w = b.ws[k];
          var sp = el("span", "display:inline-block;transform-origin:50% 70%;" + (j ? "margin-left:" + (ln.tipo === "base" ? 0.24 : 0.18) + "em;" : ""));
          if (ln.tipo === "base") {
            sp.textContent = w.txt;
            sp.style.color = w.tono ? (tk.color[w.tono] || tk.color.texto) : tk.color.texto;
            sp.style.textShadow = sombraBase;
          } else {
            var porLetra = b.entrada === "letras" || b.entrada === "cae";
            if (porLetra) {
              // por letra: cada letra su span. El degradado con background-clip:text va en CADA letra: en el padre, con hijos
              // transformados, el render apila los glifos (gotcha conocido de SplitText + clip-text).
              var deg = !!tk.roles[ln.rol].degradado;
              if (!deg) pintarEnfasis(sp, ln.rol, ln.tono);
              Array.from(w.txt).forEach(function (ch) { var lt = el("span", "display:inline-block;transform-origin:50% 80%"); lt.textContent = ch; if (deg) pintarEnfasis(lt, ln.rol, ln.tono); sp.appendChild(lt); });
            } else { pintarEnfasis(sp, ln.rol, ln.tono); sp.textContent = w.txt; }
          }
          ln.dom.appendChild(sp); ln.spans.push(sp);
        });
        ln.letras = [];
        ln.spans.forEach(function (sp) { Array.from(sp.children).forEach(function (c) { ln.letras.push(c); }); });
      });
    });

    // fuentes: se piden al montar y el layout solo se cachea cuando TODAS están cargadas (si no, se recalcula en cada frame)
    var FUENTES = [tk.base].concat(Object.keys(tk.roles).map(function (r) { return tk.roles[r]; })).map(function (f) { return f.estilo + " " + f.peso + " 100px " + f.familia; });
    if (doc.fonts) FUENTES.forEach(function (f) { try { doc.fonts.load(f); } catch (e) {} });
    function fuentesListas() { if (!doc.fonts) return true; if (doc.fonts.status !== "loaded") return false; return FUENTES.every(function (f) { try { return doc.fonts.check(f); } catch (e) { return true; } }); }
    /* ---- layout: se calcula una vez por bloque con las fuentes ya cargadas (determinista; mismo resultado en cada worker) */
    var S = tk.seguro;
    function medir(b) {
      if (b.geo) return b.geo;
      var listo = fuentesListas();
      var esc = b.escPlan || {}, ov = b.ov || {};
      var zona = ov.zona || (esc.zonaT ? esc.zonaT(b.t0, b) : null) || (esc.zonas ? esc.zonas[b.iEsc % esc.zonas.length] : null) || esc.zona || [S.x0, 700, S.x1, 1100];
      var zw = zona[2] - zona[0];
      var lns = b.lineas.map(function (ln) { return { ln: ln, w: ln.dom.offsetWidth, h: ln.f.tam }; });
      // escalera: palabras de la base en escalones (la primera arriba); conectores cortos más chicos
      if (b.tpl === "escalera") lns.forEach(function (o) {
        if (o.ln.tipo !== "base") return; var x = 0;
        o.ln.spans.forEach(function (sp, j) { var corta = sp.textContent.length <= 2; sp.style.fontSize = corta ? "0.62em" : ""; sp.style.transform = ""; sp.dataset.y = j * 0.42 * o.ln.f.tam; sp.dataset.yc = corta ? 0.12 * o.ln.f.tam : 0; });
        o.w = o.ln.dom.offsetWidth; o.h = o.ln.f.tam * (1 + 0.42 * (o.ln.spans.length - 1));
      });
      // alineación por plantilla
      // alineación: por plantilla y por ROL (no por índice). escalon: base a la izquierda, énfasis a la derecha (con 3+ líneas,
      // la del medio centrada, como "Quiero presentarles / una oportunidad / única"); esparcido y escalera: base arriba a la
      // izquierda, énfasis abajo a la derecha; lateral(Der): todo a un lado (columnas junto a un panel)
      var alin = function (o, i) {
        var t = b.tpl, enf = o.ln.tipo === "enf";
        if (t === "lateral") return "l"; if (t === "lateralDer") return "r"; if (t === "apilado") return "c";
        if (t === "escalon" && lns.length >= 3) return i === 0 ? "l" : i === lns.length - 1 ? "r" : "c";
        return enf ? "r" : "l";
      };
      var Wb = 0; lns.forEach(function (o) { Wb = Math.max(Wb, o.w); });
      if (b.tpl === "escalon" && lns.length > 1) Wb = Math.max(Wb, lns.reduce(function (m, o) { return Math.max(m, o.w); }, 0) * 1.12);
      if (b.tpl === "esparcido") Wb = Math.max(Wb, Math.min(zw, ov.anchoEsparcido || esc.anchoEsparcido || zw));
      // vertical: el énfasis pisa la base (interlineado negativo); entre bases, 0,12 em de aire
      var y = 0;
      lns.forEach(function (o, i) {
        if (i) {
          var p = lns[i - 1];
          var gap = (o.ln.tipo === "enf" || p.ln.tipo === "enf") ? -tk.solape * Math.max(o.ln.tipo === "enf" ? o.h : 0, p.ln.tipo === "enf" ? p.h : 0) : 0.12 * o.h;
          if (o.ln.rol === "dato" || p.ln.rol === "dato") gap = 0.18 * o.h;
          if (b.tpl === "esparcido") gap += (ov.aireY != null ? ov.aireY : (esc.aireY != null ? esc.aireY : 90));
          y += gap;
        }
        o.y = y; y += o.h;
        var a = alin(o, i);
        o.x = a === "l" ? 0 : a === "r" ? Wb - o.w : (Wb - o.w) / 2;
      });
      var Hb = y;
      // escala para que entre en la zona
      var s = Math.min(1, (zw - 10) / Wb, (zona[3] - zona[1]) / Hb, ov.escala || 1);
      // ancla: centro del bloque (override cx/cy, si no centro de la zona; 'esparcido' llena la zona)
      var cx = ov.cx != null ? ov.cx : (esc.cx != null ? esc.cx : (zona[0] + zona[2]) / 2);
      var cy = ov.cy != null ? ov.cy : (esc.cy != null ? esc.cy : (zona[1] + zona[3]) / 2);
      var x0 = cx - Wb * s / 2, y0 = cy - Hb * s / 2;
      // zonas seguras: dentro del rect seguro y fuera de la columna de botones
      x0 = clamp(x0, S.x0, S.x1 - Wb * s); y0 = clamp(y0, S.y0, S.y1 - Hb * s);
      if (y0 + Hb * s > S.botonesY && x0 + Wb * s > S.botonesX) x0 = Math.max(S.x0, S.botonesX - Wb * s);
      var geo = { x0: x0, y0: y0, W: Wb, H: Hb, s: s, lns: lns, rot: ov.rot != null ? ov.rot : 0 };
      lns.forEach(function (o) {
        o.ln.dom.style.left = (o.x) + "px"; o.ln.dom.style.top = (o.y) + "px";
        if (b.tpl === "escalera" && o.ln.tipo === "base") o.ln.spans.forEach(function (sp) { sp.style.verticalAlign = "top"; sp.style.position = "relative"; sp.style.top = (+sp.dataset.y + +sp.dataset.yc) + "px"; });
        // énfasis solo y grande a −2°, salvo override o plantilla recta
        o.rot = o.ln.tipo === "enf" && o.ln.rol !== "dato" && (ov.rotEnf != null ? ov.rotEnf : (esc.rotEnf != null ? esc.rotEnf : -2)) || 0;
      });
      [b.dom, b.domDetras].forEach(function (d) { if (!d) return; d.style.left = x0 + "px"; d.style.top = y0 + "px"; d.style.width = Wb + "px"; d.style.height = Hb + "px"; d.style.transformOrigin = "0 0"; });
      if (listo) b.geo = geo;
      return geo;
    }

    /* ---- estado por t */
    var blurCss = function (px) { return px > 0.05 ? "blur(" + px.toFixed(2) + "px)" : "none"; };
    function salida(b, t) {   // devuelve {op, x, y, blur} del bloque entero
      var u = ap(t, b.tFin, DUR[b.salida] || 0.0001);
      if (t < b.tFin) return { op: 1, x: 0, y: 0, blur: 0 };
      if (b.salida === "corte") return { op: 0, x: 0, y: 0, blur: 0 };
      if (b.salida === "estela") { var e = E.in2(u); return { op: 1 - E.in4(u), x: 300 * e, y: 0, blur: 18 * e }; }
      if (b.salida === "subida") { var e2 = E.in2(u); return { op: 1 - e2, x: 0, y: -100 * e2, blur: 12 * e2 }; }
      var e3 = E.out3(u); return { op: 1 - e3, x: 0, y: 0, blur: 8 * e3 };   // fundido (cruzado con la entrada siguiente)
    }
    function update(t) {
      bloques.forEach(function (b) {
        var visible = t >= b.t0 && t < b.tFin + (DUR[b.salida] || 0) + 0.001;
        if (!visible) { b.dom.style.opacity = 0; if (b.domDetras) b.domDetras.style.opacity = 0; return; }
        var g = medir(b), sx = salida(b, t);
        var tr = "translate(" + sx.x + "px," + sx.y + "px) scale(" + g.s + ")";
        [b.dom, b.domDetras].forEach(function (d) { if (!d) return; d.style.opacity = sx.op; d.style.transform = tr; d.style.filter = blurCss(sx.blur); });
        b.lineas.forEach(function (ln, li) {
          var o = g.lns[li];
          if (ln.tipo === "base") lineaBase(b, ln, o, t); else lineaEnfasis(b, ln, o, t);
        });
      });
    }
    function lineaBase(b, ln, o, t) {
      var ent = b.entradaBase;
      if (ent === "arco") {   // E6: la línea entra girada −8° (pivote izquierdo) y se endereza; las palabras con opacidad + desenfoque
        var t0 = b.ws[ln.ws[0]].s - 0.05, r = lerp(-8, 0, E.out3(ap(t, t0, DUR.arco)));
        ln.dom.style.transform = "rotate(" + r + "deg)";
      } else ln.dom.style.transform = "";
      ln.spans.forEach(function (sp, j) {
        var s = b.ws[ln.ws[j]].s - 0.03;
        if (t < s) { sp.style.opacity = 0; return; }
        if (ent === "corte") { sp.style.opacity = 1; sp.style.filter = "none"; return; }
        var u = E.expo(ap(t, s, DUR.pop));
        sp.style.opacity = Math.min(1, ap(t, s, DUR.pop * 0.6));
        var ty = (ent === "arco" ? 10 : 24) * (1 - u), sc = lerp(ent === "arco" ? 0.97 : 0.92, 1, u);
        sp.style.transform = "translateY(" + ty.toFixed(2) + "px) scale(" + sc.toFixed(4) + ")" + (sp.dataset.y ? "" : "");
        sp.style.filter = blurCss(6 * (1 - u));
      });
    }
    function lineaEnfasis(b, ln, o, t) {
      var ent = b.entrada, t0 = b.ws[ln.ws[0]].s - 0.05, rot = o.rot || 0;
      var base = "rotate(" + rot + "deg)";
      ln.dom.style.webkitMaskImage = ""; ln.dom.style.maskImage = "";
      if (t < t0) { ln.dom.style.opacity = 0; return; }
      ln.dom.style.opacity = 1;
      if (ent === "letras" || ent === "cae") {
        ln.dom.style.transform = base; ln.dom.style.filter = "none";
        ln.letras.forEach(function (lt, q) {
          var paso = ent === "letras" ? DUR.letrasPaso : DUR.caePaso, s = t0 + q * paso, d = ent === "letras" ? DUR.letras : DUR.cae;
          if (t < s) { lt.style.opacity = 0; return; }
          var u = ap(t, s, d);
          lt.style.opacity = Math.min(1, u * 2.2);
          if (ent === "letras") { var sc = E.back(u); lt.style.transform = "scale(" + sc.toFixed(4) + ")"; lt.style.filter = blurCss(6 * (1 - u)); }
          else { var e = E.back(u); lt.style.transform = "translateY(" + (-130 * (1 - e)).toFixed(1) + "px) rotate(" + (-14 * (1 - e)).toFixed(2) + "deg)"; lt.style.filter = blurCss(7 * (1 - E.out3(u))); }
        });
        return;
      }
      var u, e;
      if (ent === "zoom") { u = ap(t, t0, DUR.zoom); e = E.expo(u); ln.dom.style.transformOrigin = "50% 60%"; ln.dom.style.transform = base + " scale(" + lerp(0.15, 1, e).toFixed(4) + ")"; ln.dom.style.opacity = Math.min(1, u * 2); ln.dom.style.filter = blurCss(10 * (1 - e)); return; }
      if (ent === "slam") { u = ap(t, t0, DUR.slam); e = E.in4(u); ln.dom.style.transformOrigin = "50% 55%"; ln.dom.style.transform = base + " scale(" + lerp(1.85, 1, e).toFixed(4) + ")"; ln.dom.style.opacity = Math.min(1, u * 3); ln.dom.style.filter = blurCss(12 * (1 - e)); return; }
      if (ent === "slide") { u = ap(t, t0, DUR.slide); e = E.expo(u); ln.dom.style.transform = "translateX(" + (150 * (1 - e)).toFixed(1) + "px) " + base; ln.dom.style.opacity = Math.min(1, u * 2.5); ln.dom.style.filter = blurCss(12 * (1 - e)); return; }
      if (ent === "sube") { u = ap(t, t0, DUR.sube); e = E.expo(u); ln.dom.style.transform = "translateY(" + (240 * (1 - e)).toFixed(1) + "px) " + base; ln.dom.style.opacity = Math.min(1, u * 2.5); ln.dom.style.filter = blurCss(10 * (1 - e)); return; }
      if (ent === "barrido") {   // E5: barrido de izquierda a derecha con borde blando + desenfoque que se va
        u = ap(t, t0, DUR.barrido); e = E.out3(u); var p = lerp(-12, 112, e);
        var m = "linear-gradient(90deg,#000 " + (p - 12).toFixed(1) + "%,rgba(0,0,0,0) " + p.toFixed(1) + "%)";
        ln.dom.style.webkitMaskImage = u < 1 ? m : ""; ln.dom.style.maskImage = u < 1 ? m : "";
        ln.dom.style.transform = base; ln.dom.style.filter = blurCss(6 * (1 - e)); return;
      }
      ln.dom.style.transform = base; ln.dom.style.filter = "none";
    }
    return { update: update, bloques: bloques, medir: medir };
  }

  /* ------------------------------------------------------------------ estilo NATURAL */
  // 1-3 palabras centradas en x = 540 (caja left 185, ancho 710), fuente de títulos 66 px, clave en el color del tono,
  // palabra a palabra cuando se dice: escala 1,14 → 1 y translateY 8 → 0 en 0,14 s. top por escena (cfg.natural.y[id] o 975).
  function montarNatural(cfg, doc, frente, escenaDe) {
    var N = cfg.natural || {}, grupos = cfg.grupos;
    var tk = cfg.tokens || TOKENS;
    var capEl = doc.createElement("div");
    capEl.className = "caption";
    var nf = tk.natural || TOKENS.natural, ho = tk.color.hondo;
    capEl.style.cssText = "position:absolute;left:185px;width:710px;text-align:center;font-family:" + nf.familia + ";font-weight:" + nf.peso + ";font-size:" + nf.tam + "px;line-height:1.05;letter-spacing:-0.01em;color:" + tk.color.texto +
      ";white-space:nowrap;text-shadow:0 4px 24px rgba(" + ho + ",0.9),0 0 2px rgba(" + ho + ",0.8);top:1000px;opacity:0";
    frente.appendChild(capEl);
    var actual = -1;
    var eo = E.out3;
    function update(t) {
      var ci = -1;
      for (var k = 0; k < grupos.length; k++) if (t >= grupos[k].t0 && t < grupos[k].t1) ci = k;
      if (ci !== actual) {
        actual = ci;
        capEl.innerHTML = ci < 0 ? "" : grupos[ci].ws.map(function (w) {
          var tn = TONO[w.tono], c = tn === "az" ? tk.color.az : tn === "am" ? tk.color.am : "";
          return '<span style="display:inline-block;margin:0 0.12em;transform-origin:50% 70%;' + (c ? "color:" + c : "") + '">' + w.txt + "</span>";
        }).join("");
      }
      if (ci < 0) { capEl.style.opacity = 0; return; }
      var id = escenaDe(t), y = N.yDe ? N.yDe(id, t) : ((N.y && N.y[id]) || 975);
      capEl.style.top = y + "px"; capEl.style.opacity = 1;
      grupos[ci].ws.forEach(function (w, j) {
        var sp = capEl.children[j], u = ap(t, w.s - 0.03, 0.14), on = t >= w.s - 0.03;
        sp.style.opacity = on ? 1 : 0;
        sp.style.transform = "scale(" + (on ? lerp(1.14, 1, eo(u)) : 1) + ") translateY(" + (1 - eo(u)) * 8 + "px)";
      });
    }
    return { update: update, bloques: null };
  }

  var API = { componer: componer, eventos: eventos, montar: montar, tokensDesdeCSS: tokensDesdeCSS, TOKENS: TOKENS, SFX: SFX, ENTRADAS_BASE: ENTRADAS_BASE, ENTRADAS_ENFASIS: ENTRADAS_ENFASIS, SALIDAS: SALIDAS, DUR: DUR, SONIDO: SONIDO, norm: norm };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.CaptionsEstilos = API;
})(typeof window !== "undefined" ? window : globalThis);
