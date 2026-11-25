// lib.mjs — lógica pura (sin E/S) del carril "editar un bruto": silencios, palabras, detección de tomas
// repetidas / arranques en falso / muletillas, plan de cortes, filtros ffmpeg, re-temporizado y encuadre.
// Todo lo que toca disco o lanza procesos vive en medios.mjs; esto se testea en scripts/__tests__/bruto.test.mjs.
import { createHash } from 'node:crypto';

// ------------------------------------------------------------------ parámetros por defecto
export const PARAMS_DEFECTO = {
  ruidoDb: null,            // umbral de silencedetect; null = automático desde la envolvente
  silencioMinimo: 0.25,     // s: silencio más corto que se mapea
  silencioMax: 0.6,         // s: pausas más largas se acortan
  colchonAntes: 0.10,       // s de aire que se deja ANTES de que arranque la voz
  colchonDespues: 0.16,     // s de aire que se deja DESPUÉS de que termina la voz (cola/respiración)
  pausaFrase: 0.35,         // s: hueco entre palabras que parte una frase
  minCorte: 0.12,           // s: cortes más cortos no se hacen (junta sin ganancia)
  minTramo: 0.30,           // s: tramos conservados sin palabras y más cortos que esto se caen
  ventanaTomas: 3,          // cuántas frases hacia delante se comparan buscando la retoma
  distanciaTomas: 15,       // s máximos entre una toma y su retoma
  simToma: 0.7,             // similitud mínima (LCS / longitud) para considerar dos frases la misma toma
  simPrefijo: 0.8,          // similitud mínima de una frase corta con el arranque de la siguiente
  fadeMs: 20,               // micro-fundido de audio en cada junta
  fps: 30,
  muletillasSeguras: ['eh', 'ehh', 'ehm', 'em', 'emm', 'mmm', 'mm', 'hmm', 'ah', 'aah', 'uh', 'um', 'eeh'],
  muletillasDudosas: ['o sea', 'en plan', 'digamos', 'vale', 'bueno', 'pues', 'este', 'tipo', 'sabes', 'nada'],
};

// Frases que whisper "oye" en silencios o ruido (alucinaciones típicas en español). Se descartan.
export const ALUCINACIONES = [
  'subtitulos realizados por la comunidad de amaraorg', 'subtitulos por la comunidad de amaraorg',
  'gracias por ver el video', 'gracias por ver', 'suscribete', 'musica', 'aplausos', 'risas',
  // vistas en la prueba del repo público (2026-11-25): whisper inventó "Subtitulado" en 0,1 s de silencio final
  'subtitulado', 'subtitulado por', 'subtitulos', 'subtitulos en espanol', 'gracias',
];

// ------------------------------------------------------------------ utilidades de texto
export function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function lcs(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1).fill(0);
    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[n];
}

const r3 = (x) => Math.round(x * 1000) / 1000;

// ------------------------------------------------------------------ silencedetect
// Parsea el stderr de `-af silencedetect`. Un silence_start sin su end (silencio hasta el final) se cierra en `duracion`.
export function parsearSilencedetect(stderr, duracion) {
  const out = [];
  let abierto = null;
  for (const linea of String(stderr).split('\n')) {
    let m = linea.match(/silence_start:\s*(-?[\d.]+)/);
    if (m) { abierto = Math.max(0, parseFloat(m[1])); continue; }
    m = linea.match(/silence_end:\s*([\d.]+)/);
    if (m && abierto !== null) { out.push({ inicio: r3(abierto), fin: r3(parseFloat(m[1])) }); abierto = null; }
  }
  if (abierto !== null && duracion != null && duracion > abierto) out.push({ inicio: r3(abierto), fin: r3(duracion) });
  return out.map((s) => ({ ...s, dur: r3(s.fin - s.inicio) }));
}

// Tramos con voz = complemento de los silencios.
export function tramosDeVoz(silencios, duracion) {
  const out = [];
  let t = 0;
  for (const s of [...silencios].sort((a, b) => a.inicio - b.inicio)) {
    if (s.inicio > t + 1e-3) out.push({ inicio: r3(t), fin: r3(s.inicio) });
    t = Math.max(t, s.fin);
  }
  if (duracion - t > 1e-3) out.push({ inicio: r3(t), fin: r3(duracion) });
  return out;
}

// Une tramos de voz en bloques de transcripción: whisper sobre silencios largos alucina y deriva, así que cada bloque
// empieza y acaba en silencio; pero un whisper por micro-tramo es lento, así que se agrupan los que están cerca.
// Por defecto NO se une nada (un whisper por tramo de voz, como recomienda el método): unir tramos para ahorrar
// llamadas mete pausas dentro del bloque y whisper vuelve a repartir mal los tiempos (medido en la prueba).
export function bloquesTranscripcion(tramos, { unirSi = 0, maxDur = 14, margen = 0.12, duracion = Infinity } = {}) {
  const out = [];
  for (const t of tramos) {
    const ult = out[out.length - 1];
    if (ult && t.inicio - ult.fin < unirSi && t.fin - ult.inicio <= maxDur) ult.fin = t.fin;
    else out.push({ inicio: t.inicio, fin: t.fin });
  }
  return out.map((b) => ({ inicio: r3(Math.max(0, b.inicio - margen)), fin: r3(Math.min(duracion, b.fin + margen)) }));
}

