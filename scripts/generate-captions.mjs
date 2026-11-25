#!/usr/bin/env node
// generate-captions.mjs — de un transcript con tiempos por palabra a bloques de captions listos para pegar en una
// composición Hyperframes (HTML de los bloques + líneas de timeline GSAP + metadatos).
//
// Entiende tres formatos de entrada (los detecta solo):
//   1. `npx hyperframes transcribe … --json` → transcript.json = [{ text, start, end }, ...]
//   2. scripts/bruto/cortar.mjs → words.json = { palabras: [{ texto, inicio, fin }, ...] }
//   3. whisper-cli (-ojf) o transcript-cortado.json → { transcription: [{ text, offsets: { from, to } }, ...] }
//
// Uso:
//   node scripts/generate-captions.mjs <transcript.json> <salida-bloques.html> <salida-meta.json>
//        [--palabras-clave palabras.json]   → { "positivas": [...], "negativas": [...] } para resaltar en color
//        [--max-palabras 4] [--max-duracion 2.6]
//
// Los bloques llevan class="clip" y data-start/data-duration/data-track-index (Render Contract). El estilo (fuente,
// color, posición) lo pone tu composición con las clases .cap, .cap-inner, .cap-word, .positiva, .negativa.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'si', 'no', 'que', 'de', 'del', 'al', 'a',
  'en', 'con', 'por', 'para', 'sin', 'sobre', 'es', 'son', 'está', 'están', 'ser', 'estar', 'tiene', 'hay', 'lo', 'le',
  'les', 'me', 'te', 'se', 'su', 'sus', 'tu', 'tus', 'mi', 'mis', 'esto', 'eso', 'este', 'esta', 'ya', 'también',
]);

export function normalizar(w) {
  return String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,:;"'()«»…]/g, '').trim();
}

/** Convierte cualquiera de los tres formatos a [{ text, start, end }] en segundos. */
export function extraerPalabras(data) {
  if (Array.isArray(data)) {
    return data.filter((w) => w && w.text !== undefined).map((w) => ({ text: String(w.text).trim(), start: +w.start, end: +w.end }))
      .filter((w) => w.text);
  }
  if (data && Array.isArray(data.palabras)) {
    return data.palabras.map((w) => ({ text: String(w.texto ?? w.w).trim(), start: +(w.inicio ?? w.s), end: +(w.fin ?? w.e) }))
      .filter((w) => w.text);
  }
  if (data && Array.isArray(data.transcription)) {
    const out = [];
    for (const seg of data.transcription) {
      const text = (seg.text || '').trim();
      if (!text) continue;
      const start = seg.offsets.from / 1000, end = seg.offsets.to / 1000;
      const tokens = text.split(/\s+/).filter(Boolean);
      const per = Math.max(0.05, end - start) / tokens.length;   // segmentos de varias palabras: reparto lineal
      tokens.forEach((t, i) => out.push({ text: t, start: start + i * per, end: start + (i + 1) * per }));
    }
    return out;
  }
  throw new Error('formato de transcript no reconocido (ver la cabecera de generate-captions.mjs)');
}

/** Clasifica una palabra: 'positiva' | 'negativa' | ''. */
export function clasificar(raw, claves = {}) {
  const n = normalizar(raw);
  if (!n || STOPWORDS.has(n)) return '';
  if ((claves.negativas || []).map(normalizar).includes(n)) return 'negativa';
  if ((claves.positivas || []).map(normalizar).includes(n)) return 'positiva';
  return '';
}

/** Agrupa palabras en bloques cortos (corte duro en . ? !, blando en coma con ≥ 3 palabras). */
export function agruparBloques(words, { maxPalabras = 4, minPalabras = 1, maxDuracion = 2.6 } = {}) {
  const bloques = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    if (cur.length < minPalabras && bloques.length) {
      const prev = bloques[bloques.length - 1]; prev.words.push(...cur); prev.end = cur[cur.length - 1].end;
    } else bloques.push({ words: cur.slice(), start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of words) {
    cur.push(w);
    const ult = w.text.slice(-1);
    const dur = cur[cur.length - 1].end - cur[0].start;
    if (/[.?!]/.test(ult)) flush();
    else if (ult === ',' && cur.length >= 3) flush();
    else if (cur.length >= maxPalabras || dur >= maxDuracion) flush();
  }
  flush();
  return bloques;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function bloqueHtml(b, i, claves) {
  const dur = Math.max(0.4, b.end - b.start + 0.12).toFixed(3);
  const spans = b.words.map((w) => {
    const c = clasificar(w.text, claves);
    return `<span class="cap-word${c ? ' ' + c : ''}">${esc(w.text)}</span>`;
  }).join(' ');
  return `<div class="clip cap" id="cap${i + 1}" data-start="${b.start.toFixed(3)}" data-duration="${dur}" data-track-index="${100 + (i % 2)}">` +
    `<div class="cap-inner">${spans}</div></div>`;
}

/** Líneas GSAP: cada palabra aparece en su instante (pop) y el bloque sale hacia arriba al terminar. */
export function timelineSnippet(bloques) {
  const L = [];
  bloques.forEach((b, i) => {
    const id = `#cap${i + 1}`;
    L.push(`// cap${i + 1} @ ${b.start.toFixed(2)} s — "${b.words.map((w) => w.text).join(' ')}"`);
    b.words.forEach((w, k) => {
      L.push(`tl.fromTo("${id} .cap-word:nth-child(${k + 1})", { opacity: 0, y: 22, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "expo.out" }, ${w.start.toFixed(3)});`);
    });
    L.push(`tl.to("${id} .cap-inner", { opacity: 0, y: -40, duration: 0.2, ease: "power2.in" }, ${Math.max(b.start + 0.1, b.end - 0.08).toFixed(3)});`);
  });
  return L.join('\n');
}

function main(argv) {
  const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const [inPath, outHtml, outMeta] = pos;
  if (!inPath || !outHtml || !outMeta) {
    console.error('uso: generate-captions.mjs <transcript.json> <bloques.html> <meta.json> [--palabras-clave palabras.json] [--max-palabras 4] [--max-duracion 2.6]');
    process.exit(1);
  }
  const claves = flag('--palabras-clave') ? JSON.parse(readFileSync(resolve(flag('--palabras-clave')), 'utf8')) : {};
  const words = extraerPalabras(JSON.parse(readFileSync(resolve(inPath), 'utf8')));
  const bloques = agruparBloques(words, { maxPalabras: Number(flag('--max-palabras') || 4), maxDuracion: Number(flag('--max-duracion') || 2.6) });
  writeFileSync(outHtml, bloques.map((b, i) => bloqueHtml(b, i, claves)).join('\n') + '\n');
  writeFileSync(outMeta, JSON.stringify({
    palabras: words.length, bloques: bloques.length, duracion: words.length ? words[words.length - 1].end : 0,
    detalle: bloques.map((b) => ({ start: +b.start.toFixed(3), end: +b.end.toFixed(3), texto: b.words.map((w) => w.text).join(' ') })),
    timeline: timelineSnippet(bloques),
  }, null, 2) + '\n');
  console.log(`[captions] ${words.length} palabras → ${bloques.length} bloques · ${outHtml} · ${outMeta}`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
