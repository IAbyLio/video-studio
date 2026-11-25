// voice-profile.mjs — registro de voces (modulos/voz/perfiles.json) y payloads de ElevenLabs.
//
// Regla de identidad: solo se genera con una voz DECLARADA en el registro, habilitada, con voice_id y con una nota de
// autorización (de quién es la voz y quién permitió usarla). Un ID que no figure en el registro se rechaza antes de
// llamar a la API, y antes de cada generación se comprueba que ElevenLabs devuelve ese mismo ID con el mismo nombre.
// El registro viene VACÍO: cada persona declara la suya (guía en modulos/voz/README.md).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MODELS = Object.freeze({ v2: 'eleven_multilingual_v2', v4: 'eleven_v4' });
export const PERFILES_PATH = fileURLToPath(new URL('../modulos/voz/perfiles.json', import.meta.url));

const RANGOS = { speed: [0.7, 1.2], stability: [0, 1], similarity: [0, 1], style: [0, 1] };
const CAMPOS_MODELO = { v2: ['stability', 'similarity', 'style', 'speed'], v4: ['stability', 'similarity'] };

export const EJEMPLO_PERFIL = {
  mi_voz: {
    nombre: 'Mi voz',
    nombre_remoto: '<el nombre EXACTO que tiene la voz en tu cuenta de ElevenLabs>',
    voice_id: '<el Voice ID de esa voz (ElevenLabs → Voices → ⋯ → Copy voice ID)>',
    habilitado: true,
    modelo: 'v2',
    language_code: 'es',
    settings: { v2: { stability: 0.6, similarity: 0.9, style: 0, speed: 1 }, v4: { stability: 0.65, similarity: 1 } },
    postproceso: { semitonos: 0 },
    autorizacion: 'Mi propia voz, clonada por mí el AAAA-MM-DD para mis vídeos.',
  },
};

export const GUIA_PERFIL = [
  'Todavía no hay ninguna voz declarada en modulos/voz/perfiles.json, así que no se genera nada (es a propósito).',
  'Para declarar la tuya:',
  '  1. Clónala o elígela en tu cuenta de ElevenLabs y copia su Voice ID.',
  '  2. Agrega un perfil dentro de "perfiles" en modulos/voz/perfiles.json, así:',
  JSON.stringify(EJEMPLO_PERFIL, null, 2).split('\n').map((l) => '     ' + l).join('\n'),
  '  3. Comprueba sin gastar: node scripts/voz.mjs --dry-run --perfil mi_voz',
  'Solo voces tuyas o con permiso explícito de su dueño (la nota "autorizacion" es obligatoria).',
].join('\n');

/** Error con mensaje para personas: voz.mjs lo imprime sin pila. */
export class ErrorVoz extends Error {
  constructor(msg, codigo = 2) { super(msg); this.amigable = true; this.codigo = codigo; }
}

function checkRango(key, value, where = `--${key}`) {
  const [min, max] = RANGOS[key];
  if (!Number.isFinite(value) || value < min || value > max) throw new ErrorVoz(`${where} debe ser un número entre ${min} y ${max}.`);
}

export function verifyRemoteVoice(voice, perfil) {
  if (voice.voice_id !== perfil.voice_id || voice.name !== perfil.nombre_remoto) {
    throw new ErrorVoz(`La voz que devolvió ElevenLabs ("${voice.name}", ${voice.voice_id}) no coincide con el perfil "${perfil.clave}" ` +
      `("${perfil.nombre_remoto}", ${perfil.voice_id}). Generación cancelada: revisa el perfil.`);
  }
}

export function voiceSettings(args, model = 'v2') {
  for (const key of CAMPOS_MODELO[model]) checkRango(key, args[key]);
  if (model === 'v4') return { stability: args.stability, similarity_boost: args.similarity, use_speaker_boost: true };
  return { stability: args.stability, similarity_boost: args.similarity, style: args.style, use_speaker_boost: true, speed: args.speed };
}

export function speechPayload({ text, args, prevText, nextText, prevRequestIds, perfil = null, model = null }) {
  const m = model || (perfil ? perfil.modelo : 'v2');
  const body = { text, model_id: MODELS[m], voice_settings: voiceSettings(args, m) };
  if (m === 'v4' && perfil?.language_code) body.language_code = perfil.language_code;   // solo v4 lo usa
  if (prevText) body.previous_text = prevText;
  if (nextText) body.next_text = nextText;
  if (prevRequestIds?.length) body.previous_request_ids = prevRequestIds.slice(-3);
  return body;
}