// ------------------------------------------------------------------ whisper → palabras
// whisper-cli -ojf devuelve tokens BPE: una palabra nueva empieza con espacio; los tokens especiales van entre [_ _].
export function tokensAPalabras(transcription, offset = 0) {
  const palabras = [];
  for (const seg of transcription || []) {
    for (const tk of seg.tokens || []) {
      const txt = tk.text || '';
      if (/^\s*\[_/.test(txt) || /^\s*<\|/.test(txt)) continue;
      const s = offset + (tk.offsets?.from ?? 0) / 1000, e = offset + (tk.offsets?.to ?? 0) / 1000;
      const nueva = txt.startsWith(' ') || palabras.length === 0;
      if (nueva) { if (txt.trim()) palabras.push({ w: txt.trim(), s: r3(s), e: r3(e) }); }
      else { const u = palabras[palabras.length - 1]; u.w += txt.trim(); u.e = r3(e); }
    }
  }
  return palabras.filter((p) => normalizar(p.w) !== '' || /[¿?¡!]/.test(p.w));
}

// Créditos de subtítulos inventados ("Subtitulado por <nombre>", "Subtítulos por la comunidad de…"): frase corta que
// empieza así. Visto en la prueba del repo público: "Subtitulado por Jnkoil" en 0,1 s de silencio final.
const PREFIJOS_FANTASMA = ['subtitulado por', 'subtitulos por', 'subtitulos realizados', 'transcripcion por'];

export function esAlucinacion(texto) {
  const norm = normalizar(texto), n = norm.replace(/\s/g, '');
  if (!n.length) return false;
  if (ALUCINACIONES.some((a) => n === a.replace(/\s/g, ''))) return true;
  return norm.split(' ').length <= 8 && PREFIJOS_FANTASMA.some((p) => norm.startsWith(p));
}

// Los timestamps de whisper son una partición contigua (sin huecos): una pausa real se reparte entre las palabras
// vecinas. Se corrige contra los silencios medidos: ninguna palabra empieza ni termina dentro de un silencio.
export function ajustarPalabrasASilencios(palabras, silencios) {
  return palabras.map((p) => {
    let { s, e } = p;
    for (const z of silencios) {
      if (s >= z.inicio && s < z.fin) s = z.fin;          // arranca en silencio → al final del silencio
      if (e > z.inicio && e <= z.fin) e = z.inicio;       // acaba en silencio → al principio del silencio
      if (z.inicio > s && z.fin < e && (z.fin - z.inicio) > 0.5 * (e - s)) {
        // un silencio grande EN MEDIO de la palabra: la palabra está mal anclada; se queda con el lado más largo
        if (z.inicio - s >= e - z.fin) e = z.inicio; else s = z.fin;
      }
    }
    if (e <= s) e = s + 0.05;
    return { ...p, s: r3(s), e: r3(e) };
  });
}

// Micro-valles de energía dentro de un tramo de voz (las pausas de una coma duran 80–200 ms y no llegan a "silencio").
// `envDb`: envolvente en dB; umbral relativo al nivel de habla del tramo (p80 − caida), nunca por debajo del ruido.
export function detectarValles(envDb, hop, { inicio, fin, ruidoDb = -45, caida = 20, minDur = 0.05 } = {}) {
  const i0 = Math.max(0, Math.round(inicio / hop)), i1 = Math.min(envDb.length - 1, Math.round(fin / hop));
  if (i1 - i0 < 4) return [];
  const nivel = Array.from(envDb.slice(i0, i1 + 1)).sort((a, b) => a - b)[Math.floor((i1 - i0) * 0.8)];
  const umbral = Math.max(ruidoDb, nivel - caida);
  const out = [];
  let a = null;
  for (let i = i0; i <= i1; i++) {
    const bajo = envDb[i] < umbral;
    if (bajo && a === null) a = i;
    if ((!bajo || i === i1) && a !== null) {
      const b = bajo ? i : i - 1;
      if ((b - a + 1) * hop >= minDur && a > i0 && b < i1) out.push({ inicio: r3(a * hop), fin: r3((b + 1) * hop) });
      a = null;
    }
  }
  return out;
}

// Bordes de la VOZ dentro de un tramo: silencedetect cuenta una respiración como "no silencio", así que el tramo puede
// arrancar 0,2–0,3 s antes de la primera palabra (medido con voz humana). Primer y último punto con nivel de habla
// (p80 − caida) sostenido 30 ms. Si no hay, devuelve el tramo tal cual.
export function bordesDeVoz(envDb, hop, { inicio, fin, ruidoDb = -45, caida = 20, sostener = 0.03 } = {}) {
  const i0 = Math.max(0, Math.round(inicio / hop)), i1 = Math.min(envDb.length - 1, Math.round(fin / hop));
  if (i1 - i0 < 4) return { inicio, fin };
  const nivel = Array.from(envDb.slice(i0, i1 + 1)).sort((a, b) => a - b)[Math.floor((i1 - i0) * 0.8)];
  const umbral = Math.max(ruidoDb, nivel - caida);
  const k = Math.max(1, Math.round(sostener / hop));
  const sostenido = (i, dir) => { for (let j = 0; j < k; j++) if (!(envDb[i + dir * j] >= umbral)) return false; return true; };
  let a = i0, b = i1;
  while (a < i1 && !sostenido(a, 1)) a++;
  while (b > a && !sostenido(b, -1)) b--;
  if (b - a < k) return { inicio, fin };
  return { inicio: r3(a * hop), fin: r3((b + 1) * hop) };
}

// Re-alineación forzada de las palabras de UN tramo de voz contra la envolvente: los bordes del tramo y los
// micro-valles son anclas reales; cada valle se casa (orden monótono, ≤ 0,45 s) con la frontera de palabra más cercana,
// con preferencia por las que llevan puntuación. Entre anclas, los tiempos de whisper se re-escalan linealmente.
// Corrige el defecto típico de whisper de "aplastar" las primeras palabras y estirar la última antes de una pausa.
export function anclarAValles(palabras, valles, ventana) {
  const n = palabras.length;
  if (!n) return [];
  const front = [];
  for (let k = 0; k < n - 1; k++) front.push({ k, t: (palabras[k].e + palabras[k + 1].s) / 2, punt: /[,.;:?!…]$/.test(palabras[k].w) });
  // Alineación global monótona (programación dinámica): un emparejamiento voraz deja que un micro-valle (el cierre de
  // una oclusiva, 60 ms) le robe la frontera a la pausa de la coma (200 ms) y descuadra todo lo que sigue (medido).
  // Puntuación de casar valle v con frontera f: (puntuación ? 1 : 0,3) × peso por duración × cercanía.
  const vs = [...valles].sort((a, b) => a.inicio - b.inicio);
  const sc = (v, f) => {
    const dist = Math.abs(f.t - (v.inicio + v.fin) / 2);
    if (dist > 0.45) return 0;
    return (f.punt ? 1 : 0.3) * Math.min(1, (v.fin - v.inicio) / 0.15) * (1 - dist / 0.45);
  };
  const V = vs.length, F = front.length;
  const dp = Array.from({ length: V + 1 }, () => new Float64Array(F + 1));
  for (let i = 1; i <= V; i++) for (let j = 1; j <= F; j++) {
    const s = sc(vs[i - 1], front[j - 1]);
    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], s > 0 ? dp[i - 1][j - 1] + s : -Infinity);
  }
  const anclas = [];
  for (let i = V, j = F; i > 0 && j > 0;) {
    if (dp[i][j] === dp[i - 1][j]) i--;
    else if (dp[i][j] === dp[i][j - 1]) j--;
    else { anclas.unshift({ k: front[j - 1].k, v: vs[i - 1] }); i--; j--; }
  }
  const out = palabras.map((p) => ({ ...p }));
  let desde = 0, ini = ventana.inicio;
  const tramos = [...anclas.map((a) => ({ hasta: a.k, fin: a.v.inicio, sig: a.v.fin })), { hasta: n - 1, fin: ventana.fin, sig: null }];
  for (const tr of tramos) {
    const ws = out.slice(desde, tr.hasta + 1);
    const a = palabras[desde].s, b = palabras[tr.hasta].e;
    const esc = b - a > 0.02 ? (tr.fin - ini) / (b - a) : null;
    ws.forEach((w, j) => {
      const o = palabras[desde + j];
      if (esc) { w.s = r3(ini + (o.s - a) * esc); w.e = r3(ini + (o.e - a) * esc); }
      else { const paso = (tr.fin - ini) / ws.length; w.s = r3(ini + j * paso); w.e = r3(ini + (j + 1) * paso); }
    });
    desde = tr.hasta + 1; ini = tr.sig;
  }
  return out;
}

