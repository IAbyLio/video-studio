#!/usr/bin/env node
// cortar.mjs — aplica `cortes.json` al bruto en UNA sola pasada de ffmpeg (un decode, un encode):
//   - cada tramo con número exacto de frames (fps fijo: normaliza VFR) y número exacto de muestras de audio,
//     cortados en el MISMO instante de la rejilla de frames → cero deriva audio/vídeo acumulada;
//   - micro-fundido de audio en cada junta (mata el click sin desplazar el vídeo; acrossfade sí desincroniza);
//   - re-encode consistente (H.264 yuv420p CFR + AAC 48 kHz) y la voz cortada aparte en WAV PCM (para el canon de sonido).
// Además re-temporiza las palabras al clip resultante (words.json + transcript-cortado.json en formato whisper-cli,
// que generate-captions.mjs lee tal cual) y deja el mapa fuente→salida (mapa-tiempos.json).
//
// Uso: node scripts/bruto/cortar.mjs <dir>/cortes.json [--salida <dir>] [--crf 18] [--usar-conservar]
// Se niega si quedan descartes "pendiente" o si los descartes cambiaron y no se re-planificó.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { filtroCorte, mapaTiempos, retemporizarPalabras, aTranscriptWhisper, huellaPlan, validarConservar, aplicarCorrecciones } from './lib.mjs';
import { probar, ffmpeg, escribirJson, leerJson, argumentos, fmt } from './medios.mjs';

const A = argumentos(process.argv.slice(2));
const ruta = A._[0] && path.resolve(A._[0]);
if (!ruta || !fs.existsSync(ruta)) { console.error('uso: cortar.mjs <cortes.json> [--salida dir] [--crf 18] [--usar-conservar]'); process.exit(1); }
const dir = path.dirname(ruta);
const out = path.resolve(A.salida || dir);
fs.mkdirSync(out, { recursive: true });
const c = leerJson(ruta);

// ---- gates
const pend = c.descartes.filter((d) => d.decision === 'pendiente');
if (pend.length) {
  console.error(`[cortar] hay ${pend.length} descarte(s) PENDIENTE(S) de decisión humana:`);
  for (const d of pend) console.error(`   ${d.id} ${d.inicio.toFixed(2)}–${d.fin.toFixed(2)} ${d.motivo}: "${d.texto}" — ${d.detalle}`);
  console.error('Pon "decision": "cortar" o "conservar" en cada uno y corre analizar.mjs --replanificar.');
  process.exit(2);
}
const huella = huellaPlan(c.descartes, { ...c.parametros, fps: c.fps });
if (huella !== c.huella_plan && !A.usarConservar) {
  console.error('[cortar] los descartes o parámetros cambiaron desde el último plan: corre `analizar.mjs --replanificar ' + ruta + '`.');
  console.error('         (si editaste "conservar" a mano a propósito, pasa --usar-conservar)');
  process.exit(2);
}
const info = probar(c.fuente);
const errores = validarConservar(c.conservar, info.duracion, c.fps);
if (errores.length) { console.error('[cortar] cortes.json inválido:\n  - ' + errores.join('\n  - ')); process.exit(2); }

// ---- corte
const fps = c.fps, SR = 48000;
const conAudio = !!info.audio;
let filtro = filtroCorte(c.conservar, { fps, sr: SR, fadeMs: c.parametros.fadeMs ?? 20, conAudio });
if (conAudio) filtro += ';\n[a]asplit=2[a1][a2]';
const fFiltro = path.join(dir, 'analisis', 'filtro-corte.txt');
fs.mkdirSync(path.dirname(fFiltro), { recursive: true });
fs.writeFileSync(fFiltro, filtro);

const clip = path.join(out, 'clip-cortado.mp4');
const vozWav = path.join(out, 'voz-cortada.wav');
const crf = String(A.crf || 18);
const args = ['-v', 'error', '-i', c.fuente, '-/filter_complex', fFiltro,
  '-map', '[v]', ...(conAudio ? ['-map', '[a1]'] : []),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps),
  '-g', String(fps * 2), '-video_track_timescale', String(fps * 1000),
  ...(conAudio ? ['-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-ac', '2'] : []),
  '-movflags', '+faststart', clip];
if (conAudio) args.push('-map', '[a2]', '-c:a', 'pcm_s16le', '-ar', String(SR), '-ac', '1', vozWav);
const t0 = Date.now();
console.log(`[cortar] ${c.conservar.length} tramos → ${path.relative(process.cwd(), clip)} (una pasada, ${fps} fps CFR)`);
ffmpeg(args);

// ---- palabras re-temporizadas
const mapa = mapaTiempos(c.conservar, fps);
const durEsperada = mapa.length ? mapa[mapa.length - 1].salida[1] : 0;
const palabras = leerJson(path.join(dir, 'analisis/palabras-fuente.json'));
const ps = aplicarCorrecciones(retemporizarPalabras(palabras, mapa), c.correcciones || []);
escribirJson(path.join(out, 'mapa-tiempos.json'), { fuente: c.fuente, fps, duracion: durEsperada, tramos: mapa });
escribirJson(path.join(out, 'words.json'), { fuente: c.fuente, clip: path.basename(clip), fps, duracion: durEsperada, palabras: ps });
escribirJson(path.join(out, 'transcript-cortado.json'), aTranscriptWhisper(ps));

// ---- comprobación de duraciones (vídeo y audio deben medir lo mismo: ≤ 1 frame)
const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json',
  '-count_frames', '-show_entries', 'stream=codec_type,nb_read_frames,duration,sample_rate', clip], { encoding: 'utf8' }));
const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio');
const durV = Number(v.nb_read_frames) / fps;
const durA = a ? parseFloat(a.duration) : null;
const okV = Math.abs(durV - durEsperada) <= 1 / fps + 1e-6;
const okA = durA == null || Math.abs(durA - durV) <= 1 / fps + 0.03;   // el AAC añade como mucho ~1 trama (21 ms) de relleno
console.log(`[cortar] esperado ${fmt(durEsperada)} · vídeo ${Number(v.nb_read_frames)} frames = ${fmt(durV)} ${okV ? 'OK' : 'DESCUADRE'} · audio ${fmt(durA)} ${okA ? 'OK' : 'DESCUADRE'}`);
console.log(`[cortar] ${ps.length}/${palabras.length} palabras conservadas → words.json · voz → ${path.basename(vozWav)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (!okV || !okA) process.exit(3);
