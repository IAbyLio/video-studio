// medios.mjs — E/S del carril "editar un bruto": ffprobe, extracción de audio, envolvente, silencedetect, whisper-cli
// por bloques y lanzador de ffmpeg. Sin dependencias npm: node + ffmpeg/ffprobe + whisper-cli (modelos locales).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsearSilencedetect, tokensAPalabras, esAlucinacion } from './lib.mjs';

export const DIR_MODELOS = process.env.WHISPER_MODELOS || path.join(os.homedir(), '.cache/hyperframes/whisper/models');
// El prompt empuja a whisper a transcribir las muletillas (por defecto las "limpia") y a puntuar las frases.
export const PROMPT_MULETILLAS = 'Eh... bueno, o sea, mmm, este... Vale. ¿Vale? Pues nada, en plan, digamos.';

export function ffmpeg(args, { capturar = false } = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg falló (${r.status}):\n${(r.stderr || '').split('\n').slice(-15).join('\n')}`);
  return capturar ? (r.stderr || '') + (r.stdout || '') : '';
}

export function ffprobeJson(ruta, extra = []) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', ...extra, ruta], { encoding: 'utf8', maxBuffer: 1 << 28 }));
}

const fraccion = (s) => { const [a, b] = String(s || '0/1').split('/').map(Number); return b ? a / b : 0; };

// Datos del bruto: duración, dimensiones VISIBLES (aplicando rotación), fps nominal y si es VFR (frame rate variable,
// lo normal en móviles). El VFR se mide en los timestamps reales de los primeros ~10 s, no en la cabecera.
export function probar(ruta) {
  const j = ffprobeJson(ruta, ['-show_format', '-show_streams']);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const duracion = parseFloat(j.format.duration);
  const out = { ruta, duracion, video: null, audio: null };
  if (v) {
    let rot = 0;
    for (const sd of v.side_data_list || []) if (sd.rotation != null) rot = Number(sd.rotation);
    if (v.tags?.rotate) rot = Number(v.tags.rotate);
    const girado = Math.abs(rot) % 180 === 90;
    const pts = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-read_intervals', '%+10',
      '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', ruta], { encoding: 'utf8' })
      .split('\n').map(Number).filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
    const deltas = pts.slice(1).map((t, i) => t - pts[i]).filter((d) => d > 0);
    const media = deltas.reduce((s, d) => s + d, 0) / (deltas.length || 1);
    const desv = Math.sqrt(deltas.reduce((s, d) => s + (d - media) ** 2, 0) / (deltas.length || 1));
    out.video = {
      ancho: girado ? v.height : v.width, alto: girado ? v.width : v.height, rotacion: rot,
      fpsNominal: fraccion(v.r_frame_rate), fpsMedio: fraccion(v.avg_frame_rate),
      vfr: deltas.length > 5 && media > 0 && desv / media > 0.08, desviacionFrame: media ? +(desv / media).toFixed(3) : 0,
      codec: v.codec_name, pixFmt: v.pix_fmt,
    };
  }
  if (a) out.audio = { sr: Number(a.sample_rate), canales: a.channels, codec: a.codec_name, inicio: parseFloat(a.start_time || 0) };
  return out;
}

export function extraerWav(entrada, salida, { sr = 16000 } = {}) {
  ffmpeg(['-v', 'error', '-i', entrada, '-vn', '-ac', '1', '-ar', String(sr), '-c:a', 'pcm_s16le', salida]);
  return salida;
}

export function leerPcm16(ruta) {
  const buf = fs.readFileSync(ruta);
  let off = 12, dataOff = -1, dataLen = 0, sr = 16000;
  while (off < buf.length - 8) {
    const id = buf.toString('ascii', off, off + 4), len = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') sr = buf.readUInt32LE(off + 12);
    if (id === 'data') { dataOff = off + 8; dataLen = Math.min(len, buf.length - off - 8); break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) throw new Error(`${ruta}: WAV sin chunk data`);
  const n = Math.floor(dataLen / 2);
  const muestras = new Int16Array(n);
  for (let i = 0; i < n; i++) muestras[i] = buf.readInt16LE(dataOff + 2 * i);
  return { sr, muestras };
}

// Envolvente RMS (ventana 10 ms, salto 5 ms), normalizada a 0..1 (1 = fondo de escala).
export function envolvente({ sr, muestras }, { ventana = 0.010, salto = 0.005 } = {}) {
  const W = Math.round(ventana * sr), H = Math.round(salto * sr);
  const out = [];
  for (let i = 0; i + W <= muestras.length; i += H) {
    let acc = 0;
    for (let j = 0; j < W; j++) { const v = muestras[i + j] / 32768; acc += v * v; }
    out.push(Math.sqrt(acc / W));
  }
  return { hop: salto, valores: Float32Array.from(out) };
}

export const aDb = (x) => 20 * Math.log10(Math.max(x, 1e-6));

// Umbral de silencio automático: suelo de ruido (percentil 10 de la envolvente) + 12 dB, entre −50 y −28 dBFS.
// Con room tone alto, un umbral fijo de −35 dB no detecta ningún silencio; con estudio muy limpio, corta respiraciones.
export function ruidoAutomatico(env) {
  const v = Array.from(env.valores).sort((a, b) => a - b);
  const p10 = v[Math.floor(v.length * 0.10)] || 1e-5, p95 = v[Math.floor(v.length * 0.95)] || 0.1;
  const umbral = Math.min(-28, Math.max(-50, aDb(p10) + 12, aDb(p95) - 30));
  return Math.round(umbral);
}

export function silencios(wav, { ruidoDb, minimo = 0.25, duracion }) {
  const err = ffmpeg(['-i', wav, '-af', `silencedetect=noise=${ruidoDb}dB:d=${minimo}`, '-f', 'null', '-'], { capturar: true });
  return parsearSilencedetect(err, duracion);
}

// Modelo por defecto: el mejor que ya tengas descargado (large-v3 > medium > small). Sin ninguno, small (≈ 490 MB):
// se baja con `npx hyperframes transcribe <audio> --model small` o `npx hyperframes models`.
export function modeloPorDefecto() {
  for (const m of ['large-v3', 'medium', 'small']) if (fs.existsSync(path.join(DIR_MODELOS, `ggml-${m}.bin`))) return m;
  return 'small';
}

// whisper a veces cuelga al final de un bloque una palabra fantasma ("Subtitulado", "Gracias") sobre el silencio.
// Se quita solo si va AL FINAL del bloque y queda texto real antes.
export function quitarColaFantasma(palabras) {
  const out = palabras.slice();
  while (out.length > 1 && esAlucinacion(out[out.length - 1].w)) out.pop();
  return out;
}

export function rutaModelo(modelo) {
  const p = modelo.endsWith('.bin') ? modelo : path.join(DIR_MODELOS, `ggml-${modelo}.bin`);
  if (!fs.existsSync(p)) throw new Error(`no encuentro el modelo whisper ${p} (modelos en ${DIR_MODELOS}). Bájalo con: npx hyperframes transcribe <un-audio> --model ${path.basename(p).replace(/^ggml-|\.bin$/g, '')}`);
  return p;
}

// Transcribe un bloque (que empieza y acaba en silencio) aislado en su propio WAV: whisper-cli ignora -d, así que
// hay que cortar el archivo. Los tiempos vuelven en segundos de la fuente.
// Con `reusar`, si ya existe la salida de whisper de ESTE mismo bloque (misma ventana y modelo), no se vuelve a pagar.
export function transcribirBloque(wav16k, bloque, { modelo = modeloPorDefecto(), prompt = PROMPT_MULETILLAS, dirTmp, idioma = 'es', idx = 0, reusar = false }) {
  const base = path.join(dirTmp, `b${String(idx).padStart(3, '0')}`);
  const firma = JSON.stringify({ i: bloque.inicio, f: bloque.fin, modelo, prompt });
  const fFirma = base + '.firma.json';
  const valido = reusar && fs.existsSync(base + '.json') && fs.existsSync(fFirma) && fs.readFileSync(fFirma, 'utf8') === firma;
  if (!valido) {
    ffmpeg(['-v', 'error', '-ss', String(bloque.inicio), '-t', String(bloque.fin - bloque.inicio), '-i', wav16k,
      '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', base + '.wav']);
    const args = ['-m', rutaModelo(modelo), '-f', base + '.wav', '-l', idioma, '-ojf', '-of', base, '-np'];
    if (prompt) args.push('--prompt', prompt);
    const r = spawnSync('whisper-cli', args, { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`whisper-cli falló en el bloque ${idx}: ${(r.stderr || '').slice(-400)}`);
    fs.writeFileSync(fFirma, firma);
  }
  const j = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
  const texto = (j.transcription || []).map((s) => s.text).join(' ').trim();
  if (esAlucinacion(texto)) return { texto, palabras: [], alucinacion: true };
  const palabras = quitarColaFantasma(tokensAPalabras(j.transcription, bloque.inicio)
    .map((p) => ({ ...p, s: Math.max(p.s, bloque.inicio), e: Math.min(p.e, bloque.fin) })));
  return { texto, palabras, alucinacion: false };
}

// Loudness integrado (EBU R128) para avisar de brutos muy bajos (micro de portátil, Zoom…).
export function loudness(ruta) {
  const err = ffmpeg(['-i', ruta, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { capturar: true });
  const I = err.match(/I:\s+(-?[\d.]+) LUFS/g), P = err.match(/Peak:\s+(-?[\d.]+) dBFS/g);
  return { lufs: I ? parseFloat(I[I.length - 1].match(/-?[\d.]+/)[0]) : null, picoDb: P ? parseFloat(P[P.length - 1].match(/-?[\d.]+/)[0]) : null };
}

export function escribirJson(ruta, obj) { fs.writeFileSync(ruta, JSON.stringify(obj, null, 2) + '\n'); }
export function leerJson(ruta) { return JSON.parse(fs.readFileSync(ruta, 'utf8')); }

// Argumentos --clave valor / --bandera. Devuelve { _: [posicionales], clave: valor }.
export function argumentos(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) out[k] = true; else { out[k] = sig; i++; }
  }
  return out;
}

export const fmt = (s) => (s == null ? '—' : `${Number(s).toFixed(2)} s`);
