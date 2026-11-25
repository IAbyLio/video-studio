#!/usr/bin/env node
// voz.mjs — genera la voz de un guion con ElevenLabs, SOLO con voces declaradas en modulos/voz/perfiles.json.
// GASTA CRÉDITOS de tu cuenta (salvo --dry-run, que nunca toca la red).
//
// Por defecto genera POR TRAMOS: un pedido por párrafo del guion, encadenados (previous_text/next_text +
// previous_request_ids) para que la entonación no se reinicie en cada corte, y unión final en PCM con micro-fundidos
// de 5 ms por junta (unir con `-c copy` deja un clic donde un tramo corta en seco). Si un tramo sale mal, se rehace
// SOLO ese con --only N (los request-ids quedan en tramos/stitch-state.json).
//
// CLI: node scripts/voz.mjs <guion.txt | --text "..."> --output proyectos/<slug>/assets/voz.mp3
//      [--perfil NOMBRE]    → voz del registro (sin --perfil: la única habilitada, si hay una sola)
//      [--model v2|v4]      → pisa el modelo del perfil. v4 = eleven_v4, admite etiquetas cortas [en inglés]
//      [--only N] [--oneshot] [--tramos-dir DIR]
//      [--speed N] [--stability N] [--similarity N] [--style N]   (pisan los settings del perfil; speed/style solo v2)
//      [--force]            → no frena por anotaciones de producción en el texto
//      [--dry-run]          → muestra qué mandaría, sin red ni gasto
//      [--perfiles]         → lista las voces declaradas
//
// Guion: v2 = solo texto hablado (la puntuación marca la entonación); v4 admite [etiquetas] cortas y no admite <break>.
// Guía: modulos/voz/guion-para-voz.md. Lee ELEVENLABS_API_KEY del .env de la raíz (nunca la imprime).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MODELS, resolvePerfil, loadPerfiles, perfilArgs, verifyRemoteVoice, speechPayload, voiceSettings, aplicarPitch, ErrorVoz } from './voice-profile.mjs';
import { cargarEnv } from './lib/env.mjs';

const API = 'https://api.elevenlabs.io';
const ANOTACIONES = [
  /\[[^\]]{2,}\]/,
  /^\s*(GANCHO|DESARROLLO|CIERRE|CTA|EN PANTALLA|B-ROLL|ESCENA|INTRO|CUERPO)\b/im,
  /\*\*/,
  /^#+\s/m,
  /\((?:pausa|tono|ritmo|risa|susurro|serio|en[eé]rgico)[^)]*\)/i,
];
const V4_TAG = /\[[^\]\n]{1,40}\]/g;

function parseArgs(argv) {
  const args = { overrides: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--text') args.text = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--perfil') args.perfil = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--only') args.only = Number(argv[++i]);
    else if (a === '--oneshot') args.oneshot = true;
    else if (a === '--tramos-dir') args.tramosDir = argv[++i];
    else if (['--speed', '--stability', '--similarity', '--style'].includes(a)) args.overrides[a.slice(2)] = Number(argv[++i]);
    else if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--perfiles') args.listar = true;
    else if (a.startsWith('--')) throw new ErrorVoz(`Opción desconocida: ${a}`);
    else rest.push(a);
  }
  if (args.model !== undefined && !MODELS[args.model]) throw new ErrorVoz(`--model ${args.model} no soportado (${Object.keys(MODELS).join(' | ')}).`);
  if (args.only !== undefined && (!Number.isInteger(args.only) || args.only < 1)) throw new ErrorVoz('--only debe ser un entero positivo.');
  if (rest.length > 1 || (args.text !== undefined && rest.length)) throw new ErrorVoz('Usa un solo archivo de guion o --text.');
  if (!args.text && rest[0]) args.text = readFileSync(rest[0], 'utf8');
  return args;
}

