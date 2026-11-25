/* cara.js — cara 2D de personaje por código (ojos con párpados, cejas, boca con lip-sync), sin dependencias.
 *
 * Todo es función pura de t (determinista, scrubbable): expresión por pista, boca por cues de Rhubarb (9 visemas
 * A–H + X), parpadeo y micro-sacadas sembrados. Sin Date.now ni Math.random.
 *
 * La cara se describe como una lista de primitivas (paths SVG + grupos con transform/clip) y se pinta por dos vías
 * que dan el mismo dibujo:
 *   - SVG: overlay DOM montado sobre cualquier elipse o rectángulo de la composición  → Cara.mount(...)
 *   - Canvas 2D (síncrono, vía Path2D): para usar la cara como textura de un personaje 3D  → inst.pintarCanvas(ctx, t)
 *
 * Uso DOM (ver references/patterns/personaje-narrador.md):
 *   <script src="cara.js"></script>
 *   const cara = Cara.mount(host, { forma: { cx, cy, rx, ry, rot } | { x, y, w, h, rot },
 *     expresiones, cues, pista: [[0, "neutral"], [2.1, "alegre", 0.25, "pop"]], inicioAudio: 0.4, paleta: {...} });
 *   cara.update(t);   // en el render(t) / onUpdate del timeline
 *
 * Uso Three.js (textura):
 *   const cara = Cara.crear({ expresiones, cues, paleta });
 *   const cv = document.createElement("canvas"); cv.width = cv.height = 512;
 *   const tex = new THREE.CanvasTexture(cv);   // material.map = tex (o emissiveMap si la cara "brilla")
 *   // en cada frame: cara.pintarCanvas(cv.getContext("2d"), t, { fondo: "#111318" }); tex.needsUpdate = true;
 *
 * Estilos (todo opcional; sin pasar nada la cara es la de siempre, ojo de caricatura + boca orgánica):
 *   rasgos.ojo:  "caricatura" (esclera + iris + párpado) | "bloque" (cursor de terminal: bloque recortado por los
 *                párpados, al cerrarse queda un guion bajo) | "pixel" (el mismo bloque cuantizado en celdas de LED)
 *                | "ranura" (visor horizontal). geometria.ojo.rx/ry = semiancho/semialto; geometria.ojo.radio
 *                (0..0.5, esquina del bloque) y geometria.ojo.pixeles (columnas de la rejilla, estilo "pixel").
 *   rasgos.boca: "organica" (contorno, dientes con líneas, lengua) | "geometrica" (plana, sin contorno: tinta,
 *                barra de dientes y lengua como bloques). Mismos 9 visemas.
 *   paleta.ojo / paleta.ojoBrillo / paleta.boca: tinta del bloque, píxel de brillo y tinta de la boca geométrica.
 *   Expresiones: ojoForma: "feliz" (o L.forma / R.forma por ojo) dibuja el ojo como chevron ^ en los estilos nuevos.
 *   Mirada: opciones.mirada = (t) => [dx, dy] (función pura de t, se suma a las pupilas) o inst.setMirada([dx, dy]).
 *
 * Rasgos humanos opcionales (apagados por defecto, la cara de serie no cambia):
 *   rasgos.bigote / rasgos.perilla: vello que viaja con la boca (mismo transform: sigue skew, escala y apertura;
 *   la perilla baja con la mandíbula según el visema). Medidas en geometria.bigote { dy, grosor, ancho, caida } y
 *   geometria.perilla { gap, alto, arriba, abajo, mandibula (0..1 opacidad del trazo de mandíbula) }; color paleta.vello.
 *   rasgos.mejillas: rubor (paleta.mejilla, geometria.mejillas { dx, y, rx, ry, o }).
 *   rasgos.labios (boca orgánica): labio inferior con cuerpo en reposo y borde de labio alrededor de la boca abierta
 *   (paleta.labio). geometria.perilla.sombra (0..1): sombra de barba en mentón y mandíbula, bajo la perilla.
 *   Trazos (2026-11-20, para primer plano): geometria.ojo.trazo (ancho del contorno del ojo, default 5.5) y
 *   paleta.ojoContorno (color, default = contorno); geometria.trazoBoca (factor de los contornos de la boca orgánica,
 *   default 1) y geometria.labioAncho (borde de labio con la boca abierta, default 12); geometria.bocaKy (escala
 *   vertical de la boca y su vello; default = bocaK, o sea uniforme): boca más ancha sin que los visemas crezcan igual.
 *   rasgos.cierreLimpio (ojo caricatura): al cerrar el párpado el aro del contorno se funde; queda la línea del párpado.
 *   geometria.ceja { L, grosor, dy }: largo, grosor y altura extra de las cejas (default 33 · 13 · 0 = las de siempre).
 */