// ------------------------------------------------------------------ frases
export function agruparFrases(palabras, { pausaFrase = PARAMS_DEFECTO.pausaFrase } = {}) {
  const frases = [];
  let cur = [];
  const cerrar = () => { if (cur.length) frases.push(cur); cur = []; };
  palabras.forEach((p, i) => {
    if (cur.length && p.s - palabras[i - 1].e >= pausaFrase) cerrar();
    cur.push({ ...p, i });
    if (/[.?!…]$/.test(p.w)) cerrar();
  });
  cerrar();
  return frases.map((ps, k) => ({
    k, palabras: ps, inicio: ps[0].s, fin: ps[ps.length - 1].e,
    texto: ps.map((p) => p.w).join(' '),
    tokens: ps.map((p) => normalizar(p.w)).filter(Boolean),
  }));
}

// ------------------------------------------------------------------ tomas repetidas y arranques en falso
// Agrupa frases consecutivas que son "la misma toma" (parecidas, o una es el arranque truncado de la otra) y en cada
// grupo se queda con la ÚLTIMA COMPLETA (longitud ≥ 80 % de la más larga del grupo). Las demás se descartan.
export function relacionToma(a, b, p = PARAMS_DEFECTO) {
  const la = a.tokens.length, lb = b.tokens.length;
  if (!la || !lb) return null;
  const sim = lcs(a.tokens, b.tokens) / Math.max(la, lb);
  if (Math.min(la, lb) >= 3 && sim >= p.simToma) return { tipo: 'toma-repetida', sim };
  // a es el arranque truncado de b (o al revés: b empieza igual que a pero se corta)
  const corta = la <= lb ? a : b, larga = la <= lb ? b : a;
  const lc = corta.tokens.length;
  if (lc >= 1 && lc < larga.tokens.length) {
    const pre = lcs(corta.tokens, larga.tokens.slice(0, lc + 1)) / lc;
    const primeraIgual = corta.tokens[0] === larga.tokens[0];
    if (primeraIgual && pre >= p.simPrefijo && (lc >= 2 || corta.palabras.length === 1)) return { tipo: 'arranque-en-falso', sim: pre };
  }
  return null;
}

