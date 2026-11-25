#!/usr/bin/env node
// sfx-measure.mjs — mide el transient_offset de un audio: cuántos segundos de silencio hay antes del primer sonido.
// Sirve para que el golpe caiga justo en el fotograma: data-start = momento del evento − transient_offset.
// Usa ffmpeg silencedetect (determinista).
//
// Como módulo:  import { measureTransientOffset } from './sfx-measure.mjs'
// Como CLI:     node scripts/sfx-measure.mjs <archivo.wav> [más archivos...]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NOISE_DB = '-40dB';    // por debajo de esto cuenta como silencio
const MIN_SILENCE = '0.02';  // 20 ms mínimos para contar como silencio

export function parseOnset(stderr) {
  // Si el primer evento es un silencio que arranca en ~0, su silence_end es el arranque del sonido.
  const startsSilent = /silence_start:\s*-?0(\.0+)?\b/.test(stderr);
  if (!startsSilent) return 0;
  const m = stderr.match(/silence_end:\s*([0-9.]+)/);
  return m ? Number(Number(m[1]).toFixed(3)) : 0;
}

export function measureTransientOffset(file) {
  // ffmpeg escribe silencedetect en stderr aunque termine bien: spawnSync lo captura siempre.
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${NOISE_DB}:d=${MIN_SILENCE}`, '-f', 'null', '-'],
    { encoding: 'utf8' });
  return parseOnset(r.stderr ?? '');
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('uso: sfx-measure.mjs <archivo> [...]'); process.exit(1); }
  for (const f of files) console.log(`${f}\t${measureTransientOffset(f)}`);
}
