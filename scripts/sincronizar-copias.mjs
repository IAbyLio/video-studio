#!/usr/bin/env node
// sincronizar-copias.mjs — cada ejemplo y cada proyecto tiene que ser portable (Hyperframes sirve solo su carpeta),
// así que algunas piezas compartidas viven copiadas en varios sitios. Este script es la fuente única: copia cada
// pieza desde su original y reinyecta la marca neutra en los ejemplos. Con --check no escribe: falla si algo se
// desvió (lo usa un test). También copia el cuerpo de CLAUDE.md (desde el primer "## ") a AGENTS.md, conservando la
// cabecera de AGENTS.md; tras el paso 0 del onboarding solo queda una de las dos guías y esa copia se salta.
// CLI: node scripts/sincronizar-copias.mjs [--check]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inyectarMarca } from './nuevo-proyecto.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const r = (p) => join(RAIZ, p);

const THREE = ['vendor/three/three.module.min.js', 'vendor/three/three.core.min.js', 'vendor/three/LICENSE'];
const GLASS = ['vendor/liqui-glass/liqui-glass.js', 'vendor/liqui-glass/LICENSE', 'vendor/liqui-glass/NOTICE.md'];
const MUNECO = 'modulos/personaje-3d/muneco';

/** [origen, carpeta destino] — el archivo conserva su nombre. */
export const COPIAS = [
  ...THREE.map((f) => [f, 'estilos/mundo-3d/ejemplo/assets/vendor/three']),
  ...THREE.map((f) => [f, 'estilos/personaje-narrador/ejemplo/assets/vendor/three']),
  ...THREE.map((f) => [f, `${MUNECO}/demo/assets/vendor/three`]),
  ...GLASS.map((f) => [f, 'estilos/liquid-glass/ejemplo/assets/vendor/liqui-glass']),
  ['scripts/captions/captions-estilos.js', 'modulos/captions/ejemplos/natural/assets'],
  ['scripts/captions/captions-estilos.js', 'modulos/captions/ejemplos/premium/assets'],
  ['scripts/personaje/cara.js', 'estilos/personaje-narrador/ejemplo/assets'],
  ['scripts/personaje/cara.js', 'estilos/gancho-ia/ejemplo/assets'],
  ['scripts/personaje/cara.js', `${MUNECO}/demo/assets`],
  [`${MUNECO}/personaje.js`, 'estilos/personaje-narrador/ejemplo/assets'],
  [`${MUNECO}/personaje.js`, `${MUNECO}/demo/assets`],
];

/** poses.json → poses-data.js (sin fetch en render: el JSON se embebe como variable global). */
export function posesAJs(json) {
  return `// generado por scripts/sincronizar-copias.mjs desde ${MUNECO}/poses.json — no editar a mano\nwindow.MUNECO_POSES = ${JSON.stringify(JSON.parse(json))};\n`;
}
export const GENERADOS = [
  [`${MUNECO}/poses.json`, 'estilos/personaje-narrador/ejemplo/assets/poses-data.js', posesAJs],
  [`${MUNECO}/poses.json`, `${MUNECO}/demo/assets/poses-data.js`, posesAJs],
];

/** AGENTS.md = su propia cabecera + el cuerpo de CLAUDE.md. null si falta alguna de las dos (repo ya adaptado). */
export function guiaAgents(claude, agents) {
  if (claude == null || agents == null) return null;
  const corte = (t) => { const i = t.search(/^## /m); return i === -1 ? t.length : i; };
  return agents.slice(0, corte(agents)) + claude.slice(corte(claude));
}

/** Ejemplos cuyo index.html lleva el bloque de marca neutra. */
export function ejemplosConMarca() {
  const out = [];
  const est = r('estilos');
  if (existsSync(est)) for (const d of readdirSync(est)) { const f = join(est, d, 'ejemplo', 'index.html'); if (existsSync(f)) out.push(f); }
  for (const f of [r('proyectos/_plantilla/index.html'), r(`${MUNECO}/demo/index.html`), r('modulos/captions/ejemplos/natural/index.html'), r('modulos/captions/ejemplos/premium/index.html')]) if (existsSync(f)) out.push(f);
  return out;
}

function main(check) {
  const desvios = [];
  const escribir = (dest, contenido) => {
    const actual = existsSync(dest) ? readFileSync(dest) : null;
    if (actual && Buffer.compare(actual, Buffer.from(contenido)) === 0) return;
    if (check) { desvios.push(relative(RAIZ, dest)); return; }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, contenido);
    console.log(`actualizado ${relative(RAIZ, dest)}`);
  };
  for (const [orig, destDir] of COPIAS) {
    if (!existsSync(r(orig))) { if (!check) console.warn(`[aviso] falta el original ${orig}`); continue; }
    if (!existsSync(r(dirname(destDir))) && !existsSync(r(destDir))) continue;   // el ejemplo todavía no existe
    escribir(join(r(destDir), orig.split('/').pop()), readFileSync(r(orig)));
  }
  for (const [orig, dest, fn] of GENERADOS) {
    if (!existsSync(r(orig)) || !existsSync(r(dirname(dirname(dest))))) continue;
    escribir(r(dest), fn(readFileSync(r(orig), 'utf8')));
  }
  const leerSi = (p) => (existsSync(r(p)) ? readFileSync(r(p), 'utf8') : null);
  const agents = guiaAgents(leerSi('CLAUDE.md'), leerSi('AGENTS.md'));
  if (agents != null) escribir(r('AGENTS.md'), agents);
  const neutra = readFileSync(r('marca/marca.neutra.css'), 'utf8');
  for (const f of ejemplosConMarca()) {
    const html = readFileSync(f, 'utf8');
    if (!html.includes('MARCA:INICIO')) { desvios.push(`${relative(RAIZ, f)} (sin bloque MARCA)`); continue; }
    escribir(f, inyectarMarca(html, neutra));
  }
  if (check) {
    if (desvios.length) { console.error('Copias desactualizadas (correr: node scripts/sincronizar-copias.mjs):\n' + desvios.map((d) => ' - ' + d).join('\n')); process.exit(1); }
    console.log('Copias al día.');
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.includes('--check'));