export function detectarTomas(frases, p = PARAMS_DEFECTO) {
  const grupoDe = new Map();
  const grupos = [];
  for (let i = 0; i < frases.length; i++) {
    for (let j = i + 1; j <= Math.min(frases.length - 1, i + p.ventanaTomas); j++) {
      if (frases[j].inicio - frases[i].fin > p.distanciaTomas) break;
      const rel = relacionToma(frases[i], frases[j], p);
      if (!rel) continue;
      let g = grupoDe.get(i);
      if (g === undefined) { g = grupos.length; grupos.push({ miembros: new Set([i]), rels: [] }); grupoDe.set(i, g); }
      grupos[g].miembros.add(j); grupos[g].rels.push({ i, j, ...rel });
      if (!grupoDe.has(j)) grupoDe.set(j, g);
      break; // una frase se enlaza con su retoma más cercana; la cadena sigue desde j
    }
  }
  const descartes = [];
  for (const g of grupos) {
    const idx = [...g.miembros].sort((a, b) => a - b);
    const maxLen = Math.max(...idx.map((k) => frases[k].tokens.length));
    const completas = idx.filter((k) => frases[k].tokens.length >= 0.8 * maxLen);
    const queda = completas[completas.length - 1];
    for (const k of idx) {
      if (k === queda) continue;
      const f = frases[k];
      const rel = g.rels.find((r) => r.i === k || r.j === k);
      const esPrefijo = f.tokens.length < 0.8 * maxLen;
      descartes.push({
        inicio: f.inicio, fin: f.fin, motivo: esPrefijo ? 'arranque-en-falso' : 'toma-repetida',
        detalle: `se conserva la toma de ${frases[queda].inicio.toFixed(2)} s ("${recortarTexto(frases[queda].texto)}")` +
          (rel ? ` · similitud ${rel.sim.toFixed(2)}` : ''),
        texto: f.texto, decision: 'cortar', frase: k,
      });
    }
    // Lo que queda entre dos tomas del mismo grupo y no pertenece a ninguna probablemente es resto de la toma mala.
    for (let k = idx[0] + 1; k < queda; k++) {
      if (g.miembros.has(k)) continue;
      descartes.push({
        inicio: frases[k].inicio, fin: frases[k].fin, motivo: 'entre-tomas',
        detalle: 'frase entre una toma descartada y la que se conserva: probablemente parte de la toma mala',
        texto: frases[k].texto, decision: 'pendiente', frase: k,
      });
    }
  }
  return descartes.sort((a, b) => a.inicio - b.inicio);
}

function recortarTexto(t, n = 48) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }

// Repetición inmediata de 1 a 4 palabras ("vamos a, vamos a ver"): se corta la primera aparición.
export function detectarRepeticionesInmediatas(palabras, { maxN = 4, maxHueco = 0.8 } = {}) {
  const tok = palabras.map((p) => normalizar(p.w));
  const out = [];
  let i = 0;
  while (i < tok.length) {
    let hecho = false;
    for (let n = maxN; n >= 1; n--) {
      if (i + 2 * n > tok.length) continue;
      let igual = true;
      for (let k = 0; k < n; k++) if (!tok[i + k] || tok[i + k] !== tok[i + n + k]) { igual = false; break; }
      if (!igual) continue;
      if (n === 1 && tok[i].length < 2) continue;
      const hueco = palabras[i + n].s - palabras[i + n - 1].e;
      if (hueco > maxHueco) continue;
      out.push({
        inicio: palabras[i].s, fin: palabras[i + n].s, motivo: 'repeticion-inmediata',
        detalle: `"${palabras.slice(i, i + n).map((p) => p.w).join(' ')}" repetido`,
        texto: palabras.slice(i, i + n).map((p) => p.w).join(' '),
        decision: n === 1 ? 'pendiente' : 'cortar', palabras: [i, i + n - 1],
      });
      i += n; hecho = true; break;
    }
    if (!hecho) i++;
  }
  return out;
}

// Muletillas: las "seguras" (eh, mmm…) se cortan solas; las "dudosas" (bueno, o sea, vale…) solo se proponen cuando
// van aisladas por pausas o al principio/final de frase, y quedan PENDIENTES de confirmación humana.
export function detectarMuletillas(palabras, p = PARAMS_DEFECTO) {
  const seguras = new Set(p.muletillasSeguras.map(normalizar));
  const esRelleno = (n) => seguras.has(n) || /^e+h+m*$|^e+m+$|^m{2,}$|^a+h+$|^h?m{2,}$/.test(n);
  const dudosas = p.muletillasDudosas.map((d) => normalizar(d).split(' '));
  const tok = palabras.map((x) => normalizar(x.w));
  const out = [];
  for (let i = 0; i < tok.length; i++) {
    if (!tok[i]) continue;
    if (esRelleno(tok[i])) {
      out.push({ inicio: palabras[i].s, fin: palabras[i].e, motivo: 'muletilla', detalle: `relleno "${palabras[i].w}"`,
        texto: palabras[i].w, decision: 'cortar', palabras: [i, i] });
      continue;
    }
    for (const d of dudosas) {
      const n = d.length;
      if (tok.slice(i, i + n).join(' ') !== d.join(' ')) continue;
      const antes = i === 0 ? Infinity : palabras[i].s - palabras[i - 1].e;
      const despues = i + n >= palabras.length ? Infinity : palabras[i + n].s - palabras[i + n - 1].e;
      const finFrase = /[.?!…,]$/.test(palabras[i + n - 1].w) || despues >= p.pausaFrase;
      const inicioFrase = i === 0 || /[.?!…]$/.test(palabras[i - 1].w) || antes >= p.pausaFrase;
      const aislada = antes >= 0.15 && despues >= 0.15;
      const coletilla = d.join(' ') === 'vale' && /\?$/.test(palabras[i + n - 1].w);   // "…, ¿vale?"
      const entreComas = i > 0 && /,$/.test(palabras[i - 1].w) && /,$/.test(palabras[i + n - 1].w);   // "que, o sea, no"
      if (aislada || coletilla || entreComas || (inicioFrase && /,$/.test(palabras[i + n - 1].w)) || (finFrase && antes >= 0.15)) {
        out.push({ inicio: palabras[i].s, fin: palabras[i + n - 1].e, motivo: 'muletilla',
          detalle: `posible muletilla "${palabras.slice(i, i + n).map((x) => x.w).join(' ')}" (confirmar: también es palabra con contenido)`,
          texto: palabras.slice(i, i + n).map((x) => x.w).join(' '), decision: 'pendiente', palabras: [i, i + n - 1] });
      }
      break;
    }
  }
  return out;
}

