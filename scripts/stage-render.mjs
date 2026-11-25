#!/usr/bin/env node
// stage-render.mjs — render por etapas para trabajar el sonido paso a paso. Quita del index.html (en una copia
// temporal, el original siempre se restaura) los <audio data-capa="..."> de las capas que todavía no tocan:
//   visual → sin sfx ni música   |   sfx → con sfx, sin música   |   music / full → todo
//
// Como módulo:  import { stripLayers } from './stage-render.mjs'
// CLI: node scripts/stage-render.mjs <carpeta-del-proyecto> <visual|sfx|music|full>
//      (la carpeta puede ser proyectos/<slug> o cualquier proyecto Hyperframes)
import { readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STRIP = { visual: ['sfx', 'music'], sfx: ['music'], music: [], full: [] };

export function stripLayers(html, stage) {
  const strip = STRIP[stage];
  if (strip === undefined) throw new Error(`etapa inválida: ${stage} (visual|sfx|music|full)`);
  let out = html;
  for (const layer of strip) {
    // data-capa es la marca de este repo; data-layer se acepta por compatibilidad (el lint de Hyperframes ≥ 0.9 lo rechaza)
    const re = new RegExp(`[ \\t]*<audio\\b[^>]*\\bdata-(?:capa|layer)="${layer}"[^>]*>\\s*(?:</audio>)?\\n?`, 'gi');
    out = out.replace(re, '');
  }
  return out;
}

function main([carpeta, stage]) {
  if (!carpeta || !stage) { console.error('uso: stage-render.mjs <carpeta-del-proyecto> <visual|sfx|music|full>'); process.exit(1); }
  if (!(stage in STRIP)) { console.error(`etapa inválida: ${stage}`); process.exit(1); }
  const dir = existsSync(carpeta) ? resolve(carpeta) : resolve('proyectos', carpeta);
  const index = join(dir, 'index.html');
  if (!existsSync(index)) { console.error(`no existe ${index}`); process.exit(1); }
  const bak = `${index}.etapa-bak`;
  copyFileSync(index, bak);
  try {
    writeFileSync(index, stripLayers(readFileSync(index, 'utf8'), stage));
    const out = `renders/${basename(dir)}-${stage}.mp4`;
    const r = spawnSync('npx', ['hyperframes', 'render', '--quality', 'draft', '--output', out], { cwd: dir, stdio: 'inherit' });
    if (r.status !== 0) { console.error('el render falló'); process.exitCode = 1; return; }
    console.log(`etapa ${stage} renderizada: ${join(dir, out)}`);
  } finally {
    copyFileSync(bak, index);   // restaurar SIEMPRE el index original
    rmSync(bak, { force: true });
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
