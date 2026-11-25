#!/usr/bin/env node
// sfx-generate.mjs — genera un efecto de sonido con TU cuenta de ElevenLabs (sound-generation), lo mide y lo suma al
// manifest. GASTA CRÉDITOS de tu cuenta: por eso no corre sin --confirmo-gasto. Cachea por texto: no regenera lo mismo.
//
// CLI: node scripts/sfx-generate.mjs "<descripción en inglés>" [--name <id>] [--seconds <n>] [--category <cat>] --confirmo-gasto
//      node scripts/sfx-generate.mjs "<descripción>" --dry-run     (muestra qué haría, sin red)
// Requiere ELEVENLABS_API_KEY en .env (raíz del repo). Revisa los términos de uso de ElevenLabs sobre los sonidos
// generados antes de publicarlos o redistribuirlos.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureTransientOffset } from './sfx-measure.mjs';
import { upsertEntry, validateManifest, MANIFEST_DEFECTO, CATEGORIES } from './sfx-manifest.mjs';
import { cargarEnv } from './lib/env.mjs';

const SFX_DIR = dirname(MANIFEST_DEFECTO);

export function promptId(prompt) {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  const hash = createHash('sha256').update(prompt).digest('hex').slice(0, 8);
  return `gen-${slug}-${hash}`;
}

async function generate(prompt, { name, seconds, category = 'transition', dryRun = false, confirmo = false } = {}) {
  const id = name || promptId(prompt);
  const wav = join(SFX_DIR, `${id}.wav`);
  if (!CATEGORIES.includes(category)) throw new Error(`--category debe ser una de: ${CATEGORIES.join(', ')}`);
  if (existsSync(wav)) { console.log(`ya existe (sin gasto): ${wav}`); return id; }
  if (dryRun || !confirmo) {
    console.log(JSON.stringify({ dry_run: true, id, archivo: wav, texto: prompt, segundos: seconds ?? 'auto', categoria: category,
      aviso: 'Esto gasta créditos de tu cuenta de ElevenLabs. Para generarlo de verdad, repite el comando con --confirmo-gasto.' }, null, 2));
    return id;
  }
  cargarEnv(['ELEVENLABS_API_KEY']);
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('falta ELEVENLABS_API_KEY en .env (copia .env.example como .env y complétala tú en tu editor)');

  const body = { text: prompt, prompt_influence: 0.3 };
  if (seconds) body.duration_seconds = Number(seconds);
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  mkdirSync(SFX_DIR, { recursive: true });
  const mp3 = join(SFX_DIR, `${id}.mp3`);
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ar', '44100', '-ac', '1', wav]);

  const offset = measureTransientOffset(wav);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }).trim());
  const manifest = JSON.parse(readFileSync(MANIFEST_DEFECTO, 'utf8'));
  upsertEntry(manifest, id, {
    file: `${id}.wav`, duration: Number(dur.toFixed(3)), transient_offset: offset, category, default_volume: 0.3, use_for: [],
    license: 'Generado con ElevenLabs con tu cuenta (revisa sus términos antes de redistribuir)', source: 'elevenlabs-sound-generation',
  });
  const errs = validateManifest(manifest);
  if (errs.length) throw new Error('manifest inválido tras sumar el efecto: ' + errs.join(', '));
  writeFileSync(MANIFEST_DEFECTO, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`generado ${wav} (arranque ${offset} s, ${dur.toFixed(2)} s) y sumado al manifest`);
  return id;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const valores = new Set(['--name', '--seconds', '--category'].map((k) => args.indexOf(k)).filter((i) => i >= 0).map((i) => i + 1));
  const prompt = args.find((a, i) => !a.startsWith('--') && !valores.has(i));
  if (!prompt) { console.error('uso: sfx-generate.mjs "<descripción>" [--name id] [--seconds n] [--category cat] (--dry-run | --confirmo-gasto)'); process.exit(1); }
  generate(prompt, { name: get('--name'), seconds: get('--seconds'), category: get('--category'), dryRun: args.includes('--dry-run'), confirmo: args.includes('--confirmo-gasto') })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
