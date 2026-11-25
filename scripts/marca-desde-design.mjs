#!/usr/bin/env node
// marca-desde-design.mjs — traduce DESIGN.md (raíz) a marca/marca.css: las variables que usan todos los vídeos.
// Lee la tabla "Paleta" (columna Variable + columna Hex) y la tabla "Tipografías" (Uso, Familia, Peso, Archivo).
// Si un archivo de fuente existe en marca/fuentes/, escribe su @font-face; si no, usa la familia con alternativas.
// CLI: node scripts/marca-desde-design.mjs [--design DESIGN.md] [--out marca/marca.css] [--check]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contraste } from './extraer-colores.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const NEUTRA = readFileSync(join(RAIZ, 'marca/marca.neutra.css'), 'utf8');
const VARIABLES = ['--fondo', '--fondo-hondo', '--superficie', '--superficie-alta', '--texto', '--texto-suave', '--acento', '--acento-2', '--negativo'];
const ALTERNATIVAS = { titulos: '"Helvetica Neue", Arial, sans-serif', texto: '"Helvetica Neue", Arial, sans-serif', mono: 'Menlo, Consolas, monospace' };

/** Filas de la primera tabla Markdown que aparece después del encabezado dado. */
export function tablaBajo(md, encabezado) {
  const i = md.search(new RegExp(`^##\\s+${encabezado}`, 'mi'));
  if (i < 0) return [];
  const lineas = md.slice(i).split('\n').slice(1);
  const filas = [];
  let enTabla = false;
  for (const l of lineas) {
    if (/^##\s/.test(l)) break;
    if (l.trim().startsWith('|')) { enTabla = true; filas.push(l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); }
    else if (enTabla) break;
  }
  return filas.filter((f) => !f.every((c) => /^:?-+:?$/.test(c)));
}

export function leerPaleta(md) {
  const filas = tablaBajo(md, 'Paleta');
  if (!filas.length) return {};
  const cab = filas[0].map((c) => c.toLowerCase());
  const iVar = cab.findIndex((c) => c.includes('variable')), iHex = cab.findIndex((c) => c.includes('hex'));
  const out = {};
  for (const f of filas.slice(1)) {
    const v = (f[iVar] || '').replace(/`/g, ''), h = ((f[iHex] || '').match(/#[0-9a-fA-F]{6}\b/) || [])[0];
    if (VARIABLES.includes(v) && h) out[v] = h.toLowerCase();
  }
  return out;
}

export function leerTipos(md) {
  const filas = tablaBajo(md, 'Tipograf');
  if (filas.length < 2) return {};
  const cab = filas[0].map((c) => c.toLowerCase());
  const col = (n) => cab.findIndex((c) => c.includes(n));
  const out = {};
  for (const f of filas.slice(1)) {
    const uso = (f[col('uso')] || '').toLowerCase();
    const clave = uso.includes('tít') || uso.includes('tit') ? 'titulos' : uso.includes('dato') || uso.includes('mono') || uso.includes('cód') ? 'mono' : uso.includes('texto') ? 'texto' : null;
    if (!clave) continue;
    out[clave] = { familia: (f[col('familia')] || '').replace(/[`"]/g, '').trim(), peso: (f[col('peso')] || '').trim(),
      archivo: ((f[col('archivo')] || '').match(/fuentes\/[^\s`|]+/) || [])[0] || null };
  }
  return out;
}

export function construirCss(paleta, tipos, { existeArchivo = (p) => existsSync(join(RAIZ, 'marca', p)) } = {}) {
  const base = Object.fromEntries([...NEUTRA.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const vars = { ...base, ...paleta };
  const faces = [];
  for (const [k, t] of Object.entries(tipos)) {
    if (!t.familia) continue;
    vars[`--fuente-${k}`] = `"${t.familia}", ${ALTERNATIVAS[k]}`;
    if (t.archivo && existeArchivo(t.archivo)) {
      const fmt = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' }[extname(t.archivo).toLowerCase()] || 'woff2';
      const peso = /\d{3}/.test(t.peso) ? t.peso.match(/\d{3}(\s*[-–]\s*\d{3})?/)[0].replace(/\s*[-–]\s*/, ' ') : '400';
      faces.push(`@font-face { font-family: "${t.familia}"; src: url("${t.archivo}") format("${fmt}"); font-weight: ${peso}; font-style: normal; font-display: block; }`);
    }
    if (k === 'titulos' && /\d{3}/.test(t.peso)) vars['--peso-titulos'] = t.peso.match(/\d{3}/g).pop();
  }
  // Sin tipografía de datos declarada, los rótulos "mono" usan la de texto: no se cuela una tercera familia que el
  // manual no tiene (lo destapó la prueba de onboarding: un manual con "nunca más de dos familias").
  if (!tipos.mono?.familia && tipos.texto?.familia) vars['--fuente-mono'] = vars['--fuente-texto'];
  const cuerpo = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `/* marca.css — generado desde DESIGN.md por scripts/marca-desde-design.mjs. Para cambiar la marca, edita DESIGN.md y vuelve a correrlo. */\n${faces.join('\n')}${faces.length ? '\n' : ''}:root {\n${cuerpo}\n}\n`;
}

function main(args) {
  const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const design = resolve(get('--design') || join(RAIZ, 'DESIGN.md'));
  const out = resolve(get('--out') || join(RAIZ, 'marca/marca.css'));
  if (!existsSync(design)) { console.error(`no existe ${design}: haz primero el paso de marca de ONBOARDING.md`); process.exit(1); }
  const md = readFileSync(design, 'utf8');
  const paleta = leerPaleta(md), tipos = leerTipos(md);
  const faltan = VARIABLES.filter((v) => !paleta[v]);
  const css = construirCss(paleta, tipos);
  if (paleta['--texto'] && paleta['--fondo']) console.log(`contraste texto/fondo: ${contraste(paleta['--texto'], paleta['--fondo'])}:1 (mínimo recomendado 4,5)`);
  if (paleta['--acento'] && paleta['--fondo']) console.log(`contraste acento/fondo: ${contraste(paleta['--acento'], paleta['--fondo'])}:1`);
  if (faltan.length) console.log(`AVISO: sin color en DESIGN.md para ${faltan.join(', ')} → se usa el neutro`);
  for (const [k, t] of Object.entries(tipos)) if (t.archivo && !existsSync(join(RAIZ, 'marca', t.archivo))) console.log(`AVISO: no existe marca/${t.archivo} (fuente ${k}): se usa la familia instalada o la alternativa`);
  if (args.includes('--check')) { process.stdout.write(css); return; }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, css);
  console.log(`escrito ${out} (${Object.keys(paleta).length} colores, ${Object.keys(tipos).length} tipografías)`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
