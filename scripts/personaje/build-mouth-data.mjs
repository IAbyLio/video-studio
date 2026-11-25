#!/usr/bin/env node
// build-mouth-data.mjs — cues de boca (visemas Rhubarb A–H, X) a partir de la voz final.
//
//  1. ffmpeg → WAV mono 16 kHz PCM16.
//  2. Rhubarb Lip-Sync 1.14: `-r phonetic -f json --extendedShapes GHX -d <guion sin etiquetas>`
//     (phonetic: el reconocedor pocketSphinx es solo inglés). El guion se limpia de [audio tags].
//  3. Puerta de silencio: si un cue que no es X ni A tiene ≥ 0,10 s seguidos por debajo de −60 dBFS
//     (ventanas de 10 ms), ese tramo pasa a X (boca en reposo). Rhubarb deja a veces bocas abiertas
//     o con dientes sobre silencio digital entre frases. No cambia ningún otro tiempo.
//  4. Sin Rhubarb (o con --envolvente): boca por envolvente de volumen, 30 pasos/s, cuatro aperturas
//     A/B/C/D relativas al percentil 95, sin destellos de un paso. A tamaño narrador no se nota.
//
// Uso: node scripts/personaje/build-mouth-data.mjs --audio voz.mp3 [--guion guion.txt] --out cues.json
//        [--js data.js --var MOUTH] [--rhubarb /ruta/rhubarb] [--envolvente] [--sin-puerta] [--fps 30]
// Rhubarb se busca en: --rhubarb, $RHUBARB_BIN, .cache/rhubarb/BIN de la raíz del repo (instalar-rhubarb.sh), PATH.
// Salida JSON: { fuente, audio, duracion, cues: [[inicio, visema], ...], puerta: {...} }.
// --js escribe además `window.<VAR> = [[inicio, visema], ...];` para cargar sin fetch en render.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** WAV PCM16 → { sr, samples: Int16Array (primer canal) }. */
export function parseWav(buf) {
  let o = 12, fmt = null, data = null;
  while (o + 8 <= buf.length) {
    const id = buf.toString('latin1', o, o + 4), n = buf.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = o + 8;
    if (id === 'data') { data = [o + 8, Math.min(n, buf.length - o - 8)]; break; }
    o += 8 + n + (n & 1);
  }
  if (fmt === null || !data || buf.readUInt16LE(fmt) !== 1 || buf.readUInt16LE(fmt + 14) !== 16) throw new Error('se esperaba WAV PCM de 16 bit');
  const ch = buf.readUInt16LE(fmt + 2), sr = buf.readUInt32LE(fmt + 4), N = Math.floor(data[1] / (2 * ch));
  const samples = new Int16Array(N);
  for (let i = 0; i < N; i++) samples[i] = buf.readInt16LE(data[0] + i * 2 * ch);
  return { sr, samples };
}

/** Nivel RMS en dBFS entre t0 y t1 (s). */
export function rmsDb({ sr, samples }, t0, t1) {
  const i0 = Math.max(0, Math.round(t0 * sr)), i1 = Math.min(samples.length, Math.round(t1 * sr));
  if (i1 <= i0) return -120;
  let acc = 0; for (let i = i0; i < i1; i++) acc += samples[i] * samples[i];
  return 20 * Math.log10(Math.max(Math.sqrt(acc / (i1 - i0)), 1) / 32768);
}

/**
 * Puerta de silencio sobre cues de Rhubarb [{start, end, value}].
 * Devuelve { cues: [[inicio, visema]], tramos: [[visema, desde, hasta]] }.
 */
export function puertaSilencio(mouthCues, audio, { db = -60, min = 0.10, hop = 0.01 } = {}) {
  const tramos = [], cues = [], r2 = (x) => +x.toFixed(2);
  for (const c of mouthCues) {
    if (c.value === 'X' || c.value === 'A') { cues.push([c.start, c.value]); continue; }
    const n = Math.round((c.end - c.start) / hop), sil = [];
    for (let i = 0; i < n; i++) sil.push(rmsDb(audio, c.start + i * hop, c.start + (i + 1) * hop) < db);
    const runs = [];
    for (let i = 0; i < n;) { if (!sil[i]) { i++; continue; } let j = i; while (j < n && sil[j]) j++; if ((j - i) * hop >= min - 1e-9) runs.push([i, j]); i = j; }
    let at = 0;
    for (const [i, j] of runs) {
      if (i - at >= 2) cues.push([r2(c.start + at * hop), c.value]);          // tramo con voz antes del silencio (≥ 20 ms)
      cues.push([r2(c.start + (i - at >= 2 ? i : at) * hop), 'X']);
      tramos.push([c.value, r2(c.start + i * hop), r2(c.start + j * hop)]);
      at = j;
    }
    if (!runs.length) cues.push([c.start, c.value]);
    else if (n - at >= 4) cues.push([r2(c.start + at * hop), c.value]);       // resto con voz (≥ 40 ms)
  }
  return { cues, tramos };
}