// ------------------------------------------------------------------ plan de cortes
// Silencios largos → descartes (el intervalo ya lleva descontado el aire que se deja a cada lado).
export function descartesDeSilencio(silencios, duracion, p = PARAMS_DEFECTO) {
  const out = [];
  for (const z of silencios) {
    const esCabeza = z.inicio <= 1e-3, esCola = Math.abs(z.fin - duracion) <= 1e-3;
    if (!esCabeza && !esCola && z.fin - z.inicio < p.silencioMax) continue;
    const a = esCabeza ? 0 : z.inicio + p.colchonDespues;
    const b = esCola ? duracion : z.fin - p.colchonAntes;
    if (b - a < p.minCorte) continue;
    out.push({
      inicio: r3(a), fin: r3(b), motivo: 'silencio',
      detalle: esCabeza ? 'silencio de cabeza' : esCola ? 'silencio de cola' : `pausa de ${(z.fin - z.inicio).toFixed(2)} s → queda ${(z.fin - z.inicio - (b - a)).toFixed(2)} s`,
      texto: '', decision: 'cortar',
    });
  }
  return out;
}

// Quita descartes contenidos en otro de más peso (una muletilla dentro de una toma que ya se va entera).
export function depurarDescartes(descartes) {
  const peso = { 'toma-repetida': 3, 'arranque-en-falso': 3, 'entre-tomas': 2, 'repeticion-inmediata': 1, muletilla: 1, silencio: 0, manual: 4 };
  const orden = [...descartes].sort((a, b) => a.inicio - b.inicio || (peso[b.motivo] ?? 0) - (peso[a.motivo] ?? 0));
  return orden.filter((d, i) => !orden.some((o, j) => j !== i && o.motivo !== 'silencio' && d.motivo !== 'silencio' &&
    (peso[o.motivo] ?? 0) > (peso[d.motivo] ?? 0) && o.inicio <= d.inicio + 1e-3 && o.fin >= d.fin - 1e-3));
}

function unirIntervalos(iv) {
  const s = [...iv].filter((x) => x.fin > x.inicio).sort((a, b) => a.inicio - b.inicio);
  const out = [];
  for (const x of s) {
    const u = out[out.length - 1];
    if (u && x.inicio <= u.fin + 1e-6) u.fin = Math.max(u.fin, x.fin); else out.push({ inicio: x.inicio, fin: x.fin });
  }
  return out;
}

// Ajusta un instante a la rejilla de frames. Entre el frame anterior y el siguiente elige el que cae en menos energía
// (así el corte no muerde una consonante). Sin envolvente, el más cercano.
export function ajustarAFrame(t, fps, energiaEn) {
  const a = Math.floor(t * fps + 1e-9) / fps, b = Math.ceil(t * fps - 1e-9) / fps;
  if (a === b || !energiaEn) return r3(Math.round(t * fps) / fps);
  const ea = energiaEn(a), eb = energiaEn(b);
  if (Math.abs(ea - eb) < 1e-9) return r3(t - a <= b - t ? a : b);
  return r3(ea < eb ? a : b);
}

// Busca el valle de energía más profundo en [t - ventana, t + ventana] (para cortes en mitad del habla).
export function valleCercano(t, envolvente, { hop = 0.005, ventana = 0.08 } = {}) {
  if (!envolvente || !envolvente.length) return t;
  const i0 = Math.max(0, Math.floor((t - ventana) / hop)), i1 = Math.min(envolvente.length - 1, Math.ceil((t + ventana) / hop));
  let best = Math.round(t / hop), bv = Infinity;
  for (let i = i0; i <= i1; i++) if (envolvente[i] < bv) { bv = envolvente[i]; best = i; }
  return r3(best * hop);
}

