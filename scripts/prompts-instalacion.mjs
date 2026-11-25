#!/usr/bin/env node
// prompts-instalacion.mjs: genera PROMPT-INSTALACION.md desde prompts/prompts.json (la fuente única que también lee
// la web). Con --check no escribe: falla si el .md no coincide (lo usa un test). Tras el paso 0 del onboarding los dos
// archivos ya no existen (solo sirven antes de clonar) y el script no hace nada.
// CLI: node scripts/prompts-instalacion.mjs [--check]
import { realpathSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
export const FUENTE = join(RAIZ, 'prompts/prompts.json');
export const DESTINO = join(RAIZ, 'PROMPT-INSTALACION.md');

export function generar(datos) {
  const L = [
    '# Prompts de instalación',
    '',
    'Elige el de la IA que usas, cópialo entero y pégaselo. Tu IA clona el repo, lo deja solo con los archivos que ella lee (paso 0 de `ONBOARDING.md`) y te guía por la instalación.',
    '',
    '<!-- Generado por scripts/prompts-instalacion.mjs desde prompts/prompts.json: edita el JSON, no este archivo. -->',
  ];
  for (const p of datos.prompts) {
    L.push('', `## ${p.etiqueta}${p.probado ? '' : ' (sin probar)'}`, '', '```text', p.texto, '```');
  }
  return L.join('\n') + '\n';
}

function main(check) {
  if (!existsSync(FUENTE)) { console.log('Sin prompts/prompts.json (repo ya adaptado): nada que hacer.'); return; }
  const md = generar(JSON.parse(readFileSync(FUENTE, 'utf8')));
  const actual = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : null;
  if (actual === md) { if (check) console.log('PROMPT-INSTALACION.md al día.'); return; }
  if (check) { console.error('PROMPT-INSTALACION.md desactualizado (correr: node scripts/prompts-instalacion.mjs)'); process.exit(1); }
  writeFileSync(DESTINO, md);
  console.log('actualizado PROMPT-INSTALACION.md');
}

const esPrincipal = () => { try { return realpathSync(process.argv[1] || '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (esPrincipal()) main(process.argv.includes('--check'));