/** Boca por envolvente de volumen: [[inicio, 'A'|'B'|'C'|'D']]. */
export function cuesEnvolvente({ sr, samples }, fps = 30) {
  const hop = Math.floor(sr / fps), rms = [];
  for (let i = 0; i + hop < samples.length; i += hop) {
    let acc = 0; for (let k = i; k < i + hop; k++) acc += samples[k] * samples[k];
    rms.push(Math.sqrt(acc / hop));
  }
  if (!rms.length) return [[0, 'A']];
  const ref = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.95)] || 1;
  const lv = rms.map((r) => { const x = r / ref; return x < 0.10 ? 'A' : x < 0.34 ? 'B' : x < 0.68 ? 'C' : 'D'; });
  for (let i = 1; i < lv.length - 1; i++) if (lv[i - 1] === lv[i + 1] && lv[i] !== lv[i - 1]) lv[i] = lv[i - 1];   // quita destellos de un paso
  const out = []; let prev = null;
  lv.forEach((L, i) => { if (L !== prev) { out.push([+(i / fps).toFixed(3), L]); prev = L; } });
  return out;
}

export function limpiarGuion(text) {
  return text.replace(/\[[^\]\n]{1,40}\]/g, ' ').replace(/<break[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim() + '\n';
}

function buscarRhubarb(flag) {
  const cands = [flag, process.env.RHUBARB_BIN];
  const binFile = join(STUDIO, '.cache/rhubarb/BIN');
  if (existsSync(binFile)) cands.push(readFileSync(binFile, 'utf8').trim());
  for (const c of cands) if (c && existsSync(c)) return c;
  const w = spawnSync('which', ['rhubarb'], { encoding: 'utf8' });
  return w.status === 0 ? w.stdout.trim() : null;
}

function parseArgs(argv) {
  const a = { fps: 30, var: 'MOUTH' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--audio') a.audio = argv[++i];
    else if (k === '--guion') a.guion = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--js') a.js = argv[++i];
    else if (k === '--var') a.var = argv[++i];
    else if (k === '--rhubarb') a.rhubarb = argv[++i];
    else if (k === '--envolvente') a.envolvente = true;
    else if (k === '--sin-puerta') a.sinPuerta = true;
    else if (k === '--fps') a.fps = Number(argv[++i]);
    else throw new Error(`opción desconocida: ${k}`);
  }
  if (!a.audio || !a.out) throw new Error('uso: build-mouth-data.mjs --audio <voz> [--guion <txt>] --out <cues.json> [--js data.js --var MOUTH] [--rhubarb BIN] [--envolvente] [--sin-puerta]');
  if (!/^[A-Za-z_$][\w$]*$/.test(a.var)) throw new Error('--var debe ser un identificador JS');
  return a;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const tmp = mkdtempSync(join(tmpdir(), 'boca-'));
  try {
    const wav = join(tmp, 'voz.wav');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', a.audio, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const audio = parseWav(readFileSync(wav));
    const duracion = +(audio.samples.length / audio.sr).toFixed(3);
    let fuente = 'envolvente', cues, puerta = null, version = null;
    const bin = a.envolvente ? null : buscarRhubarb(a.rhubarb);
    if (!a.envolvente && !bin) console.warn('AVISO: Rhubarb no encontrado (bash scripts/personaje/instalar-rhubarb.sh) → boca por envolvente de volumen.');
    if (bin) {
      const rargs = ['-r', 'phonetic', '-f', 'json', '--extendedShapes', 'GHX', '-o', join(tmp, 'rhubarb.json')];
      if (a.guion) { writeFileSync(join(tmp, 'dialogo.txt'), limpiarGuion(readFileSync(a.guion, 'utf8'))); rargs.push('-d', join(tmp, 'dialogo.txt')); }
      else console.warn('AVISO: sin --guion Rhubarb reconoce a ciegas; con el texto acierta más.');
      const r = spawnSync(bin, [...rargs, wav], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`Rhubarb falló (${r.status}): ${(r.stderr || '').slice(-600)}`);
      const mouthCues = JSON.parse(readFileSync(join(tmp, 'rhubarb.json'), 'utf8')).mouthCues;
      version = spawnSync(bin, ['--version'], { encoding: 'utf8' }).stdout.trim();
      fuente = 'rhubarb';
      if (a.sinPuerta) cues = mouthCues.map((c) => [c.start, c.value]);
      else { const p = puertaSilencio(mouthCues, audio); cues = p.cues; puerta = { db: -60, min: 0.10, tramos: p.tramos }; }
    } else {
      cues = cuesEnvolvente(audio, a.fps);
    }
    const out = { fuente, rhubarb: version, audio: a.audio, duracion, cues, puerta };
    writeFileSync(a.out, JSON.stringify(out) + '\n');
    if (a.js) writeFileSync(a.js, `// generado por scripts/personaje/build-mouth-data.mjs (${fuente}) — no editar a mano\nwindow.${a.var} = ${JSON.stringify(cues)};\n`);
    console.log(`${a.out}: ${cues.length} cues · ${fuente}${version ? ` (${version})` : ''} · ${duracion} s` +
      (puerta ? ` · puerta de silencio: ${puerta.tramos.length} tramos a X` : ''));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
