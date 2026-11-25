/* personaje.js — "Muñeco": personaje 3D de ejemplo, neutro, hecho solo con código (Three.js). Determinista.
 *
 * Una gota/judía con la cara pintada como calcomanía, bracitos y piernitas cortos con manos y pies redondos.
 * Sin pelo, sin ropa, sin accesorios: es una base para aprender el motor y para hacer tu propio personaje
 * (modulos/personaje-3d/HAZ-TU-PERSONAJE.md). Todo es función pura de t: render(t) no guarda estado entre
 * fotogramas, así que se puede saltar hacia atrás y adelante (y el render de Hyperframes sale igual siempre).
 *
 * Uso (script clásico; THREE se inyecta, así sirve con el three vendorizado de cada proyecto):
 *   <script src="assets/cara.js"></script>          // scripts/personaje/cara.js (dibuja la cara en un canvas)
 *   <script src="assets/poses-data.js"></script>    // window.MUNECO_POSES = poses.json (sin fetch en render)
 *   <script src="assets/personaje.js"></script>     // expone window.Personaje
 *   <script type="module">
 *     import * as THREE from 'three';
 *     const p = Personaje.crear(THREE, { paleta: Personaje.paletaDesdeCSS() });
 *     scene.add(p.grupo, Personaje.luces(THREE));
 *     p.setGuion({ poses: [[0,'reposo'],[2.1,'senalar-der']], expresiones: [[0,'neutro'],[2,'contento']],
 *                  boca: cues,   // [[t,'A'..'H'|'X']] o el JSON de scripts/personaje/build-mouth-data.mjs
 *                  inicioAudio: 0.4, offset: (t) => ({ x, y, z, rot, rotY }) });
 *     // en el onUpdate del timeline GSAP: p.render(t); renderer.render(scene, camara);
 *   </script>
 *
 * Opciones de crear: datos (default window.MUNECO_POSES), Cara (default window.Cara), paleta (pisa colores; ver
 *   PALETA), semilla (cambia el parpadeo), offset (desplazamiento externo, función de t).
 * Devuelve: { grupo, render(t), setGuion(g), posar({pose, expresion, visema, mira, parpadeo, t}), estado(t), alto,
 *   poses, expresiones, paleta, anclaBoca() }.
 */
