#!/usr/bin/env node
// sfx-manifest.mjs — valida y actualiza modulos/sonido/sfx/sfx-manifest.json (la ficha de cada efecto de sonido).
// CLI:  node scripts/sfx-manifest.mjs validate [ruta]
//       node scripts/sfx-manifest.mjs list [ruta]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_DEFECTO = fileURLToPath(new URL('../modulos/sonido/sfx/sfx-manifest.json', import.meta.url));
const REQUIRED = ['file', 'duration', 'transient_offset', 'category', 'default_volume', 'use_for', 'license', 'source'];
export const CATEGORIES = ['transition', 'impact', 'reveal', 'ui', 'riser', 'drop'];

export function validateManifest(m) {
  const errs = [];
  if (m?.version !== 1) errs.push('version debe ser 1');
  if (!m?.samples || typeof m.samples !== 'object') { errs.push('falta samples'); return errs; }
  for (const [id, e] of Object.entries(m.samples)) {
    for (const k of REQUIRED) if (!(k in e)) errs.push(`${id}: falta ${k}`);
    if (e.category && !CATEGORIES.includes(e.category)) errs.push(`${id}: category inválida (${e.category})`);
    if (typeof e.transient_offset === 'number' && e.transient_offset < 0) errs.push(`${id}: transient_offset < 0`);
    if (typeof e.default_volume === 'number' && (e.default_volume < 0 || e.default_volume > 1)) errs.push(`${id}: default_volume fuera de 0..1`);
    if (e.use_for && !Array.isArray(e.use_for)) errs.push(`${id}: use_for debe ser array`);
  }
  return errs;
}

export function upsertEntry(manifest, id, entry) {
  manifest.samples[id] = entry;
  // claves en orden alfabético: diffs estables
  manifest.samples = Object.fromEntries(Object.entries(manifest.samples).sort(([a], [b]) => a.localeCompare(b)));
  return manifest;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const [cmd, path = MANIFEST_DEFECTO] = process.argv.slice(2);
  const m = JSON.parse(readFileSync(path, 'utf8'));
  if (cmd === 'validate') {
    const errs = validateManifest(m);
    if (errs.length) { console.error('INVÁLIDO:\n' + errs.map((e) => ' - ' + e).join('\n')); process.exit(1); }
    console.log(`OK: ${Object.keys(m.samples).length} efectos`);
  } else if (cmd === 'list') {
    for (const [id, e] of Object.entries(m.samples)) {
      console.log(`${id.padEnd(16)} ${String(e.duration).padStart(6)} s  pico ${String(e.transient_offset).padStart(5)} s  ${e.category.padEnd(10)} ${e.use_for.join(', ')}`);
    }
  } else {
    console.error('uso: sfx-manifest.mjs validate|list [ruta]'); process.exit(1);
  }
}