// Construye la lista de tramos a CONSERVAR (en segundos de la fuente) a partir de silencios + descartes.
export function planificar({ duracion, silencios, descartes, palabras, envolvente, hop = 0.005, params = {} }) {
  const p = { ...PARAMS_DEFECTO, ...params };
  const cortes = [];
  // 1) los silencios largos llegan como descartes con motivo "silencio" (ver descartesDeSilencio): así una pausa
  //    dramática se conserva cambiando su decisión, igual que cualquier otro descarte.
  // 2) descartes con decisión "cortar" o "pendiente" (la propuesta de la IA se planifica; el humano la confirma)
  const enHabla = (t) => !silencios.some((z) => t >= z.inicio && t <= z.fin);
  for (const d of descartes) {
    if (d.decision === 'conservar') continue;
    let a = d.inicio, b = d.fin;
    if (d.motivo === 'silencio') { cortes.push({ inicio: a, fin: b }); continue; }
    // Si el borde cae en habla continua, se lleva al valle de energía más cercano; si cae en silencio, se deja aire.
    a = enHabla(a) ? valleCercano(a, envolvente, { hop }) : a;
    b = enHabla(b) ? valleCercano(b, envolvente, { hop }) : b;
    // Un descarte de frase entera se come todo el aire (silencio o respiración) hasta la palabra siguiente y desde la
    // anterior, menos los colchones: si no, queda un trozo de respiración suelto en la junta (medido con voz humana).
    if (!['muletilla', 'repeticion-inmediata'].includes(d.motivo) && palabras?.length) {
      const sigP = palabras.find((w) => w.s >= d.fin - 0.02);
      const antP = [...palabras].reverse().find((w) => w.e <= d.inicio + 0.02);
      if (sigP) b = Math.max(b, sigP.s - p.colchonAntes);
      if (antP) a = Math.min(a, antP.e + p.colchonDespues);
    } else {
      const sig = silencios.find((z) => z.inicio >= b - 0.02 && z.inicio - b < 0.1);
      if (sig && !['muletilla', 'repeticion-inmediata'].includes(d.motivo)) b = Math.max(b, sig.fin - p.colchonAntes);
    }
    cortes.push({ inicio: a, fin: b });
  }
  let unidos = unirIntervalos(cortes).filter((c) => c.fin - c.inicio >= p.minCorte);
  // 3) complemento → conservar
  let conservar = [];
  let t = 0;
  for (const c of unidos) { if (c.inicio > t) conservar.push({ inicio: t, fin: c.inicio }); t = Math.max(t, c.fin); }
  if (duracion > t) conservar.push({ inicio: t, fin: duracion });
  // 4) tramos minúsculos sin palabras dentro → fuera
  const tienePalabras = (x) => (palabras || []).some((w) => (w.s + w.e) / 2 > x.inicio && (w.s + w.e) / 2 < x.fin);
  conservar = conservar.filter((x) => x.fin - x.inicio >= p.minTramo || tienePalabras(x));
  // 4b) aire en las juntas. Al quitar algo entre dos pausas cortas (una muletilla, un arranque en falso) las pausas
  //     de los dos lados se suman en la junta. Cada lado deja como mucho su colchón, y un tramo que es puro aire
  //     (sin palabras y dentro de un silencio) se cae. Las pausas que el humano decidió conservar no se tocan.
  const respetadas = descartes.filter((d) => d.motivo === 'silencio' && d.decision === 'conservar');
  const silEn = (t) => silencios.find((z) => t >= z.inicio - 1e-3 && t <= z.fin + 1e-3 &&
    !respetadas.some((d) => d.inicio < z.fin && d.fin > z.inicio));
  // sin palabras: fuera si es silencio puro o dura < 1 s (un trozo de respiración entre dos cortes no aporta nada;
  // algo más largo puede ser un gesto o una risa a propósito, y se deja para que lo mire el humano)
  conservar = conservar.filter((x) => tienePalabras(x) ||
    (x.fin - x.inicio >= 1 && !silencios.some((z) => x.inicio >= z.inicio - 0.02 && x.fin <= z.fin + 0.02)));
  for (let i = 0; i + 1 < conservar.length; i++) {
    const izq = conservar[i], der = conservar[i + 1];
    const zi = silEn(izq.fin);
    if (zi && izq.fin - zi.inicio > p.colchonDespues + 0.04) izq.fin = Math.max(izq.inicio + 0.1, zi.inicio + p.colchonDespues);
    const zd = silEn(der.inicio);
    if (zd && zd.fin - der.inicio > p.colchonAntes + 0.04) der.inicio = Math.min(der.fin - 0.1, zd.fin - p.colchonAntes);
  }
  // 5) rejilla de frames (vídeo y audio cortan en el MISMO instante → duraciones idénticas, cero deriva)
  const energiaEn = envolvente ? (tt) => envolvente[Math.min(envolvente.length - 1, Math.max(0, Math.round(tt / hop)))] : null;
  conservar = conservar.map((x) => ({ inicio: ajustarAFrame(x.inicio, p.fps, energiaEn), fin: ajustarAFrame(x.fin, p.fps, energiaEn) }))
    .filter((x) => x.fin - x.inicio >= 1 / p.fps - 1e-9);
  // sin solapes tras redondear
  for (let i = 1; i < conservar.length; i++) if (conservar[i].inicio < conservar[i - 1].fin) conservar[i].inicio = conservar[i - 1].fin;
  conservar = conservar.filter((x) => x.fin - x.inicio >= 1 / p.fps - 1e-9);
  return conservar.map((x, i) => {
    const ws = (palabras || []).filter((w) => (w.s + w.e) / 2 > x.inicio && (w.s + w.e) / 2 < x.fin);
    return { id: `t${String(i + 1).padStart(2, '0')}`, inicio: x.inicio, fin: x.fin, dur: r3(x.fin - x.inicio), texto: ws.map((w) => w.w).join(' ') };
  });
}

// Huella del plan: si cambian descartes/parámetros y no se re-planificó, cortar.mjs se niega.
export function huellaPlan(descartes, params) {
  const clave = JSON.stringify({ d: descartes.map((d) => [r3(d.inicio), r3(d.fin), d.motivo, d.decision]), p: params });
  return createHash('sha256').update(clave).digest('hex').slice(0, 16);
}

export function validarConservar(conservar, duracion, fps) {
  const errores = [];
  if (!Array.isArray(conservar) || !conservar.length) errores.push('conservar está vacío');
  (conservar || []).forEach((x, i) => {
    if (!(x.fin > x.inicio)) errores.push(`${x.id || i}: fin (${x.fin}) <= inicio (${x.inicio})`);
    if (x.inicio < 0 || x.fin > duracion + 1e-3) errores.push(`${x.id || i}: fuera de la duración de la fuente (${duracion} s)`);
    if (i && x.inicio < conservar[i - 1].fin - 1e-6) errores.push(`${x.id || i}: se solapa con el tramo anterior o está desordenado`);
    // tolerancia de 0,02 frames: los tiempos se guardan con 3 decimales (1/30 = 0,0333…)
    for (const t of [x.inicio, x.fin]) if (Math.abs(t * fps - Math.round(t * fps)) > 0.02 && Math.abs(t - duracion) > 1e-3) {
      errores.push(`${x.id || i}: ${t} no cae en la rejilla de ${fps} fps (re-planifica o redondea a 1/${fps} s)`);
    }
  });
  return errores;
}

