#!/usr/bin/env node
// music-bed.mjs — hornea UNA pista de música a partir de un plan con varios temas, fundidos de entrada/salida y
// fundidos cruzados (dos temas que se solapan con fade_out/fade_in = crossfade). La música es tuya: este repo no
// trae temas. Ponlos en modulos/sonido/musica/ con un music-manifest.json (formato en modulos/sonido/README.md).
//
// Como módulo:  import { buildFilterComplex } from './music-bed.mjs'
// CLI: node scripts/music-bed.mjs --plan <plan.json> [--manifest <music-manifest.json>] --out <bed.wav>
// Plan = array de { track, start, fade_in?, fade_out?, duration? } (segundos).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MUSIC_DIR = fileURLToPath(new URL('../modulos/sonido/musica', import.meta.url));

export function buildFilterComplex(plan, tracks, musicDir = MUSIC_DIR) {
  const inputs = [];
  const parts = [];
  plan.forEach((e, i) => {
    const t = tracks[e.track];
    if (!t) throw new Error(`el tema no está en el manifest: ${e.track}`);
    inputs.push(`${musicDir}/${t.file}`);
    const start = Number(e.start ?? 0), playDur = Number(e.duration ?? t.duration);
    const fadeIn = Number(e.fade_in ?? 0), fadeOut = Number(e.fade_out ?? 0), delayMs = Math.round(start * 1000);
    let chain = `[${i}:a]atrim=0:${playDur},asetpts=PTS-STARTPTS`;
    if (fadeIn > 0) chain += `,afade=t=in:st=0:d=${fadeIn}`;
    if (fadeOut > 0) chain += `,afade=t=out:st=${(playDur - fadeOut).toFixed(3)}:d=${fadeOut}`;
    chain += `,adelay=${delayMs}|${delayMs}[a${i}]`;
    parts.push(chain);
  });
  parts.push(`${plan.map((_, i) => `[a${i}]`).join('')}amix=inputs=${plan.length}:normalize=0:dropout_transition=0[out]`);
  return { inputs, filter: parts.join(';') };
}

function main(args) {
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const planPath = get('--plan'), out = get('--out');
  const manifestPath = get('--manifest') || `${MUSIC_DIR}/music-manifest.json`;
  if (!planPath || !out) { console.error('uso: music-bed.mjs --plan <plan.json> [--manifest <m.json>] --out <bed.wav>'); process.exit(1); }
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const tracks = JSON.parse(readFileSync(manifestPath, 'utf8')).tracks;
  const { inputs, filter } = buildFilterComplex(plan, tracks, dirname(resolve(manifestPath)));
  const ffArgs = ['-y'];
  for (const f of inputs) ffArgs.push('-i', f);
  ffArgs.push('-filter_complex', filter, '-map', '[out]', '-ar', '44100', '-ac', '2', out);
  const r = spawnSync('ffmpeg', ffArgs, { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr || 'ffmpeg falló'); process.exit(1); }
  console.log(`pista de música: ${out} (${inputs.length} temas)`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
