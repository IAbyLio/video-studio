#!/usr/bin/env node
// editar.mjs — orquestador del carril "editar lo que grabas", en dos fases con un GATE humano en medio:
//
//   Fase 1 (analiza y PARA):
//     node scripts/bruto/editar.mjs <bruto.mp4> --proyecto proyectos/<slug> [--modelo small] [...flags de analizar]
//     → <proyecto>/bruto/cortes.json + cortes.md. Se revisa (los "pendiente" obligan a decidir) y, si cambian
//       decisiones, `node scripts/bruto/analizar.mjs --replanificar <proyecto>/bruto/cortes.json`.
//
//   Fase 2 (corta, verifica, encuadra y deja los assets en el proyecto):
//     node scripts/bruto/editar.mjs --continuar proyectos/<slug> [--cara auto|x|x,y] [--zooms cortes|frases|ninguno|"t:z,..."]
//        [--zoom 1.12] [--seguir] [--zooms-en-composicion] [--formato 9x16]
//     → <proyecto>/assets/bruto-cortado.mp4 (horizontal), bruto-9x16.mp4, voz-cortada.wav, words.json,
//       transcript-cortado.json, mapa-tiempos.json, bruto-encuadre.json. Si verificar.mjs no pasa, PARA antes de copiar.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumentos } from './medios.mjs';

const A = argumentos(process.argv.slice(2));
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const correr = (script, args) => {
  console.log(`\n$ node scripts/bruto/${script} ${args.join(' ')}`);
  const r = spawnSync(process.execPath, [path.join(AQUI, script), ...args], { stdio: 'inherit' });
  return r.status;
};
const pasar = (claves) => claves.flatMap((k) => (A[k] === undefined ? [] : A[k] === true
  ? [`--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`] : [`--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, String(A[k])]));

if (!A.continuar) {
  const bruto = A._[0];
  if (!bruto || !A.proyecto) { console.error('uso: editar.mjs <bruto> --proyecto proyectos/<slug>   |   editar.mjs --continuar proyectos/<slug>'); process.exit(1); }
  const dir = path.resolve(A.proyecto, 'bruto');
  const st = correr('analizar.mjs', [bruto, '--out', dir, ...pasar(['modelo', 'fps', 'ruido', 'silencioMax', 'sinPrompt', 'muletillas', 'dudosas', 'reusarTranscripcion'])]);
  if (st !== 0) process.exit(st);
  console.log(`\nGATE — revisa ${path.join(dir, 'cortes.md')} antes de cortar:`);
  console.log('  · decide cada "pendiente" (cortar | conservar) en cortes.json, añade descartes manuales si hace falta;');
  console.log('  · corrige nombres mal oídos en "correcciones" (solo afectan a las captions);');
  console.log(`  · si cambiaste decisiones: node scripts/bruto/analizar.mjs --replanificar ${path.join(dir, 'cortes.json')}`);
  console.log(`  · y después: node scripts/bruto/editar.mjs --continuar ${A.proyecto}`);
  process.exit(0);
}

const proyecto = path.resolve(typeof A.continuar === 'string' ? A.continuar : A._[0]);
const dir = path.join(proyecto, 'bruto');
if (!fs.existsSync(path.join(dir, 'cortes.json'))) { console.error(`no hay ${path.join(dir, 'cortes.json')}: corre antes la fase 1`); process.exit(1); }
let st = correr('cortar.mjs', [path.join(dir, 'cortes.json'), ...pasar(['usarConservar', 'crf'])]);
if (st !== 0) process.exit(st);
st = correr('verificar.mjs', [dir, ...pasar(['modelo'])]);
if (st !== 0) { console.error(`\nverificar.mjs NO PASA: mira ${path.join(dir, 'verificacion.md')}, mueve los cortes y repite. No se copia nada al proyecto.`); process.exit(st); }
const formato = A.formato || '9x16';
st = correr('encuadrar.mjs', [path.join(dir, 'clip-cortado.mp4'), '--salida', path.join(dir, `clip-${formato}.mp4`), '--formato', formato,
  '--cara', String(A.cara || 'auto'), '--zooms', String(A.zooms || 'cortes'), ...pasar(['zoom', 'seguir', 'zoomsEnComposicion', 'muestreo', 'permanencia'])]);
if (st !== 0) process.exit(st);

const assets = path.join(proyecto, 'assets');
fs.mkdirSync(assets, { recursive: true });
const copias = [['clip-cortado.mp4', 'bruto-cortado.mp4'], [`clip-${formato}.mp4`, `bruto-${formato}.mp4`], ['voz-cortada.wav', 'voz-cortada.wav'],
  ['words.json', 'words.json'], ['transcript-cortado.json', 'transcript-cortado.json'], ['mapa-tiempos.json', 'mapa-tiempos.json'],
  [`clip-${formato}-encuadre.json`, 'bruto-encuadre.json']];
for (const [de, a] of copias) if (fs.existsSync(path.join(dir, de))) fs.copyFileSync(path.join(dir, de), path.join(assets, a));
const dur = JSON.parse(fs.readFileSync(path.join(dir, 'words.json'), 'utf8')).duracion;
console.log(`\nListo. Assets en ${path.relative(process.cwd(), assets)}/ · duración de la composición: ${dur} s`);
console.log('Siguiente: captions con `node scripts/generate-captions.mjs <proyecto>/assets/words.json …`, la voz como <audio> con');
console.log('assets/voz-cortada.wav y la composición según modulos/editar-lo-que-grabas/README.md.');