// ------------------------------------------------------------------ filtro de corte (una sola pasada)
// Cada tramo: trim + fps (normaliza VFR) + número EXACTO de frames; atrim + micro-fundidos + número EXACTO de muestras.
// Así vídeo y audio de cada tramo miden lo mismo y el concat no acumula deriva (el fallo clásico de cortar por
// segmentos sueltos y concatenar con -c copy: el AAC rellena cada segmento a múltiplos de 1024 muestras).
// Los tiempos se guardan con 3 decimales, pero aquí se recalculan EXACTOS desde el índice de frame: con trim=8.867 el
// frame de 8.8667 quedaría fuera y el vídeo iría un frame tarde. Se resta el inicio exacto (no el pts del primer
// frame, que en VFR no cae en la rejilla) y fps=start_time=0 re-muestrea a la rejilla desde 0.
export function filtroCorte(conservar, { fps = 30, sr = 48000, fadeMs = 20, conAudio = true } = {}) {
  const partes = [], etiquetas = [];
  const f = fadeMs / 1000;
  conservar.forEach((x, i) => {
    const fa = Math.round(x.inicio * fps), fb = Math.round(x.fin * fps);
    const a = (fa / fps).toFixed(6), b = (fb / fps).toFixed(6);
    const nFrames = fb - fa;
    const d = nFrames / fps;
    const nMuestras = Math.round(d * sr);
    // el trim de vídeo abre y cierra medio frame antes: incluye el frame que cae justo en `a`, excluye el de `b`
    partes.push(`[0:v]trim=start=${Math.max(0, fa / fps - 0.5 / fps).toFixed(6)}:end=${(fb / fps - 0.5 / fps).toFixed(6)},setpts=PTS-${a}/TB,` +
      `fps=${fps}:start_time=0:round=near,tpad=stop_mode=clone:stop=2,trim=end_frame=${nFrames},setpts=N/(${fps}*TB)[v${i}]`);
    if (conAudio) {
      const fd = Math.min(f, d / 4);
      partes.push(`[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,aresample=${sr},` +
        `afade=t=in:st=0:d=${fd.toFixed(4)},afade=t=out:st=${Math.max(0, nMuestras / sr - fd).toFixed(4)}:d=${fd.toFixed(4)},` +
        `apad=whole_len=${nMuestras},atrim=end_sample=${nMuestras}[a${i}]`);
      etiquetas.push(`[v${i}][a${i}]`);
    } else etiquetas.push(`[v${i}]`);
  });
  const n = conservar.length;
  return partes.join(';\n') + ';\n' + etiquetas.join('') + `concat=n=${n}:v=1:a=${conAudio ? 1 : 0}${conAudio ? '[v][a]' : '[v]'}`;
}

// Mapa fuente → salida de cada tramo (para re-temporizar palabras, overlays o cualquier marca puesta sobre el bruto).
export function mapaTiempos(conservar, fps = 30) {
  let t = 0;
  return conservar.map((x) => {
    const d = (Math.round(x.fin * fps) - Math.round(x.inicio * fps)) / fps;   // mismo cálculo que filtroCorte
    const m = { id: x.id, fuente: [x.inicio, x.fin], salida: [r3(t), r3(t + d)] };
    t += d;
    return m;
  });
}

export function fuenteASalida(t, mapa) {
  for (const m of mapa) if (t >= m.fuente[0] - 1e-6 && t <= m.fuente[1] + 1e-6) return r3(m.salida[0] + (t - m.fuente[0]));
  return null; // cae en un tramo cortado
}

export function retemporizarPalabras(palabras, mapa) {
  const out = [];
  for (const w of palabras) {
    const mid = (w.s + w.e) / 2;
    const m = mapa.find((x) => mid >= x.fuente[0] && mid <= x.fuente[1]);
    if (!m) continue;
    const s = Math.max(m.fuente[0], w.s), e = Math.min(m.fuente[1], w.e);
    out.push({ texto: w.w, inicio: r3(m.salida[0] + (s - m.fuente[0])), fin: r3(m.salida[0] + (e - m.fuente[0])), tramo: m.id });
  }
  return out;
}