(function (root) {
  "use strict";

  // Paleta neutra por defecto. Cada proyecto la pisa con sus colores (ver paletaDesdeCSS).
  var PALETA = {
    cuerpo: "#e9e4da",     // el cuerpo entero (el valor más claro: lo que se lee a 120 px)
    sombra: "#bdb6a8",     // manos y pies (un tono más oscuro que el cuerpo)
    acento: "#7aa2ff",     // mejillas/rubor sutil y la marca de la panza
    tinta: "#1d1f24",      // ojos y boca
    brillo: "#ffffff",     // brillo del ojo, dientes
    lengua: "#d9776b",
    interior: "#3a2226"    // interior de la boca
  };

  var rad = function (g) { return g * Math.PI / 180; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var EASE = {
    inOut: function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
    out: function (u) { return 1 - Math.pow(1 - u, 3); },
    linear: function (u) { return u; }
  };
  var OPEN = { A: 0, X: 0, B: 0.3, C: 0.65, D: 1, E: 0.55, F: 0.35, G: 0.3, H: 0.65 };
  function cueAt(cues, t) {
    if (!cues || !cues.length || t < 0) return "X";
    var lo = 0, hi = cues.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (cues[mid][0] <= t) lo = mid; else hi = mid - 1; }
    return cues[lo][0] > t ? "X" : cues[lo][1];
  }
  function normCues(b) {
    if (!b) return [];
    if (Array.isArray(b)) return b;
    if (b.cues) return b.cues;
    if (b.mouthCues) return b.mouthCues.map(function (c) { return [c.start, c.value]; });
    return [];
  }

  /* ------------------------------------------------------------------ forma de gota (judía) */
  // Elipsoide deformado: más ancho abajo que arriba. Se aplica igual al cuerpo y al parche de la cara para que
  // la calcomanía quede pegada a la superficie.
  var R = { x: 0.43, y: 0.56, z: 0.40 };
  function deformar(v) {
    var y = v.y;                                        // -1..1 en la esfera unidad
    var ancho = 1 + 0.13 * (-y) - 0.04 * y * y;          // panza más ancha que la "frente"
    v.x *= R.x * ancho; v.z *= R.z * ancho; v.y = y * R.y;
    if (v.y < -R.y * 0.82) v.y = lerp(v.y, -R.y * 0.82, 0.55);   // base algo aplanada: se apoya
    return v;
  }
  function geoGota(THREE, escala, phiStart, phiLength, thetaStart, thetaLength, segW, segH) {
    var g = new THREE.SphereGeometry(1, segW || 48, segH || 32, phiStart, phiLength, thetaStart, thetaLength);
    var p = g.attributes.position, v = new THREE.Vector3();
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); deformar(v); v.multiplyScalar(escala || 1); p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true; g.computeVertexNormals();
    return g;
  }

  /* ------------------------------------------------------------------ crear */
  function crear(THREE, op) {
    op = op || {};
    var D = op.datos || root.MUNECO_POSES;
    if (!D || !D.poses) throw new Error("Personaje: faltan los datos (poses.json → window.MUNECO_POSES u opciones.datos)");
    var CaraLib = op.Cara || root.Cara;
    if (!CaraLib) throw new Error("Personaje: falta cara.js (window.Cara u opciones.Cara)");
    var C = Object.assign({}, PALETA, op.paleta || {});
    var semilla = op.semilla || 0;
    var Y0 = 0.2 + R.y;                                  // centro del cuerpo: deja sitio a las piernas

    var grupo = new THREE.Group(); grupo.name = "muneco";
    var movil = new THREE.Group(); grupo.add(movil);     // offset(t) + balanceo
    var mat = function (color, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.62, metalness: 0 }, extra)); };
    var mCuerpo = mat(C.cuerpo, { roughness: 0.55 });
    var mSombra = mat(C.sombra, { roughness: 0.6 });
    function malla(geo, m, padre, x, y, z) { var o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); padre.add(o); return o; }

    /* --- piernas (pivote en la cadera) */
    var piernas = {};
    [["piernaI", -1], ["piernaD", 1]].forEach(function (pl) {
      var piv = new THREE.Group(); piv.position.set(pl[1] * 0.17, 0.2, 0); movil.add(piv);
      malla(new THREE.CapsuleGeometry(0.055, 0.08, 6, 12), mCuerpo, piv, 0, -0.07, 0);
      var pie = malla(new THREE.SphereGeometry(0.085, 20, 14), mSombra, piv, 0, -0.16, 0.035);
      pie.scale.set(1.05, 0.62, 1.35);
      piernas[pl[0]] = piv;
    });

    /* --- cuerpo (pivote en la base, así el squash se apoya en el suelo) */
    var cuerpo = new THREE.Group(); cuerpo.position.set(0, 0.2, 0); movil.add(cuerpo);
    var gota = malla(geoGota(THREE, 1), mCuerpo, cuerpo, 0, R.y * 0.86, 0);
    var centroGota = R.y * 0.86;

    // marca de la panza: un botón redondo del color de acento (un punto de color sin ser ropa)
    var mPanza = mat(C.acento, { roughness: 0.45 });
    var pPanza = deformar(new THREE.Vector3(0, Math.cos(rad(118)), Math.sin(rad(118))));
    var panza = malla(new THREE.SphereGeometry(0.06, 24, 16), mPanza, gota, pPanza.x, pPanza.y, pPanza.z - 0.012);
    panza.scale.set(1, 1, 0.38); panza.rotation.x = rad(18);

    // cara: canvas transparente pintado por cara.js, como calcomanía sobre un parche de la misma superficie
    var cvCara = document.createElement("canvas"); cvCara.width = 1024; cvCara.height = 1024;
    var ctxCara = cvCara.getContext("2d");
    var texCara = new THREE.CanvasTexture(cvCara); texCara.colorSpace = THREE.SRGBColorSpace; texCara.anisotropy = 4;
    var mCara = new THREE.MeshStandardMaterial({ map: texCara, transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    var gCara = geoGota(THREE, 1.006, Math.PI / 2 - rad(46), rad(92), rad(26), rad(80), 40, 28);
    var parcheCara = malla(gCara, mCara, gota, 0, 0, 0); parcheCara.renderOrder = 2;

    /* --- brazos (hombro → codo → mano), salen de los costados */
    var brazos = {};
    [["I", -1], ["D", 1]].forEach(function (bl) {
      var hombro = new THREE.Group(); hombro.position.set(bl[1] * 0.35, centroGota - 0.04, 0.02); hombro.rotation.z = rad(bl[1] * 18); cuerpo.add(hombro);
      malla(new THREE.CapsuleGeometry(0.05, 0.12, 8, 16), mCuerpo, hombro, 0, -0.08, 0);
      var codo = new THREE.Group(); codo.position.set(0, -0.15, 0); hombro.add(codo);
      malla(new THREE.CapsuleGeometry(0.043, 0.07, 6, 12), mCuerpo, codo, 0, -0.05, 0);
      var mano = malla(new THREE.SphereGeometry(0.07, 20, 14), mSombra, codo, 0, -0.13, 0); mano.scale.set(1, 0.95, 0.85);
      brazos["hombro" + bl[0]] = hombro; brazos["codo" + bl[0]] = codo;
    });

    /* --- sombra de contacto (degradado radial, sin shadow maps) */
    var sombraSuelo = (function () {
      var c = document.createElement("canvas"); c.width = c.height = 128;
      var g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(0,0,0,0.9)"); gr.addColorStop(0.5, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.002; m.renderOrder = -2; m.userData.sinCaja = true;
      return m;
    })();
    movil.add(sombraSuelo);

    /* --- articulaciones y poses como datos */
    var art = Object.assign({ cuerpo: cuerpo }, brazos, piernas);
    Object.keys(art).forEach(function (n) { var o = art[n]; o.userData.base = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() }; });
    var POSES = D.poses, TR = D.transicion || { dur: 0.3, ease: "inOut", squash: {} }, VIDA = D.vida || {}, CICLOS = D.ciclos || {};
    var SQ = Object.assign({ sy: 0.08, sx: 0.06, amort: 11, frec: 30, dur: 0.34 }, TR.squash);

    function valores(nombre) {
      var p = POSES[nombre]; if (!p) throw new Error("Personaje: pose desconocida «" + nombre + "»");
      return p;
    }
    function mezcla(a, b, k) {
      var out = {};
      Object.keys(art).forEach(function (n) {
        var o = {};
        ["r", "p", "s"].forEach(function (c) {
          var def = c === "s" ? [1, 1, 1] : [0, 0, 0];
          var va = (a[n] && a[n][c]) || def, vb = (b && b[n] && b[n][c]) || def;
          o[c] = b ? [lerp(va[0], vb[0], k), lerp(va[1], vb[1], k), lerp(va[2], vb[2], k)] : va.slice();
        });
        out[n] = o;
      });
      var ma = a.mira || [0, 0], mb = (b && b.mira) || [0, 0];
      out.mira = b ? [lerp(ma[0], mb[0], k), lerp(ma[1], mb[1], k)] : ma.slice();
      return out;
    }
    function aplicar(pose) {
      Object.keys(art).forEach(function (n) {
        var o = art[n], b = o.userData.base, q = pose[n];
        o.rotation.set(b.r.x + rad(q.r[0]), b.r.y + rad(q.r[1]), b.r.z + rad(q.r[2]));
        o.position.set(b.p.x + q.p[0], b.p.y + q.p[1], b.p.z + q.p[2]);
        o.scale.set(b.s.x * q.s[0], b.s.y * q.s[1], b.s.z * q.s[2]);
      });
    }
    // ciclos procedurales sumados encima de la pose (w = peso, para mezclar con la pose vecina)
    function ciclo(nombre, pose, t, w) {
      if (!nombre || w <= 0) return 0;
      if (nombre === "caminar") {
        var c = Object.assign({ pasosPorSegundo: 2.2, pierna: 28, brazo: 22, bote: 0.03, giro: 3 }, CICLOS.caminar);
        var fase = t * c.pasosPorSegundo * Math.PI, s = Math.sin(fase);
        pose.piernaI.r[0] += c.pierna * s * w; pose.piernaD.r[0] -= c.pierna * s * w;
        pose.hombroI.r[0] -= c.brazo * s * w; pose.hombroD.r[0] += c.brazo * s * w;
        pose.cuerpo.r[2] += c.giro * s * w;
        return c.bote * Math.abs(Math.cos(fase)) * w;
      }
      if (nombre === "saludar") {
        var k = Object.assign({ frecuencia: 2.6, amplitud: 22 }, CICLOS.saludar);
        pose.codoD.r[2] += k.amplitud * Math.sin(t * k.frecuencia * 2 * Math.PI) * w;
        return 0;
      }
      return 0;
    }

    /* --- cara */
    var caraCfg = D.cara || {};
    var cara = null, guion = { poses: [[0, "reposo"]], expresiones: [[0, "neutro"]], boca: [], inicioAudio: 0, offset: null };
    function nuevaCara() {
      cara = CaraLib.crear({
        expresiones: D.expresiones, cues: normCues(guion.boca), inicioAudio: guion.inicioAudio || 0, semilla: 9 + semilla,
        pista: guion.expresiones.map(function (e) { return [e[0], e[1], e[2] === undefined ? 0.22 : e[2], e[3] || "inOut"]; }),
        parpadeo: VIDA.parpadeo, geometria: JSON.parse(JSON.stringify(caraCfg.geometria || {})),
        rasgos: Object.assign({ ojo: "caricatura", boca: "organica", iris: false, cejas: true, cierreLimpio: true, mejillas: true }, caraCfg.rasgos || {}),
        paleta: { contorno: C.tinta, ceja: C.tinta, pupila: C.tinta, iris: C.tinta, irisBorde: C.tinta, brillo: C.brillo,
          esclera: [C.brillo, C.brillo, "#dcdcdc"], parpado: [C.cuerpo, C.cuerpo, C.cuerpo], parpadoLinea: C.tinta, sombraParpado: C.tinta,
          bocaInterior: C.interior, lengua: C.lengua, lenguaLinea: C.interior, dientes: C.brillo, dientesLinea: "#cfcfcf", mejilla: C.acento, ojera: C.cuerpo }
      });
    }
    nuevaCara();
    function pintarCara(t) { cara.pintarCanvas(ctxCara, t, { zoom: caraCfg.zoom || 1 }); texCara.needsUpdate = true; }

    /* --- estado puro en t */
    function poseAt(t) {
      var tr = guion.poses, i = 0;
      while (i + 1 < tr.length && tr[i + 1][0] <= t) i++;
      var cur = tr[i], prev = i > 0 ? tr[i - 1] : cur, dur = TR.dur || 0.3;
      var d = t - cur[0], u = i > 0 ? clamp(d / dur, 0, 1) : 1;
      var k = (EASE[TR.ease] || EASE.inOut)(u), opts = cur[2] || {};
      var sq = i > 0 && d >= 0 && d < SQ.dur ? (opts.squash === undefined ? 1 : opts.squash) * Math.exp(-d * SQ.amort) * Math.cos(d * SQ.frec) : 0;
      return { actual: cur[1], anterior: prev[1], k: k, squash: sq };
    }
    function energia(t) {
      var cues = normCues(guion.boca), ta = t - (guion.inicioAudio || 0), en = 0;
      for (var j = 0; j < 4; j++) en += OPEN[cueAt(cues, ta - j * 0.04)] || 0;
      return en / 4;
    }
    function estado(t) {
      var pa = poseAt(t);
      return { t: t, pose: pa.actual, poseAnterior: pa.anterior, k: +pa.k.toFixed(4), squash: +pa.squash.toFixed(4),
        boca: cueAt(normCues(guion.boca), t - (guion.inicioAudio || 0)), energia: +energia(t).toFixed(3) };
    }

    var V = { resp: Object.assign({ periodo: 3.2, amp: 0.014 }, VIDA.respiracion), bal: VIDA.balanceo === undefined ? 1.2 : VIDA.balanceo,
      habla: Object.assign({ bote: 0.018, inclina: 2.2 }, VIDA.habla) };

    function componer(t, pose, squash, en) {
      // vida: respiración + bote del habla + squash del cambio de pose (pivote en la base)
      var br = Math.sin(t * 2 * Math.PI / V.resp.periodo), bc = cuerpo.userData.base.s;
      cuerpo.scale.set(bc.x * pose.cuerpo.s[0] * (1 - V.resp.amp * 0.5 * br) * (1 + SQ.sx * squash),
        bc.y * pose.cuerpo.s[1] * (1 + V.resp.amp * br + V.habla.bote * en) * (1 - SQ.sy * squash),
        bc.z * pose.cuerpo.s[2] * (1 - V.resp.amp * 0.5 * br) * (1 + SQ.sx * squash));
      cuerpo.rotation.x += rad(V.habla.inclina * en);
    }

    function render(t) {
      var pa = poseAt(t), A = valores(pa.anterior), B = valores(pa.actual);
      var pose = mezcla(A, B, pa.k);
      var bote = ciclo(A.ciclo, pose, t, 1 - pa.k) + ciclo(B.ciclo, pose, t, pa.k);
      aplicar(pose);
      var en = energia(t);
      componer(t, pose, pa.squash, en);
      var off = (guion.offset || op.offset) ? (guion.offset || op.offset)(t) || {} : {};
      movil.position.set(off.x || 0, (off.y || 0) + bote, off.z || 0);
      movil.rotation.set(0, off.rotY || 0, rad(V.bal * Math.sin(t * 0.9)) + (off.rot || 0));
      cara.setExpression(null); cara.setMouth(null); cara.setBlink(); cara.setMirada(pose.mira);
      pintarCara(t);
      return estado(t);
    }

    // Pose estática para hojas y herramientas (sin guion, sin parpadeo).
    function posar(o) {
      o = o || {};
      var pose = mezcla(valores(o.pose || "reposo"), null, 0);
      aplicar(pose); componer(o.t || 0, pose, 0, 0);
      movil.position.set(0, 0, 0); movil.rotation.set(0, 0, 0);
      cara.setExpression(o.expresion || "neutro"); cara.setMouth(o.visema && o.visema !== "X" ? o.visema : null);
      cara.setBlink(o.parpadeo || 0); cara.setMirada(o.mira || pose.mira);
      pintarCara(o.t || 0);
    }

    function setGuion(g) {
      g = g || {};
      guion = {
        poses: (g.poses && g.poses.length ? g.poses : [[0, "reposo"]]).slice().sort(function (a, b) { return a[0] - b[0]; }),
        expresiones: (g.expresiones && g.expresiones.length ? g.expresiones : [[0, "neutro"]]).slice().sort(function (a, b) { return a[0] - b[0]; }),
        boca: g.boca || [], inicioAudio: g.inicioAudio || 0, offset: g.offset || null
      };
      guion.poses.forEach(function (p) { valores(p[1]); });
      nuevaCara();
      return api;
    }

    // alto visible en reposo (unidades), para encuadrar a px exactos
    posar({ pose: "reposo" });
    grupo.updateMatrixWorld(true);
    var caja = new THREE.Box3(), tmp = new THREE.Box3();
    grupo.traverse(function (o) {
      if (!o.isMesh || o.userData.sinCaja || !o.visible) return;
      o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); caja.union(tmp);
    });

    var api = {
      grupo: grupo, render: render, setGuion: setGuion, posar: posar, estado: estado,
      alto: caja.max.y - Math.min(0, caja.min.y), ancho: caja.max.x - caja.min.x, caja: caja,
      poses: Object.keys(POSES), expresiones: Object.keys(D.expresiones || {}), paleta: C,
      anclaBoca: function () { grupo.updateMatrixWorld(true); return gota.localToWorld(new THREE.Vector3(0, R.y * 0.15, R.z)); },
      _canvasCara: cvCara, _panza: panza
    };
    return api;
  }

  /* ------------------------------------------------------------------ luz recomendada */
  // Principal cálida-neutra arriba a la izquierda, relleno frío suave, contraluz que separa la silueta del fondo.
  function luces(THREE, k) {
    k = k || 1;
    var g = new THREE.Group(); g.name = "muneco-luces";
    var principal = new THREE.DirectionalLight("#fff4e6", 2.4 * k); principal.position.set(-2.5, 4, 5);
    var relleno = new THREE.DirectionalLight("#c9d8ff", 0.8 * k); relleno.position.set(3.5, 1, 3);
    var contra = new THREE.DirectionalLight("#ffffff", 2.2 * k); contra.position.set(2.5, 3, -4);
    var hemi = new THREE.HemisphereLight("#ffffff", "#2a2d33", 0.9 * k);
    g.add(principal, relleno, contra, hemi);
    return g;
  }

  /** Lee las variables de marca (--superficie-alta, --texto, --acento…) del documento para vestir al muñeco. */
  function paletaDesdeCSS(doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc) return {};
    var cs = getComputedStyle(doc.documentElement), v = function (n) { return cs.getPropertyValue(n).trim(); };
    var out = {};
    if (v("--texto")) out.cuerpo = v("--texto");
    if (v("--texto-suave")) out.sombra = v("--texto-suave");
    if (v("--acento")) out.acento = v("--acento");
    if (v("--fondo-hondo")) out.tinta = v("--fondo-hondo");
    return out;
  }

  var Personaje = { crear: crear, luces: luces, paletaDesdeCSS: paletaDesdeCSS, PALETA: PALETA, version: 1 };
  if (typeof module !== "undefined" && module.exports) module.exports = Personaje; else root.Personaje = Personaje;
})(typeof window !== "undefined" ? window : globalThis);
