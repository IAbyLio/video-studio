#!/usr/bin/env node
// extraer-colores.mjs — ayuda del paso de marca: saca los colores de tus archivos para no adivinarlos.
//   · SVG, CSS, HTML, MD, TXT, JSON: lee los #hex, rgb() que aparecen y cuántas veces.
//   · Imágenes (PNG, JPG, WEBP…): colores dominantes con ffmpeg (palettegen), sin dependencias.
// Los PDF los lee la IA directamente (puede abrir páginas de PDF); si un PDF trae colores en texto, aparecen ahí.
// CLI: node scripts/extraer-colores.mjs <archivo|carpeta> [...] [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXTO = new Set(['.svg', '.css', '.html', '.htm', '.md', '.txt', '.json', '.scss', '.ase']);
const IMAGEN = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);

const hex2 = (n) => n.toString(16).padStart(2, '0');
export function normalizarHex(h) {
  let s = h.replace('#', '').toLowerCase();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return s.length === 6 ? `#${s}` : null;
}

/** Colores escritos en un texto: { '#rrggbb': veces }. */
export function coloresEnTexto(texto) {
  const out = {};
  for (const m of texto.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) { const h = normalizarHex(m[0]); if (h) out[h] = (out[h] || 0) + 1; }
  for (const m of texto.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    const h = `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`; out[h] = (out[h] || 0) + 1;
  }
  return out;
}

export function coloresEnImagen(ruta, n = 8) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', ruta, '-vf', `scale=240:-1:flags=area,palettegen=max_colors=${n}:reserve_transparent=0:stats_mode=full`,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
  if (r.status !== 0) return {};
  const b = r.stdout, out = {};
  for (let i = 0; i + 2 < b.length; i += 3) { const h = `#${hex2(b[i])}${hex2(b[i + 1])}${hex2(b[i + 2])}`; out[h] = (out[h] || 0) + 1; }
  return out;   // la paleta de ffmpeg repite el último color para rellenar: el conteo no es proporción
}

/** Luminancia relativa y contraste WCAG entre dos hex. */
export function contraste(a, b) {
  const L = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return +((x + 0.05) / (y + 0.05)).toFixed(2);
}

function recorrer(p, lista) {
  const st = statSync(p);
  if (st.isDirectory()) { for (const n of readdirSync(p)) if (!n.startsWith('.')) recorrer(join(p, n), lista); }
  else lista.push(p);
}

function main(args) {
  const archivos = [];
  for (const a of args.filter((x) => !x.startsWith('--'))) recorrer(resolve(a), archivos);
  if (!archivos.length) { console.error('uso: extraer-colores.mjs <archivo|carpeta> [...] [--json]'); process.exit(1); }
  const res = {};
  for (const f of archivos) {
    const e = extname(f).toLowerCase();
    if (TEXTO.has(e)) res[f] = { tipo: 'texto', colores: coloresEnTexto(readFileSync(f, 'utf8')) };
    else if (IMAGEN.has(e)) res[f] = { tipo: 'imagen', colores: coloresEnImagen(f) };
  }
  if (args.includes('--json')) { console.log(JSON.stringify(res, null, 2)); return; }
  for (const [f, r] of Object.entries(res)) {
    const lista = Object.entries(r.colores).sort((a, b) => b[1] - a[1]).map(([h, n]) => (r.tipo === 'texto' ? `${h}×${n}` : h));
    console.log(`${f}\n  ${r.tipo}: ${lista.join('  ') || '(sin colores)'}`);
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