// Correcciones de texto para captions (whisper falla en nombres propios y cifras): [{ de: "Clot", a: "Claude" }].
// Casa por palabra normalizada y conserva la puntuación pegada a la palabra original.
export function aplicarCorrecciones(palabras, correcciones = []) {
  if (!correcciones.length) return palabras;
  const mapa = new Map(correcciones.map((c) => [normalizar(c.de), c.a]));
  return palabras.map((w) => {
    const a = mapa.get(normalizar(w.texto));
    if (a === undefined) return w;
    const lead = w.texto.match(/^[¿¡"'(]*/)[0], trail = w.texto.match(/[.,;:!?…"')]*$/)[0];
    return { ...w, texto: lead + a + trail, corregida: w.texto };
  });
}

// Formato whisper-cli (transcription[].offsets en ms, una palabra por segmento): así generate-captions.mjs lo lee
// tal cual y su reparto lineal por segmento es exacto.
export function aTranscriptWhisper(palabrasSalida) {
  return {
    transcription: palabrasSalida.map((w) => ({
      timestamps: { from: msATc(w.inicio), to: msATc(w.fin) },
      offsets: { from: Math.round(w.inicio * 1000), to: Math.round(w.fin * 1000) },
      text: ' ' + w.texto,
    })),
  };
}
function msATc(s) {
  const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ encuadre 9:16 y punch-ins
// Ventana de recorte de la relación de salida dentro de la fuente, centrada en (cx, cy) y escalada por `zoom`.
// Devuelve enteros pares (yuv420p) y clampeados a la fuente.
export function ventanaRecorte({ anchoFuente: W, altoFuente: H, anchoSalida = 1080, altoSalida = 1920, cx, cy, zoom = 1, anclaY = 0.38 }) {
  const rel = anchoSalida / altoSalida;
  let h = H, w = h * rel;
  if (w > W) { w = W; h = w / rel; }
  w /= zoom; h /= zoom;
  const par = (v) => Math.max(2, Math.floor(v / 2) * 2);
  w = par(w); h = par(h);
  const cxx = cx ?? W / 2;
  // la cara se coloca en `anclaY` de la altura de la ventana (tercio superior), no centrada
  const cyy = cy ?? H / 2;
  let x = Math.round(cxx - w / 2), y = Math.round(cyy - h * anclaY);
  x = Math.min(Math.max(0, x), W - w); y = Math.min(Math.max(0, y), H - h);
  return { x, y, w, h };
}

// Intervalos de zoom constante a partir de instantes de cambio. Alterna 1 ↔ zoom (el punch-in clásico que disimula
// los jump cuts), respetando una permanencia mínima. `puntos` en segundos de salida.
export function intervalosZoom(puntos, duracion, { zoom = 1.12, minPermanencia = 1.5, fps = 30, empiezaCon = 1 } = {}) {
  const snap = (t) => Math.round(t * fps) / fps;
  const cambios = [];
  let ultimo = 0;
  for (const t of [...puntos].sort((a, b) => a - b)) {
    const ts = snap(t);
    if (ts - ultimo < minPermanencia || duracion - ts < minPermanencia) continue;
    cambios.push(ts); ultimo = ts;
  }
  const out = [];
  let z = empiezaCon, ini = 0;
  for (const c of cambios) { out.push({ inicio: r3(ini), fin: r3(c), zoom: z }); ini = c; z = z === 1 ? zoom : 1; }
  out.push({ inicio: r3(ini), fin: r3(snap(duracion)), zoom: z });
  return out.filter((x) => x.fin > x.inicio);
}

// Zooms explícitos "t:z,t:z" (cada uno vale desde t hasta el siguiente).
export function parsearZoomsManuales(spec, duracion, fps = 30) {
  const pts = String(spec).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [t, z] = s.split(':').map(Number);
    if (!Number.isFinite(t) || !Number.isFinite(z) || z < 1) throw new Error(`zoom inválido "${s}" (formato t:zoom, zoom ≥ 1)`);
    return { t: Math.round(t * fps) / fps, z };
  }).sort((a, b) => a.t - b.t);
  const out = [];
  let ini = 0, z = 1;
  for (const p of pts) { if (p.t > ini) out.push({ inicio: r3(ini), fin: r3(p.t), zoom: z }); ini = p.t; z = p.z; }
  out.push({ inicio: r3(ini), fin: r3(Math.round(duracion * fps) / fps), zoom: z });
  return out.filter((x) => x.fin > x.inicio);
}

// Cambios de frase en el clip ya cortado (puntuación final o pausa), para colocar punch-ins.
export function cambiosDeFrase(palabrasSalida, { pausa = 0.3 } = {}) {
  const out = [];
  for (let i = 1; i < palabrasSalida.length; i++) {
    const prev = palabrasSalida[i - 1], w = palabrasSalida[i];
    if (/[.?!…]$/.test(prev.texto) || w.inicio - prev.fin >= pausa) out.push(r3(w.inicio - 0.05));
  }
  return out;
}

// Expresión de x de crop que interpola linealmente entre puntos de seguimiento [{t, x}] (para ffmpeg crop x='…').
// `desfase`: si el filtro trabaja sobre un trozo recortado (t local), se suma para volver al tiempo del clip.
export function expresionSeguimiento(puntos, desfase = 0) {
  if (!puntos.length) return '0';
  if (puntos.length === 1) return String(Math.round(puntos[0].x));
  const T = desfase ? `(t+${desfase})` : 't';
  let expr = String(Math.round(puntos[puntos.length - 1].x));
  for (let i = puntos.length - 2; i >= 0; i--) {
    const a = puntos[i], b = puntos[i + 1];
    const tramo = `${Math.round(a.x)}+(${Math.round(b.x) - Math.round(a.x)})*(${T}-${a.t})/${r3(b.t - a.t)}`;
    expr = `if(lt(${T}\\,${b.t})\\,${tramo}\\,${expr})`;
  }
  return `if(lt(${T}\\,${puntos[0].t})\\,${Math.round(puntos[0].x)}\\,${expr})`;
}

// Suaviza una trayectoria de centros de cara: mediana móvil + zona muerta (no persigue micro-movimientos).
export function suavizarTrayectoria(muestras, { ventana = 5, zonaMuerta = 40 } = {}) {
  const med = muestras.map((m, i) => {
    const v = muestras.slice(Math.max(0, i - (ventana >> 1)), i + (ventana >> 1) + 1).map((x) => x.x).sort((a, b) => a - b);
    return { t: m.t, x: v[v.length >> 1] };
  });
  const out = [];
  for (const m of med) {
    const u = out[out.length - 1];
    if (!u || Math.abs(m.x - u.x) >= zonaMuerta) out.push(m);
  }
  if (out.length && med.length && out[out.length - 1].t !== med[med.length - 1].t) out.push({ t: med[med.length - 1].t, x: out[out.length - 1].x });
  return out;
}

export function mediana(v) { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; }

// Caja de la cara en coordenadas de salida, dada la ventana de recorte. Para comprobar safe zones.
export function caraEnSalida(cara, ventana, anchoSalida = 1080, altoSalida = 1920) {
  const k = anchoSalida / ventana.w;
  return { x: Math.round((cara.x - ventana.x) * k), y: Math.round((cara.y - ventana.y) * k), w: Math.round(cara.w * k), h: Math.round(cara.h * k) };
}

export function caraEnZonaSegura(caja, zona = { x0: 35, x1: 1045, y0: 220, y1: 1470 }) {
  return caja.x >= zona.x0 && caja.x + caja.w <= zona.x1 && caja.y >= zona.y0 && caja.y + caja.h <= zona.y1;
}