(function (root) {
  "use strict";

  /* ---------- espacio de diseño ---------- */
  var VB = { x: -160, y: -185, w: 320, h: 370 };   // viewBox de la cara (centrado en 0,0)
  var REF = { rx: 123, ry: 141 };                   // elipse de referencia: la cara está dibujada para encajar aquí

  var GEOMETRIA = { ojo: { dx: 45, y: -30, rx: 33, ry: 36 }, bocaY: 64, bocaK: 1.32, offset: { x: 0, y: 0 },
    ceja: { L: 33, grosor: 13, dy: 0 },
    bigote: { dy: 0, grosor: 7, ancho: 1.12, caida: 5 },
    perilla: { gap: 7, alto: 46, arriba: 14, abajo: 30, mandibula: 0, sombra: 0 },
    mejillas: { dx: 80, y: 52, rx: 24, ry: 13, o: 0.32 } };
  var SUBGEO = ["ojo", "offset", "ceja", "bigote", "perilla", "mejillas"];

  // Paleta neutra por defecto (cada personaje pasa la suya). halo/cejaBrillo = null → no se dibujan.
  var PALETA = {
    contorno: "#16181d", parpado: ["#3a404c", "#4d5462", "#646c7c"], parpadoLinea: "#262a33",
    esclera: ["#ffffff", "#eef0f3", "#c3c8d2"], iris: "#4a6378", irisBorde: "#24313d", pupila: "#0d1014", brillo: "#ffffff",
    ceja: "#16181d", cejaBrillo: null, halo: null, sombraParpado: "#000000", ojera: "#2a2e38",
    bocaInterior: "#3a1216", lengua: "#c4524b", lenguaLinea: "#96332f", dientes: "#f4f1e8", dientesLinea: "#b8b2a0",
    sombra: "#000000", ojo: "#16181d", ojoBrillo: "#ffffff", boca: null, vello: "#3a281e", mejilla: null, labio: null
  };
  var RASGOS = { iris: true, cejas: true, pliegues: false, ojo: "caricatura", boca: "organica", bigote: false, perilla: false, mejillas: false, cierreLimpio: false, labios: false };

  // Visemas de Rhubarb (extendedShapes GHX). w = semiancho, up/down = labio sup./inf., tt/tb = dientes, tongue 0..1.
  var SHAPES = {
    A: { w: 27, closed: 1 },                                   // M B P
    X: { w: 31, closed: 1, extraFrown: 0 },                    // reposo (subir extraFrown = personaje con mueca en reposo)
    B: { w: 29, up: 5, down: 8, clench: 1 },                   // dientes apretados (K S T…)
    C: { w: 31, up: 7, down: 21, tt: 8, tongue: 0.55 },        // abierta (EH AE)
    D: { w: 34, up: 9, down: 36, tt: 9, tb: 6, tongue: 0.6 },  // muy abierta (AA)
    E: { w: 21, up: 8, down: 19, tt: 6, tongue: 0.35, round: 1 }, // redondeada (AO ER)
    F: { w: 14, up: 10, down: 13, round: 1 },                  // "u" (UW OW W)
    G: { w: 26, up: 5, down: 9, tt: 10, bite: 1 },             // dientes sobre labio (F V)
    H: { w: 28, up: 7, down: 21, tt: 7, tongue: 0.5, tongueUp: 1 } // lengua arriba (L)
  };
  var OPEN = { A: 0, X: 0, B: 0.3, C: 0.65, D: 1, E: 0.55, F: 0.35, G: 0.3, H: 0.65 };
  var EXPR_NUM = ["lidTop", "lidBot", "lidTilt", "lidBulge", "browY", "browTilt", "browCurve"];

  var OJO_NEUTRO = { lidTop: 0.08, lidBot: 0.02, lidTilt: 0, lidBulge: 1, pupil: [0, 0], browY: 0, browTilt: 0, browCurve: 4 };
  // Expresiones de serie (siempre disponibles; las de opciones.expresiones se suman o las pisan).
  var EXPRESIONES_BASE = {
    neutral:  { L: OJO_NEUTRO, R: OJO_NEUTRO, pupilScale: 1, eyeScale: 1, mouth: { scale: 1, frown: 0, skew: 0, dy: 0 }, idleMouth: "X" },
    alegre:   { L: { lidTop: 0.06, lidBot: 0.22, lidTilt: -3, lidBulge: 0, pupil: [0, -0.05], browY: -8, browTilt: -4, browCurve: 7 },
                R: { lidTop: 0.06, lidBot: 0.22, lidTilt: -3, lidBulge: 0, pupil: [0, -0.05], browY: -8, browTilt: -4, browCurve: 7 },
                pupilScale: 1.05, eyeScale: 1, mouth: { scale: 1.05, frown: -1.1, skew: 0, dy: 0 }, idleMouth: "X" },
    sorpresa: { L: { lidTop: 0, lidBot: 0, lidTilt: 0, lidBulge: 0, pupil: [0, 0], browY: -18, browTilt: -4, browCurve: 8 },
                R: { lidTop: 0, lidBot: 0, lidTilt: 0, lidBulge: 0, pupil: [0, 0], browY: -18, browTilt: -4, browCurve: 8 },
                pupilScale: 0.75, eyeScale: 1.1, mouth: { scale: 1, frown: 0.2, skew: 0, dy: 0 }, idleMouth: "F" },
    duda:     { L: { lidTop: 0.2, lidBot: 0.06, lidTilt: 4, lidBulge: 2, pupil: [0.35, -0.3], browY: 6, browTilt: 8, browCurve: 2 },
                R: { lidTop: 0.12, lidBot: 0.04, lidTilt: -2, lidBulge: 1, pupil: [0.35, -0.3], browY: -12, browTilt: -8, browCurve: 8 },
                pupilScale: 1, eyeScale: 1, mouth: { scale: 0.9, frown: 0.3, skew: -6, dy: 0 }, idleMouth: "A" }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function hs(i, s) { var v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); }
  function f(n) { return (Math.round(n * 100) / 100).toString(); }
  function assign(a) { for (var i = 1; i < arguments.length; i++) { var b = arguments[i]; if (b) for (var k in b) if (b[k] !== undefined) a[k] = b[k]; } return a; }
  var EASE = {
    inOut: function (u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; },
    out: function (u) { return 1 - Math.pow(1 - u, 3); },
    pop: function (u) { var c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    linear: function (u) { return u; }
  };

  function normExpr(e) {   // completa campos que falten con los de neutral
    var n = EXPRESIONES_BASE.neutral, o = { L: {}, R: {}, mouth: assign({}, n.mouth, e.mouth) };
    ["L", "R"].forEach(function (s) { o[s] = assign({}, n[s], e[s]); o[s].pupil = (e[s] && e[s].pupil) || [0, 0]; o[s].forma = (e[s] && e[s].forma) || e.ojoForma || null; });
    o.pupilScale = e.pupilScale !== undefined ? e.pupilScale : 1; o.eyeScale = e.eyeScale !== undefined ? e.eyeScale : 1;
    o.idleMouth = e.idleMouth || "X"; o.noBlink = !!e.noBlink; o.mouthMap = e.mouthMap || null; o.jitter = e.jitter || 0;
    return o;
  }
  function lerpExpr(a, b, u) {
    var o = { L: {}, R: {}, mouth: {} };
    ["L", "R"].forEach(function (s) {
      EXPR_NUM.forEach(function (k) { o[s][k] = lerp(a[s][k], b[s][k], u); });
      o[s].pupil = [lerp(a[s].pupil[0], b[s].pupil[0], u), lerp(a[s].pupil[1], b[s].pupil[1], u)];
    });
    o.pupilScale = lerp(a.pupilScale, b.pupilScale, u); o.eyeScale = lerp(a.eyeScale, b.eyeScale, u);
    ["scale", "frown", "skew", "dy"].forEach(function (k) { o.mouth[k] = lerp(a.mouth[k], b.mouth[k], u); });
    o.jitter = lerp(a.jitter || 0, b.jitter || 0, clamp(u, 0, 1));
    var late = u >= 0.5 ? b : a; o.idleMouth = late.idleMouth || "X"; o.noBlink = !!late.noBlink; o.mouthMap = late.mouthMap || null;
    o.L.forma = late.L.forma || null; o.R.forma = late.R.forma || null;
    return o;
  }

  /* ---------- primitivas ---------- */
  function E(cx, cy, rx, ry) { return "M" + f(cx - rx) + "," + f(cy) + "A" + f(rx) + "," + f(ry) + " 0 1 0 " + f(cx + rx) + "," + f(cy) + "A" + f(rx) + "," + f(ry) + " 0 1 0 " + f(cx - rx) + "," + f(cy) + "Z"; }
  function R(x, y, w, h) { return "M" + f(x) + "," + f(y) + "h" + f(w) + "v" + f(h) + "h" + f(-w) + "Z"; }
  function RR(x, y, w, h, r) {   // rectángulo redondeado (arcos SVG: Path2D los entiende igual)
    r = Math.max(0, Math.min(r, w / 2, h / 2)); if (r < 0.01) return R(x, y, w, h);
    var a = " " + f(r) + "," + f(r) + " 0 0 1 ";
    return "M" + f(x + r) + "," + f(y) + "H" + f(x + w - r) + "A" + a + f(x + w) + "," + f(y + r) + "V" + f(y + h - r) + "A" + a + f(x + w - r) + "," + f(y + h) +
      "H" + f(x + r) + "A" + a + f(x) + "," + f(y + h - r) + "V" + f(y + r) + "A" + a + f(x + r) + "," + f(y) + "Z";
  }
  function P(d, st) { return { k: "p", d: d, f: st.f || null, s: st.s || null, w: st.w || 1, cap: st.cap || null, join: st.join || null, o: st.o === undefined ? 1 : st.o }; }
  function G(tf, kids, clip) { return { k: "g", tf: tf || [], c: kids, clip: clip || null }; }

  /* ---------- piezas ---------- */
  function ojo(side, e, x, blink, geo, C, ras) {
    if (ras.ojo && ras.ojo !== "caricatura") return ojoBloque(side, e, x, blink, geo, C, ras);
    var s = side === "L" ? 1 : -1, O = geo.ojo, rx = O.rx, ry = O.ry, Rr = rx + 6, ki = rx / 33;
    var top = clamp(e.lidTop + blink * (1 - e.lidTop - e.lidBot + 0.06), 0, 1), bot = clamp(e.lidBot, 0, 1);
    var y0 = -ry + top * 2 * ry, tan = Math.tan(e.lidTilt * Math.PI / 180) * s, yb = ry - bot * 2 * ry;
    var closed = y0 >= yb - 0.5;
    if (closed) { var m = (y0 + yb) / 2; y0 = m; yb = m; }
    var yL = y0 - tan * Rr, yR = y0 + tan * Rr, yC = (yL + yR) / 2 + 2 * e.lidBulge * (1 - blink * 0.5);
    var bL = closed ? yL : yb, bR = closed ? yR : yb, bC = closed ? yC : yb - 7;
    var px = e.pupil[0] * (rx - 15 * ki) * 0.95, py = e.pupil[1] * (ry - 15 * ki) * 0.95, ps = x.pupilScale;
    var kids = [], inner = [];
    if (ras.pliegues) kids.push(P("M" + f(-rx * 0.82) + "," + f(ry * 0.92) + " Q0," + f(ry + 17) + " " + f(rx * 0.82) + "," + f(ry * 0.92), { s: C.ojera, w: 4, cap: "round", o: 0.8 }));
    kids.push(P(E(0, 0, rx, ry), { f: { g: "esclera" } }));
    var pup = [];
    if (ras.iris) pup.push(P(E(0, 0, 16 * ki * (0.75 + 0.25 * ps), 16 * ki * (0.75 + 0.25 * ps)), { f: C.iris, s: C.irisBorde, w: 2.5 }));
    pup.push(P(E(0, 0, 9 * ki * ps, 9 * ki * ps), { f: C.pupila }));
    pup.push(P(E(-5 * ki, -6 * ki, 3.6 * ki, 3.6 * ki), { f: C.brillo, o: 0.95 }));
    inner.push(G([["t", px, py]], pup));
    inner.push(P(E(0, y0 - ry * 0.55, rx + 4, ry * 0.8), { f: C.sombraParpado, o: top > 0.005 ? 0.22 : 0.1 }));
    var tr = O.trazo !== undefined ? O.trazo : 5.5, kt = tr / 5.5, oc0 = C.ojoContorno || C.contorno;
    if (top > 0.005) {
      inner.push(P("M" + f(-Rr) + "," + f(-ry - 8) + " L" + f(Rr) + "," + f(-ry - 8) + " L" + f(Rr) + "," + f(yR) + " Q0," + f(yC) + " " + f(-Rr) + "," + f(yL) + " Z", { f: { g: "parpado" }, s: oc0, w: 4.5 * kt, join: "round" }));
      inner.push(P("M" + f(-Rr) + "," + f(yL - 7) + " Q0," + f(yC - 8) + " " + f(Rr) + "," + f(yR - 7), { s: C.parpadoLinea, w: 2.2, o: 0.8 }));
    }
    if (bot > 0.005) inner.push(P("M" + f(-Rr) + "," + f(ry + 8) + " L" + f(Rr) + "," + f(ry + 8) + " L" + f(Rr) + "," + f(bR) + " Q0," + f(bC) + " " + f(-Rr) + "," + f(bL) + " Z", { f: { g: "parpado" }, s: oc0, w: (closed ? 5.5 : 4) * kt, join: "round" }));
    kids.push(G([], inner, E(0, 0, rx, ry)));
    // cierreLimpio: el aro del contorno se funde al cerrar (queda solo la línea del párpado, no un hueco vacío)
    var oc = ras.cierreLimpio ? 1 - clamp((top + bot - 0.55) / 0.4, 0, 1) : 1;
    if (oc > 0.01) kids.push(P(E(0, 0, rx, ry), { s: oc0, w: tr, o: oc }));
    return G([["t", s === 1 ? -O.dx : O.dx, O.y], ["s", x.eyeScale]], kids);
  }

  // Distancia de (px,py) a la polilínea pts [[x,y],...].
  function distPoli(px, py, pts) {
    var best = 1e9;
    for (var i = 0; i + 1 < pts.length; i++) {
      var ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1], dx = bx - ax, dy = by - ay;
      var u = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1), qx = ax + u * dx - px, qy = ay + u * dy - py;
      best = Math.min(best, Math.sqrt(qx * qx + qy * qy));
    }
    return best;
  }

  /* Ojos "bloque" | "pixel" | "ranura": una forma de tinta recortada por dos párpados invisibles (líneas). Mismo
     vocabulario de expresión que el ojo de caricatura: lidTop/lidBot cierran, lidTilt inclina el corte (ceño o
     tristeza sin cejas), pupil desplaza el bloque y su píxel de brillo, eyeScale escala. Parpadear baja el bloque
     hasta un guion bajo (cursor en reposo). */
  function ojoBloque(side, e, x, blink, geo, C, ras) {
    var s = side === "L" ? 1 : -1, O = geo.ojo, est = ras.ojo, w = O.rx, h = O.ry;
    if (est === "ranura") { w = O.rx * 1.35; h = O.ry * 0.42; }
    var top = clamp(e.lidTop + blink * (1 - e.lidTop - e.lidBot + 0.06), 0, 1), bot = clamp(e.lidBot, 0, 1);
    var tan = Math.tan(e.lidTilt * Math.PI / 180) * s, th = h * (est === "ranura" ? 0.5 : 0.24);
    var yb = h - bot * 2 * h, y0 = -h + top * 2 * h;
    var lid = function (X) { return Math.min(y0 + tan * X, yb - th); };   // línea del párpado superior en X (nunca deja menos que el guion bajo)
    var px = e.pupil[0] * w * 0.32, py = e.pupil[1] * h * 0.2, ps = x.pupilScale, ink = C.ojo, kids = [];
    var forma = blink > 0.35 ? null : e.forma;
    var r = est === "ranura" ? h : Math.min(w, h) * (O.radio !== undefined ? O.radio : 0.28);
    if (est === "pixel") {
      var cols = O.pixeles || 4, c = 2 * w / cols, rows = Math.max(1, Math.round(2 * h / c)), hh = rows * c / 2, cells = [], sq = c * 0.8;
      var chev = [[-w * 1.05, hh * 0.32], [0, -hh * 0.42], [w * 1.05, hh * 0.32]];
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        var X = -w + (i + 0.5) * c, Y = -hh + (j + 0.5) * c, esq = (i === 0 || i === cols - 1) && (j === 0 || j === rows - 1);
        var dentro = forma === "feliz" ? distPoli(X, Y, chev) < c * 0.62 : !(esq && r > c * 0.4) && Y > lid(X) - c * 0.15 && Y < yb + c * 0.15 && (yb - lid(X) > c * 0.5 || j === rows - 1);
        if (dentro) cells.push([X, Y]);
      }
      if (cells.length) {
        var hl = forma === "feliz" || cells.length < cols * 2 ? null : cells.reduce(function (a, b) { return (b[1] - b[0] * 0.7 < a[1] - a[0] * 0.7) ? b : a; });
        kids.push(P(cells.filter(function (q) { return q !== hl; }).map(function (q) { return RR(q[0] - sq / 2, q[1] - sq / 2, sq, sq, sq * 0.2); }).join(""), { f: ink }));
        if (hl) kids.push(P(RR(hl[0] - sq / 2, hl[1] - sq / 2, sq, sq, sq * 0.2), { f: C.ojoBrillo }));
      }
    } else if (forma === "feliz") {
      kids.push(P("M" + f(-w * 1.02) + "," + f(h * 0.3) + " L0," + f(-h * 0.4) + " L" + f(w * 1.02) + "," + f(h * 0.3), { s: ink, w: Math.max(w * 0.62, 9), cap: "round", join: "round" }));
    } else {
      var yL = lid(-w - 2), yR = lid(w + 2), hlS = w * 0.42 * ps;
      var clipP = "M" + f(-w - 2) + "," + f(yL) + " L" + f(w + 2) + "," + f(yR) + " L" + f(w + 2) + "," + f(yb) + " L" + f(-w - 2) + "," + f(yb) + " Z";
      var inner = [P(RR(-w, -h, 2 * w, 2 * h, r), { f: ink })];
      if (yb - Math.max(yL, yR) > h * 0.7) inner.push(P(RR(w - hlS - w * 0.24, -h + w * 0.24 + Math.max(0, Math.min(yL, yR) + h), hlS, hlS * (est === "ranura" ? 0.7 : 1), hlS * 0.22), { f: C.ojoBrillo }));
      kids.push(G([], inner, clipP));
    }
    return G([["t", (s === 1 ? -O.dx : O.dx) + px, O.y + py], ["s", x.eyeScale]], kids);
  }

  function ceja(side, e, x, bob, geo, C) {
    var s = side === "L" ? 1 : -1, CJ = geo.ceja || GEOMETRIA.ceja, L = CJ.L, gw = CJ.grosor, O = geo.ojo;
    var cx = (s === 1 ? -O.dx : O.dx) - s * 2, cy = O.y - O.ry * x.eyeScale - 15 + e.browY + bob + (CJ.dy || 0);
    var d = "M" + f(-L) + ",3 Q0," + f(-2 * e.browCurve - 6) + " " + f(L) + ",3", inner = s * L, kids = [];
    if (C.halo) kids.push(P(d, { s: C.halo, w: gw + 3.5, cap: "round", o: 0.28 }));
    kids.push(P(d, { s: C.ceja, w: gw, cap: "round" }));
    kids.push(P("M" + f(inner * 0.15) + "," + f(-e.browCurve * 0.8 - 2) + " L" + f(inner) + ",3", { s: C.ceja, w: gw * 17 / 13, cap: "round" }));   // más gruesa en el extremo interior
    if (C.cejaBrillo) kids.push(P("M" + f(-L * 0.6) + ",-1 Q0," + f(-2 * e.browCurve - 9) + " " + f(L * 0.6) + ",-1", { s: C.cejaBrillo, w: 1.6, cap: "round", o: 0.5 }));
    return G([["t", cx, cy], ["r", e.browTilt * s]], kids);
  }

  function boca(shape, m, geo, C, ras) {
    if (ras.boca === "geometrica") return bocaGeo(shape, m, geo, C);
    var S = SHAPES[shape] || SHAPES.X, w = S.w, cd = (m.frown + (S.extraFrown || 0)) * 7, kids = [], kTr = geo.trazoBoca || 1;
    var lab = ras.labios && C.labio;
    if (S.closed) {
      var cl = "M" + (-w) + "," + f(cd) + " Q" + f(-w * 0.35) + "," + f(-cd * 0.75 - 1) + " 0," + f(-cd * 0.55) + " Q" + f(w * 0.45) + "," + f(-cd * 0.5) + " " + w + "," + f(cd * 0.9);
      if (lab) {   // labio inferior (medialuna bajo la línea) y un filo del superior
        kids.push(P("M" + f(-w * 0.78) + "," + f(cd * 0.8 + 1) + " Q0," + f(-cd * 0.5 + 13) + " " + f(w * 0.78) + "," + f(cd * 0.75 + 1) + " Q0," + f(-cd * 0.5 + 3) + " " + f(-w * 0.78) + "," + f(cd * 0.8 + 1) + " Z", { f: C.labio, o: 0.85 }));
        kids.push(P("M" + f(-w * 0.7) + "," + f(cd * 0.7 - 1) + " Q0," + f(-cd * 0.6 - 7) + " " + f(w * 0.7) + "," + f(cd * 0.65 - 1) + " Q0," + f(-cd * 0.6 - 2) + " " + f(-w * 0.7) + "," + f(cd * 0.7 - 1) + " Z", { f: C.labio, o: 0.55 }));
      }
      if (C.halo) kids.push(P(cl, { s: C.halo, w: 11, cap: "round", o: 0.3 }));
      kids.push(P(cl, { s: C.contorno, w: (lab ? 5 : 7.5) * kTr, cap: "round" }));
      if (!lab) kids.push(P("M" + f(-w - 5) + "," + f(cd - 5) + " q-3,5 1,10 M" + f(w + 5) + "," + f(cd * 0.9 - 5) + " q3,5 -1,10", { s: C.contorno, w: 3.5, cap: "round", o: 0.85 }));
      if (ras.pliegues) kids.push(P("M-12," + f(11 - cd * 0.3) + " Q0," + f(15 - cd * 0.3) + " 12," + f(11 - cd * 0.3), { s: C.ojera, w: 3, cap: "round", o: 0.5 }));
    } else {
      var up = S.up, dn = S.down, k = S.round ? 0.92 : 0.55, kb = S.round ? 0.95 : 1.02; cd = S.round ? cd * 0.5 : cd * 1.5;
      var path = "M" + (-w) + "," + f(cd) + " C" + f(-w * k) + "," + f(-up * 1.5) + " " + f(w * k) + "," + f(-up * 1.5) + " " + w + "," + f(cd) +
                 " C" + f(w * kb) + "," + f(dn * 1.36) + " " + f(-w * kb) + "," + f(dn * 1.36) + " " + (-w) + "," + f(cd) + " Z";
      var topY = -up * 1.1 + cd * 0.25, inner = [];
      if (S.clench) {
        inner.push(P(R(-60, -40, 120, 100), { f: C.dientes }));
        inner.push(P("M-60," + f(1.5 + cd * 0.5) + " H60", { s: C.dientesLinea, w: 1.8 }));
        [-18, -9, 0, 9, 18].forEach(function (tx) { inner.push(P("M" + tx + ",-20 V30", { s: C.dientesLinea, w: 1.4 })); });
      } else {
        inner.push(P(R(-60, -40, 120, 120), { f: C.bocaInterior }));
        if (S.tongue) {
          var ty = S.tongueUp ? dn * 0.42 : dn * 1.02, tr = dn * (S.tongueUp ? 0.5 : 0.48) * (0.6 + S.tongue);
          inner.push(P(E(2, ty, w * 0.62, tr), { f: C.lengua }));
          if (!S.tongueUp) inner.push(P("M2," + f(dn * 0.7) + " V" + f(dn * 1.2), { s: C.lenguaLinea, w: 1.6, o: 0.7 }));
        }
        if (S.tb) {
          inner.push(P(R(-60, dn - S.tb, 120, 40), { f: C.dientes, o: 0.96 }));
          [-12, 0, 12].forEach(function (tx) { inner.push(P("M" + tx + "," + f(dn - S.tb) + " v30", { s: C.dientesLinea, w: 1.3 })); });
        }
        if (S.tt) {
          inner.push(P(R(-60, -40, 120, 40 + topY + S.tt), { f: C.dientes }));
          [-16, -5.5, 5.5, 16].forEach(function (tx) { inner.push(P("M" + tx + ",-30 V" + f(topY + S.tt), { s: C.dientesLinea, w: 1.3 })); });
        }
      }
      if (lab) kids.push(P(path, { s: C.labio, w: geo.labioAncho || 12, join: "round", o: 0.85 }));   // borde de labio alrededor de la abertura
      kids.push(G([], inner, path));
      if (C.halo) kids.push(P(path, { s: C.halo, w: 9.5, join: "round", o: 0.25 }));
      kids.push(P(path, { s: C.contorno, w: 5.5 * kTr, join: "round" }));
      if (ras.pliegues) kids.push(P("M" + f(-w * 0.45) + "," + f(dn + 9) + " Q0," + f(dn + 13) + " " + f(w * 0.45) + "," + f(dn + 9), { s: C.ojera, w: 3, cap: "round", o: 0.45 }));
    }
    return G([["t", 0, geo.bocaY + m.dy], ["r", m.skew], escBoca(m, geo)], kids);
  }
  function escBoca(m, geo) { return geo.bocaKy ? ["s", m.scale * geo.bocaK, m.scale * geo.bocaKy] : ["s", m.scale * geo.bocaK]; }

  // Boca plana: misma silueta por visema que la orgánica, sin contorno; dientes y lengua como bloques.
  function bocaGeo(shape, m, geo, C) {
    var S = SHAPES[shape] || SHAPES.X, w = S.w, cd = (m.frown + (S.extraFrown || 0)) * 7, ink = C.boca || C.contorno, kids = [];
    if (S.closed) {
      kids.push(P("M" + (-w) + "," + f(cd) + " Q0," + f(-cd * 1.05) + " " + w + "," + f(cd), { s: ink, w: 9, cap: "round" }));
    } else {
      var up = S.up, dn = S.down, path, inner = [];
      if (S.round) path = E(0, (dn - up) * 0.42, w * 0.98, (up + dn) * 0.62);
      else { cd = cd * 1.5; path = "M" + (-w) + "," + f(cd) + " Q0," + f(-up * 1.3 + cd * 0.2) + " " + w + "," + f(cd) + " C" + f(w * 1.02) + "," + f(dn * 1.36) + " " + f(-w * 1.02) + "," + f(dn * 1.36) + " " + (-w) + "," + f(cd) + " Z"; }
      inner.push(P(R(-70, -60, 140, 140), { f: ink }));
      if (S.tongue) inner.push(P(RR(-w * 0.55, dn * (S.tongueUp ? 0.25 : 0.62), w * 1.1, dn * 0.9, dn * 0.3), { f: C.lengua }));
      if (S.clench) inner.push(P(R(-70, -60, 140, 60 + up * 0.25 + cd * 0.2), { f: C.dientes }));
      else if (S.tt && !S.round) inner.push(P(R(-70, -60, 140, 60 - up * 0.55 + S.tt * 0.75), { f: C.dientes }));
      kids.push(G([], inner, path));
    }
    return G([["t", 0, geo.bocaY + m.dy], ["r", m.skew], ["s", m.scale * geo.bocaK]], kids);
  }

  // Vello que viaja con la boca (mismo transform que boca()): bigote sobre el labio de arriba, perilla bajo el de
  // abajo (baja con la apertura del visema = mandíbula). Solo si rasgos.bigote / rasgos.perilla.
  function vello(shape, m, geo, C, ras) {
    var S = SHAPES[shape] || SHAPES.X, cd = (m.frown + (S.extraFrown || 0)) * 7, kids = [];
    if (ras.bigote) {
      var B = geo.bigote, top = S.closed ? Math.min(0, -cd * 0.5) - 3 : -S.up * 1.15;
      // medialuna rellena: B.grosor en el centro, afinándose hasta las puntas (que caen B.caida bajo la comisura)
      var wm = lerp(31, S.w, 0.5) * B.ancho, yy = top - 7 - B.dy, dr = B.caida + cd * 0.55, g = B.grosor;
      kids.push(P("M" + f(-wm) + "," + f(yy + dr) + " Q" + f(-wm * 0.55) + "," + f(yy - g * 1.1) + " 0," + f(yy - g) +
        " Q" + f(wm * 0.55) + "," + f(yy - g * 1.1) + " " + f(wm) + "," + f(yy + dr) +
        " Q" + f(wm * 0.5) + "," + f(yy + 1) + " 0," + f(yy + 0.5) + " Q" + f(-wm * 0.5) + "," + f(yy + 1) + " " + f(-wm) + "," + f(yy + dr) + " Z", { f: C.vello, o: 0.9 }));
    }
    if (ras.perilla) {
      var Q = geo.perilla, low = S.closed ? Math.max(4, cd * 0.6 + 4) : S.down * 1.02, y0 = low + Q.gap, a = Q.arriba / 2, b = Q.abajo / 2, hh = Q.alto;
      if (Q.sombra > 0) {   // sombra de barba: mentón y mandíbula, de comisura a comisura por debajo
        var sw = Math.max(b * 2.9, 60);
        kids.push(P("M" + f(-sw) + "," + f(y0 - 14) + " Q" + f(-sw * 0.95) + "," + f(y0 + hh * 0.95) + " 0," + f(y0 + hh * 1.12) + " Q" + f(sw * 0.95) + "," + f(y0 + hh * 0.95) + " " + f(sw) + "," + f(y0 - 14) +
          " Q" + f(sw * 0.6) + "," + f(y0 + hh * 0.35) + " 0," + f(y0 + hh * 0.42) + " Q" + f(-sw * 0.6) + "," + f(y0 + hh * 0.35) + " " + f(-sw) + "," + f(y0 - 14) + " Z", { f: C.vello, o: Q.sombra }));
      }
      kids.push(P("M" + f(-a) + "," + f(y0) + " Q0," + f(y0 - 3) + " " + f(a) + "," + f(y0) + " L" + f(b) + "," + f(y0 + hh * 0.55) +
        " Q" + f(b * 0.9) + "," + f(y0 + hh) + " 0," + f(y0 + hh) + " Q" + f(-b * 0.9) + "," + f(y0 + hh) + " " + f(-b) + "," + f(y0 + hh * 0.55) + " Z", { f: C.vello, o: 0.92 }));
      if (Q.mandibula > 0) kids.push(P("M" + f(-b * 0.9) + "," + f(y0 + hh * 0.7) + " Q" + f(-b * 1.9) + "," + f(y0 + hh * 0.5) + " " + f(-b * 2.6) + "," + f(y0 - 6) +
        " M" + f(b * 0.9) + "," + f(y0 + hh * 0.7) + " Q" + f(b * 1.9) + "," + f(y0 + hh * 0.5) + " " + f(b * 2.6) + "," + f(y0 - 6), { s: C.vello, w: 4, cap: "round", o: Q.mandibula }));
    }
    return kids.length ? G([["t", 0, geo.bocaY + m.dy], ["r", m.skew], escBoca(m, geo)], kids) : null;
  }

  /** Estado → árbol de primitivas. cfg = { geometria, paleta, rasgos } ya resueltos. */
  function nodos(st, cfg) {
    var x = st.expr, bob = st.browBob || 0, g = cfg.geometria, C = cfg.paleta, ras = cfg.rasgos, kids = [];
    if (ras.mejillas && C.mejilla) { var M = g.mejillas; kids.push(P(E(-M.dx, M.y, M.rx, M.ry) + E(M.dx, M.y, M.rx, M.ry), { f: C.mejilla, o: M.o })); }
    kids.push(ojo("L", x.L, x, st.blink || 0, g, C, ras), ojo("R", x.R, x, st.blink || 0, g, C, ras));
    if (ras.cejas) kids.push(ceja("L", x.L, x, bob, g, C), ceja("R", x.R, x, bob, g, C));
    kids.push(boca(st.mouth, x.mouth, g, C, ras));
    var v = (ras.bigote || ras.perilla) ? vello(st.mouth, x.mouth, g, C, ras) : null;
    if (v) kids.push(v);
    return G([["t", g.offset.x, g.offset.y]], kids);
  }

  function gradientes(cfg) {   // en coordenadas locales del ojo (centro 0,0)
    var O = cfg.geometria.ojo, C = cfg.paleta, Rr = O.rx + 6;
    return {
      esclera: { tipo: "radial", cx: O.rx * 0.16, cy: -O.ry * 0.2, r: 1.5 * Math.max(O.rx, O.ry), stops: [[0, C.esclera[0]], [0.6, C.esclera[1]], [1, C.esclera[2]]] },
      parpado: { tipo: "lineal", x1: -Rr, y1: -O.ry - 8, x2: Rr, y2: O.ry * 0.3, stops: [[0, C.parpado[0]], [0.5, C.parpado[1]], [1, C.parpado[2]]] }
    };
  }

  /* ---------- backend SVG ---------- */
  function tfStr(ops) {
    return ops.map(function (o) { return o[0] === "t" ? "translate(" + f(o[1]) + "," + f(o[2]) + ")" : o[0] === "r" ? "rotate(" + f(o[1]) + ")" : "scale(" + f(o[1]) + (o[2] !== undefined ? "," + f(o[2]) : "") + ")"; }).join(" ");
  }
  function svgNodo(n, idp, cnt) {
    if (n.k === "p") {
      var fill = n.f ? (typeof n.f === "object" ? "url(#" + idp + n.f.g + ")" : n.f) : "none";
      return '<path d="' + n.d + '" fill="' + fill + '"' + (n.s ? ' stroke="' + n.s + '" stroke-width="' + f(n.w) + '"' : "") +
        (n.cap ? ' stroke-linecap="' + n.cap + '"' : "") + (n.join ? ' stroke-linejoin="' + n.join + '"' : "") + (n.o !== 1 ? ' opacity="' + f(n.o) + '"' : "") + "/>";
    }
    var body = n.c.map(function (c) { return svgNodo(c, idp, cnt); }).join("");
    if (n.clip) { var id = idp + "c" + (cnt.n++); body = '<clipPath id="' + id + '"><path d="' + n.clip + '"/></clipPath><g clip-path="url(#' + id + ')">' + body + "</g>"; }
    return n.tf.length ? '<g transform="' + tfStr(n.tf) + '">' + body + "</g>" : "<g>" + body + "</g>";
  }
  function svgDefs(cfg, idp) {
    var gr = gradientes(cfg), out = "<defs>";
    var stops = function (s) { return s.map(function (q) { return '<stop offset="' + q[0] + '" stop-color="' + q[1] + '"/>'; }).join(""); };
    out += '<radialGradient id="' + idp + 'esclera" gradientUnits="userSpaceOnUse" cx="' + f(gr.esclera.cx) + '" cy="' + f(gr.esclera.cy) + '" r="' + f(gr.esclera.r) + '">' + stops(gr.esclera.stops) + "</radialGradient>";
    out += '<linearGradient id="' + idp + 'parpado" gradientUnits="userSpaceOnUse" x1="' + f(gr.parpado.x1) + '" y1="' + f(gr.parpado.y1) + '" x2="' + f(gr.parpado.x2) + '" y2="' + f(gr.parpado.y2) + '">' + stops(gr.parpado.stops) + "</linearGradient>";
    if (cfg.pintado) out += '<filter id="' + idp + 'pint" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b"/><feOffset in="b" dx="-1.5" dy="3.5" result="o"/>' +
      '<feFlood flood-color="' + cfg.paleta.sombra + '" flood-opacity=".5"/><feComposite in2="o" operator="in" result="sh"/>' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation=".8" result="soft"/><feMerge><feMergeNode in="sh"/><feMergeNode in="soft"/></feMerge></filter>';
    return out + "</defs>";
  }
  function inner(st, cfg, idp) {
    idp = idp || "cara-";
    var body = svgNodo(nodos(st, cfg), idp, { n: 0 });
    return svgDefs(cfg, idp) + (cfg.pintado ? '<g filter="url(#' + idp + 'pint)">' + body + "</g>" : body);
  }
  function svg(st, cfg, size) {
    cfg = resolverCfg(cfg || {});
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [VB.x, VB.y, VB.w, VB.h].join(" ") + '"' + (size ? ' width="' + size + '"' : "") + ">" + inner(st, cfg) + "</svg>";
  }

  /* ---------- backend Canvas 2D (síncrono) ---------- */
  function cvNodo(ctx, n, gr) {
    if (n.k === "p") {
      var p = new Path2D(n.d); ctx.save(); ctx.globalAlpha *= n.o;
      if (n.f) {
        if (typeof n.f === "object") {
          var G0 = gr[n.f.g], gg = G0.tipo === "radial" ? ctx.createRadialGradient(G0.cx, G0.cy, 0, G0.cx, G0.cy, G0.r) : ctx.createLinearGradient(G0.x1, G0.y1, G0.x2, G0.y2);
          G0.stops.forEach(function (q) { gg.addColorStop(q[0], q[1]); }); ctx.fillStyle = gg;
        } else ctx.fillStyle = n.f;
        ctx.fill(p);
      }
      if (n.s) { ctx.strokeStyle = n.s; ctx.lineWidth = n.w; ctx.lineCap = n.cap || "butt"; ctx.lineJoin = n.join || "miter"; ctx.stroke(p); }
      ctx.restore(); return;
    }
    ctx.save();
    n.tf.forEach(function (o) { if (o[0] === "t") ctx.translate(o[1], o[2]); else if (o[0] === "r") ctx.rotate(o[1] * Math.PI / 180); else ctx.scale(o[1], o[2] !== undefined ? o[2] : o[1]); });
    if (n.clip) ctx.clip(new Path2D(n.clip));
    n.c.forEach(function (c) { cvNodo(ctx, c, gr); });
    ctx.restore();
  }
  /** Pinta el estado en un contexto 2D. rect = caja destino en px (default: todo el canvas); la cara se encaja con "meet". */
  function pintarEstado(ctx, st, cfg, op) {
    op = op || {};
    var cv = ctx.canvas, r = op.rect || { x: 0, y: 0, w: cv.width, h: cv.height };
    if (op.limpiar !== false) { ctx.clearRect(r.x, r.y, r.w, r.h); }
    if (op.fondo) { ctx.save(); ctx.fillStyle = op.fondo; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore(); }
    var s = Math.min(r.w / VB.w, r.h / VB.h) * (op.zoom || 1);
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(s, s);
    if (cfg.pintado) { ctx.shadowColor = cfg.paleta.sombra; ctx.shadowBlur = 6.4 * s; ctx.shadowOffsetX = -1.5 * s; ctx.shadowOffsetY = 3.5 * s; }
    cvNodo(ctx, nodos(st, cfg), gradientes(cfg));
    ctx.restore();
  }

  /* ---------- cues y tiempo ---------- */
  function cueAt(cues, t) {   // cues: [[start,"A"],...] o [{start,end,value}]
    if (!cues || !cues.length || t < 0) return "X";
    var lo = 0, hi = cues.length - 1, st = function (c) { return c.start !== undefined ? c.start : c[0]; };
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (st(cues[mid]) <= t) lo = mid; else hi = mid - 1; }
    var c = cues[lo]; if (st(c) > t) return "X";
    if (c.end !== undefined && lo === cues.length - 1 && t > c.end) return "X";
    return c.value !== undefined ? c.value : c[1];
  }
  function shiftTrack(track, dt) { return track.map(function (e) { var c = e.slice(); c[0] = Math.max(0, c[0] + dt); return c; }); }

  function resolverCfg(o) {
    var geo = assign({}, GEOMETRIA, o.geometria);
    SUBGEO.forEach(function (k) { geo[k] = assign({}, GEOMETRIA[k], o.geometria && o.geometria[k]); });
    return { geometria: geo, paleta: assign({}, PALETA, o.paleta), rasgos: assign({}, RASGOS, o.rasgos), pintado: !!o.pintado };
  }

  var nInst = 0;
  /** Instancia sin DOM: stateAt(t), svgEn(t), pintarCanvas(ctx, t, op). */
  function crear(o) {
    o = o || {};
    var cfg = resolverCfg(o), EX = {}, k;
    for (k in EXPRESIONES_BASE) EX[k] = normExpr(EXPRESIONES_BASE[k]);
    var src = o.expresiones || {};
    for (k in src) if (k.charAt(0) !== "_") EX[k] = normExpr(src[k]);
    var cues = o.cues || []; if (cues.mouthCues) cues = cues.mouthCues;
    var track = o.pista || [[0, "neutral"]], audioStart = o.inicioAudio || 0, semilla = o.semilla || 0;
    var pb = assign({ inicio: 2.1, periodo: 3.3, jitter: 1.7, dur: 0.17 }, o.parpadeo);
    var manual = { expr: null, mouth: null, blink: null, mira: null }, idp = "cara" + (nInst++) + "-";

    function get(n) { var e = EX[n]; if (!e) throw new Error("Cara: expresión desconocida «" + n + "»"); return e; }
    function exprAt(t) {   // pista: [[t, nombre, dur=0.25, ease="inOut"], ...] ordenada por t
      var i = 0; while (i + 1 < track.length && track[i + 1][0] <= t) i++;
      var cur = track[i], prev = i > 0 ? get(track[i - 1][1]) : get(cur[1]);
      var dur = cur[2] === undefined ? 0.25 : cur[2], u = dur <= 0 ? 1 : clamp((t - cur[0]) / dur, 0, 1);
      return lerpExpr(prev, get(cur[1]), (EASE[cur[3]] || EASE.inOut)(u));
    }
    function blinkAt(t) {   // parpadeo i en inicio + i·periodo + jitter·hash(i): se calcula solo alrededor de t
      var i0 = Math.max(0, Math.floor((t - pb.inicio - pb.jitter - pb.dur) / pb.periodo));
      for (var i = i0; i <= i0 + 2; i++) {
        var d = t - (pb.inicio + i * pb.periodo + pb.jitter * hs(i, 7 + semilla));
        if (d >= 0 && d < pb.dur) { var a = pb.dur * 0.35; return d < a ? d / a : 1 - (d - a) / (pb.dur - a); }
      }
      return 0;
    }
    function stateAt(t) {
      var x = manual.expr || exprAt(t), ta = t - audioStart;
      var cue = manual.mouth || cueAt(cues, ta), talking = cue !== "X";
      var mouth = talking ? cue : (x.idleMouth || "X");
      if (talking && !manual.mouth && x.mouthMap && x.mouthMap[mouth]) mouth = x.mouthMap[mouth];
      var kk = Math.floor(t / 0.9), sx = (hs(kk, 3 + semilla) - 0.5) * 0.09, sy = (hs(kk, 5 + semilla) - 0.5) * 0.06, j = x.jitter || 0;
      if (j) { var q = Math.floor(t * 24); sx += (hs(q, 11) - 0.5) * j * 2; sy += (hs(q, 17) - 0.5) * j; }
      var mi = manual.mira || (o.mirada ? o.mirada(t) : null); if (mi) { sx += mi[0]; sy += mi[1]; }
      var e = JSON.parse(JSON.stringify(x));
      ["L", "R"].forEach(function (s) { e[s].pupil = [clamp(e[s].pupil[0] + sx, -1, 1), clamp(e[s].pupil[1] + sy, -1, 1)]; e[s].lidTop = clamp(e[s].lidTop, 0, 1); e[s].lidBot = clamp(e[s].lidBot, 0, 1); });
      return { expr: e, mouth: mouth, blink: manual.blink !== null ? manual.blink : (x.noBlink ? 0 : blinkAt(t)), browBob: talking ? -1.8 * (OPEN[mouth] || 0) : 0 };
    }
    var api = {
      cfg: cfg, idp: idp, t: 0, stateAt: stateAt,
      svgEn: function (t) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [VB.x, VB.y, VB.w, VB.h].join(" ") + '">' + inner(stateAt(t), cfg, idp) + "</svg>"; },
      pintarCanvas: function (ctx, t, op) { pintarEstado(ctx, stateAt(t), cfg, op); return api; },
      setExpression: function (name, kk) {
        if (name === null) manual.expr = null;
        else { var from = manual.expr || exprAt(api.t || 0); manual.expr = lerpExpr(from, get(name), kk === undefined ? 1 : kk); }
        return api;
      },
      setMouth: function (shape) { manual.mouth = shape || null; return api; },     // "A".."H" | "X" | null (= cues)
      setBlink: function (v) { manual.blink = v === undefined ? null : v; return api; },
      setMirada: function (v) { manual.mira = v || null; return api; },                  // [dx, dy] fijo | null (= opciones.mirada)
      setTrack: function (tr) { track = tr; return api; },
      setAudioStart: function (s) { audioStart = s; return api; }
    };
    return api;
  }

  /** Overlay DOM (SVG) sobre una elipse {cx,cy,rx,ry,rot} o un rectángulo {x,y,w,h,rot} en px del contenedor. */
  function mount(container, o) {
    o = o || {};
    var inst = crear(o), forma = o.forma || { cx: 540, cy: 960, rx: REF.rx, ry: REF.ry, rot: 0 };
    var host = document.createElement("div");
    host.className = "cara-personaje"; host.style.cssText = "position:absolute;pointer-events:none;transform-origin:50% 50%;will-change:transform";
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [VB.x, VB.y, VB.w, VB.h].join(" ") + '" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible"></svg>';
    container.appendChild(host);
    var svgEl = host.firstChild, last = "";
    function layout(fm) {
      forma = fm || forma; var w, h, l, tp;
      if (forma.w !== undefined) {   // rectángulo: la caja de diseño se encaja con "meet" y se centra
        var k = Math.min(forma.w / VB.w, forma.h / VB.h); w = VB.w * k; h = VB.h * k; l = forma.x + (forma.w - w) / 2; tp = forma.y + (forma.h - h) / 2;
      } else { w = VB.w * forma.rx / REF.rx; h = VB.h * forma.ry / REF.ry; l = forma.cx - w / 2; tp = forma.cy - h / 2; }
      host.style.left = l + "px"; host.style.top = tp + "px"; host.style.width = w + "px"; host.style.height = h + "px";
      host.style.transform = "rotate(" + (forma.rot || 0) + "deg)";
    }
    function paint(st) { var s = inner(st, inst.cfg, inst.idp); if (s !== last) { svgEl.innerHTML = s; last = s; } }
    var api = Object.create(inst);
    api.el = host; api.layout = layout;
    api.update = function (t) { inst.t = t; paint(inst.stateAt(t)); return api; };
    ["setExpression", "setMouth", "setBlink"].forEach(function (m) { api[m] = function (a, b) { inst[m](a, b); return api.update(inst.t); }; });
    ["setTrack", "setAudioStart"].forEach(function (m) { api[m] = function (a) { inst[m](a); return api; }; });
    layout(); api.update(0);
    return api;
  }

  var Cara = { mount: mount, crear: crear, svg: svg, nodos: nodos, pintarEstado: pintarEstado, resolverCfg: resolverCfg,
    cueAt: cueAt, lerpExpr: lerpExpr, normExpr: normExpr, shiftTrack: shiftTrack,
    SHAPES: SHAPES, OPEN: OPEN, VIEWBOX: VB, REF: REF, PALETA: PALETA, GEOMETRIA: GEOMETRIA, RASGOS: RASGOS, EXPRESIONES_BASE: EXPRESIONES_BASE };
  if (typeof module !== "undefined" && module.exports) module.exports = Cara; else root.Cara = Cara;
})(typeof window !== "undefined" ? window : globalThis);