async function api(path, opts = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new ErrorVoz('Falta ELEVENLABS_API_KEY en .env (copia .env.example como .env y escríbela tú en tu editor).');
  return fetch(`${API}${path}`, { ...opts, headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
}

async function checkRemoteVoice(perfil) {
  const res = await api(`/v1/voices/${perfil.voice_id}`);
  if (!res.ok) throw new ErrorVoz(`ElevenLabs no encuentra la voz del perfil "${perfil.clave}" (${res.status}). Revisa el voice_id en modulos/voz/perfiles.json.`);
  const v = await res.json();
  verifyRemoteVoice(v, perfil);
  console.log(`voz: "${v.name}" (${perfil.voice_id}) · perfil ${perfil.clave}`);
}

export function lintGuion(text, force, model) {
  const probe = model === 'v4' ? text.replace(V4_TAG, '') : text;
  if (model === 'v4' && /<break /.test(text)) throw new ErrorVoz('v4 no admite <break>: usa [pause] o puntos suspensivos.');
  if (ANOTACIONES.some((re) => re.test(probe)) && !force) {
    throw new ErrorVoz('El texto parece traer anotaciones de producción (corchetes, encabezados, acotaciones). A la voz va SOLO el texto ' +
      'hablado' + (model === 'v4' ? ' (en v4 se permiten etiquetas cortas [en inglés])' : '') + '. Guía: modulos/voz/guion-para-voz.md. Usa --force si es a propósito.');
  }
  if (text.length > 9500) throw new ErrorVoz(`El guion tiene ${text.length} caracteres: pártelo en más párrafos (el límite es ~10k por pedido).`);
}

async function tts({ perfil, model, text, settings, prevText, nextText, prevRequestIds }) {
  const body = speechPayload({ text, args: settings, prevText, nextText, prevRequestIds, perfil, model });
  const res = await api(`/v1/text-to-speech/${perfil.voice_id}?output_format=mp3_44100_192`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new ErrorVoz(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { buf: Buffer.from(await res.arrayBuffer()), requestId: res.headers.get('request-id') || res.headers.get('x-request-id') || null };
}

function unirTramos(files, outPath) {
  const inputs = files.flatMap((f) => ['-i', resolve(f)]);
  const chains = files.map((_, i) => `[${i}:a]afade=t=in:d=0.005,areverse,afade=t=in:d=0.005,areverse[a${i}]`);
  const filter = `${chains.join(';')};${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[out]`;
  execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', outPath], { stdio: 'pipe' });
}

const probeDur = (p) => { try { return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' })).toFixed(1) + ' s'; } catch { return '?'; } };
const rawPathFor = (output, semi) => (semi ? output.slice(0, output.length - extname(output).length) + '.sin-pitch' + (extname(output) || '.mp3') : output);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  cargarEnv(['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID']);
  if (args.listar) {
    const P = loadPerfiles();
    if (!Object.keys(P).length) throw new ErrorVoz('No hay voces declaradas todavía. Para declarar la tuya: node scripts/voz.mjs --dry-run', 3);
    for (const [k, p] of Object.entries(P)) console.log(`${k.padEnd(16)} ${p.habilitado ? 'habilitada  ' : 'deshabilitada'} ${p.nombre} · ${MODELS[p.modelo]}`);
    return;
  }
  const perfil = resolvePerfil(args.perfil);
  const model = args.model || perfil.modelo;
  const settings = perfilArgs(perfil, model, args.overrides);
  const semitonos = perfil.postproceso.semitonos;

  if (args.dryRun) {
    if (args.text) lintGuion(args.text.trim(), args.force, model);
    const payload = speechPayload({ text: '', args: settings, perfil, model });
    console.log(JSON.stringify({ dry_run: true, perfil: perfil.clave, voice_id: perfil.voice_id, voice_name: perfil.nombre_remoto,
      model_id: MODELS[model], voice_settings: voiceSettings(settings, model), language_code: payload.language_code ?? null,
      postproceso: { semitonos }, api_key_presente: Boolean(process.env.ELEVENLABS_API_KEY),
      nota: 'Sin red ni gasto. La calidad solo se sabe escuchando.' }, null, 2));
    return;
  }
  if (!args.text || !args.output) throw new ErrorVoz('uso: node scripts/voz.mjs <guion.txt|--text "..."> --output <salida.mp3> [--perfil NOMBRE] [--model v2|v4] [--dry-run]');
  const text = args.text.trim();
  lintGuion(text, args.force, model);
  await checkRemoteVoice(perfil);

  const tramos = text.split(/\n\s*\n/).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (args.only && args.only > tramos.length) throw new ErrorVoz('--only excede la cantidad de tramos.');
  if (args.only && (args.oneshot || tramos.length === 1)) throw new ErrorVoz('--only requiere generación por varios tramos.');
  mkdirSync(dirname(args.output), { recursive: true });
  const rawOut = rawPathFor(args.output, semitonos);
  const cerrar = (modo) => {
    if (semitonos) aplicarPitch(rawOut, args.output, semitonos);
    console.log(`voz generada (${modo}): ${args.output} (${probeDur(args.output)}, perfil ${perfil.clave}, ${MODELS[model]})`);
  };
  if (args.oneshot || tramos.length === 1) {
    const { buf } = await tts({ perfil, model, text, settings });
    writeFileSync(rawOut, buf);
    return cerrar('una pieza');
  }
  const tramosDir = args.tramosDir || join(dirname(args.output), 'tramos');
  mkdirSync(tramosDir, { recursive: true });
  const statePath = join(tramosDir, 'stitch-state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { requestIds: {} };
  console.log(`${tramos.length} tramos (uno por párrafo) → ${tramosDir}`);
  const files = [];
  for (let i = 0; i < tramos.length; i++) {
    const n = i + 1, outFile = join(tramosDir, `tramo-${String(n).padStart(2, '0')}.mp3`);
    files.push(outFile);
    if (args.only && n !== args.only) {
      if (!existsSync(outFile)) throw new ErrorVoz(`--only ${args.only} pero falta ${outFile}: genera todo primero sin --only.`);
      continue;
    }
    const prevRequestIds = [];
    for (let j = 1; j < n; j++) if (state.requestIds[j]) prevRequestIds.push(state.requestIds[j]);
    const { buf, requestId } = await tts({ perfil, model, text: tramos[i], settings, prevText: tramos[i - 1], nextText: tramos[i + 1], prevRequestIds });
    writeFileSync(outFile, buf);
    if (requestId) state.requestIds[n] = requestId;
    console.log(`tramo ${n}/${tramos.length} → ${outFile} (${probeDur(outFile)})`);
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  unirTramos(files, rawOut);
  cerrar(`${tramos.length} tramos`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((e) => {
  if (e.amigable) { console.error(e.message); process.exit(e.codigo || 2); }
  console.error(e.stack || e.message); process.exit(1);
});