function validarPerfil(clave, p) {
  const err = (msg) => { throw new ErrorVoz(`perfil "${clave}": ${msg}`); };
  if (!p || typeof p !== 'object') err('no es un objeto.');
  if (typeof p.nombre !== 'string' || !p.nombre.trim()) err('falta "nombre".');
  if (typeof p.autorizacion !== 'string' || !p.autorizacion.trim()) err('falta la nota de "autorizacion" (obligatoria: de quién es la voz y quién lo permitió).');
  if (typeof p.habilitado !== 'boolean') err('"habilitado" debe ser true o false.');
  if (!MODELS[p.modelo]) err(`"modelo" debe ser ${Object.keys(MODELS).join(' | ')}.`);
  if (p.habilitado) {
    if (typeof p.voice_id !== 'string' || !p.voice_id.trim() || p.voice_id.startsWith('<')) err('habilitado pero sin "voice_id" real.');
    if (typeof p.nombre_remoto !== 'string' || !p.nombre_remoto.trim() || p.nombre_remoto.startsWith('<')) err('habilitado pero sin "nombre_remoto" (se compara con lo que devuelve ElevenLabs).');
  }
  if (!p.settings || typeof p.settings !== 'object') err('falta "settings".');
  for (const [m, campos] of Object.entries(CAMPOS_MODELO)) {
    const s = p.settings[m];
    if (!s) err(`faltan settings para ${m}.`);
    for (const k of campos) checkRango(k, s[k], `perfil "${clave}" settings.${m}.${k}`);
  }
  const semi = p.postproceso?.semitonos ?? 0;
  if (!Number.isInteger(semi) || semi < -12 || semi > 12) err('postproceso.semitonos debe ser un entero entre -12 y 12.');
  return Object.freeze({ ...p, clave, postproceso: Object.freeze({ semitonos: semi }) });
}

export function validarPerfiles(registro) {
  if (!registro || typeof registro.perfiles !== 'object' || registro.perfiles === null) throw new ErrorVoz('el registro de voces no tiene "perfiles".');
  const out = {};
  for (const [clave, p] of Object.entries(registro.perfiles)) out[clave] = validarPerfil(clave, p);
  return Object.freeze(out);
}

export function loadPerfiles(path = PERFILES_PATH) {
  return validarPerfiles(JSON.parse(readFileSync(path, 'utf8')));
}

/**
 * Perfil a usar. Sin nombre: el único habilitado (si hay uno solo). Registro vacío → guía para declarar uno.
 * ELEVENLABS_VOICE_ID del entorno, si existe, tiene que ser el voice_id de algún perfil declarado.
 */
export function resolvePerfil(nombre, { env = process.env, perfiles = loadPerfiles() } = {}) {
  const claves = Object.keys(perfiles);
  if (!claves.length) throw new ErrorVoz(GUIA_PERFIL, 3);
  let clave = nombre;
  if (!clave) {
    const hab = claves.filter((k) => perfiles[k].habilitado);
    if (hab.length !== 1) throw new ErrorVoz(`Hay ${hab.length} perfiles habilitados (${hab.join(', ') || 'ninguno'}): elige uno con --perfil <nombre>.`);
    clave = hab[0];
  }
  const p = perfiles[clave];
  if (!p) throw new ErrorVoz(`Perfil de voz desconocido: "${clave}". Declarados: ${claves.join(', ')}.`);
  if (!p.habilitado) throw new ErrorVoz(`El perfil "${clave}" está deshabilitado (${p.autorizacion}).`);
  const envId = env.ELEVENLABS_VOICE_ID;
  if (envId && !Object.values(perfiles).some((q) => q.voice_id === envId)) {
    throw new ErrorVoz('ELEVENLABS_VOICE_ID (en tu entorno o .env) no corresponde a ningún perfil declarado. Generación cancelada.');
  }
  return p;
}

export function perfilArgs(perfil, model, overrides = {}) {
  const base = { ...perfil.settings[model] };
  for (const k of Object.keys(RANGOS)) if (overrides[k] !== undefined) base[k] = overrides[k];
  voiceSettings(base, model);
  return base;
}

/** Cadena -af que sube/baja N semitonos manteniendo la duración (ffmpeg, local, sin créditos). */
export function pitchFilter(semitonos, sampleRate) {
  if (!Number.isInteger(semitonos) || semitonos < -12 || semitonos > 12) throw new Error('semitonos debe ser un entero entre -12 y 12.');
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error('sampleRate inválido.');
  const k = Math.pow(2, semitonos / 12);
  return `asetrate=${sampleRate}*${k.toFixed(6)},aresample=${sampleRate},atempo=${(1 / k).toFixed(6)}`;
}

export function aplicarPitch(inPath, outPath, semitonos) {
  const sr = Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', inPath], { encoding: 'utf8' }).trim());
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', inPath, '-af', pitchFilter(semitonos, sr), '-c:a', 'libmp3lame', '-b:a', '192k', outPath], { stdio: 'pipe' });
  return outPath;
}
