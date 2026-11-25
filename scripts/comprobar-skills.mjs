#!/usr/bin/env node
// comprobar-skills.mjs: lista esperada contra instalada de las skills del estudio (las del repo y las oficiales de
// HyperFrames y GSAP que instala el onboarding). No instala nada: si falta alguna oficial, imprime el comando exacto
// para reinstalar solo esas y sale con código 1.
// CLI: node scripts/comprobar-skills.mjs [--ia claude|codex|otra] [--comandos] [--json]
//   --ia        la IA del repo (por defecto, la de estado-onboarding.json → agente; si no hay, claude)
//   --comandos  imprime los comandos de instalación completos de esa IA (los mismos de ONBOARDING.md) y sale
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
export const OFICIALES = JSON.parse(readFileSync(join(RAIZ, 'scripts/skills-oficiales.json'), 'utf8'));
export const PROPIAS = Object.keys(JSON.parse(readFileSync(join(RAIZ, 'scripts/adaptar-ia.datos.json'), 'utf8')).skills);

export function iaDelRepo(raiz = RAIZ) {
  try { const e = JSON.parse(readFileSync(join(raiz, 'estado-onboarding.json'), 'utf8')); if (OFICIALES.agente_por_ia[e.agente]) return e.agente; } catch { /* sin estado */ }
  return existsSync(join(raiz, '.claude/skills')) || !existsSync(join(raiz, '.agents/skills')) ? 'claude' : 'otra';
}

/** Comando de instalación de un repo de skills para una IA (las skills en el orden del JSON). */
export function comando(fuente, ia, skills = fuente.skills) {
  return `npx --yes ${OFICIALES.cli} add ${fuente.repo} --skill ${skills.join(' ')} --agent ${OFICIALES.agente_por_ia[ia]} --copy -y`;
}

/** { carpeta, propias: {nombre: bool}, oficiales: [{repo, faltan:[], instaladas:[]}], reinstalar: [comandos] } */
export function comprobar(raiz, ia) {
  const carpeta = OFICIALES.carpeta_por_ia[ia];
  const hay = (n) => existsSync(join(raiz, carpeta, n, 'SKILL.md'));
  const propias = Object.fromEntries(PROPIAS.map((n) => [n, hay(n)]));
  const oficiales = OFICIALES.fuentes.map((f) => ({ repo: f.repo, nombre: f.nombre, instaladas: f.skills.filter(hay), faltan: f.skills.filter((n) => !hay(n)) }));
  const reinstalar = OFICIALES.fuentes.map((f, i) => (oficiales[i].faltan.length ? comando(f, ia, oficiales[i].faltan) : null)).filter(Boolean);
  return { ia, carpeta, propias, oficiales, reinstalar };
}

function main(argv) {
  const i = argv.indexOf('--ia');
  const ia = i >= 0 ? argv[i + 1] : iaDelRepo();
  if (!OFICIALES.agente_por_ia[ia]) { console.error(`--ia tiene que ser una de: ${Object.keys(OFICIALES.agente_por_ia).join(', ')}`); process.exit(2); }
  if (argv.includes('--comandos')) { for (const f of OFICIALES.fuentes) console.log(comando(f, ia)); return; }
  const r = comprobar(RAIZ, ia);
  if (argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(r.reinstalar.length || Object.values(r.propias).includes(false) ? 1 : 0); }
  console.log(`Skills en ${r.carpeta}/ (IA: ${ia})`);
  const faltanPropias = Object.entries(r.propias).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  del repo (${PROPIAS.length}): ${faltanPropias.length ? 'FALTAN ' + faltanPropias.join(', ') : 'todas'}`);
  for (const o of r.oficiales) console.log(`  ${o.nombre} (${o.instaladas.length}/${o.instaladas.length + o.faltan.length}): ${o.faltan.length ? 'FALTAN ' + o.faltan.join(', ') : 'todas'}`);
  const pago = OFICIALES.fuentes.flatMap((f) => f.de_pago);
  if (pago.length) console.log(`  De pago (no usarlas sin un sí explícito): ${pago.join(', ')}`);
  if (faltanPropias.length) console.log('Las del repo vienen con él: si faltan, el paso 0 no terminó bien o se borraron (recupéralas con git).');
  if (r.reinstalar.length) { console.log('Para reinstalar lo que falta:'); for (const c of r.reinstalar) console.log('  ' + c); }
  process.exit(r.reinstalar.length || faltanPropias.length ? 1 : 0);
}

const esPrincipal = () => { try { return realpathSync(process.argv[1] || '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (esPrincipal()) main(process.argv.slice(2));
