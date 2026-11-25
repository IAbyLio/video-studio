#!/usr/bin/env node
// comprobar-entorno.mjs — revisa, SIN instalar nada, lo que este estudio necesita en el ordenador: sistema, Node,
// FFmpeg/FFprobe, espacio libre, y las herramientas opcionales de cada módulo. Lo usa el paso 1 de ONBOARDING.md.
// CLI: node scripts/comprobar-entorno.mjs [--json]
// Código de salida: 0 si lo imprescindible está (Node ≥ 22, FFmpeg, FFprobe, ≥ 3 GB libres); 1 si falta algo.
import { spawnSync } from 'node:child_process';
import { existsSync, statfsSync, readFileSync } from 'node:fs';
import { homedir, platform, arch, release } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

function correr(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: platform() === 'win32' });
  if (r.error || r.status !== 0) return null;
  return ((r.stdout || '') + (r.stderr || '')).trim();
}
const primera = (s) => (s ? s.split('\n')[0].trim() : null);

export function versionMayor(v) { const m = String(v || '').match(/v?(\d+)\./); return m ? Number(m[1]) : 0; }

export function diagnostico() {
  const so = platform(), libres = (() => { try { const s = statfsSync(RAIZ); return +(s.bavail * s.bsize / 1e9).toFixed(1); } catch { return null; } })();
  const brew = so === 'darwin' ? primera(correr('brew', ['--version'])) : null;
  const ffmpeg = primera(correr('ffmpeg', ['-version']));
  const ffprobe = primera(correr('ffprobe', ['-version']));
  const whisper = correr(so === 'win32' ? 'where' : 'which', ['whisper-cli']);
  const modelosDir = process.env.WHISPER_MODELOS || join(homedir(), '.cache/hyperframes/whisper/models');
  const rhubarbBin = join(RAIZ, '.cache/rhubarb/BIN');
  const chrome = join(homedir(), '.cache/hyperframes/chrome');
  const hfLocal = join(RAIZ, 'node_modules/hyperframes/package.json');
  const d = {
    sistema: { so, arch: arch(), release: release(), rosetta: so === 'darwin' && arch() === 'arm64' ? correr('arch', ['-x86_64', '/usr/bin/true']) !== null : null },
    imprescindible: {
      node: { version: process.version, ok: versionMayor(process.version) >= 22 },
      ffmpeg: { version: ffmpeg, ok: Boolean(ffmpeg) },
      ffprobe: { version: ffprobe, ok: Boolean(ffprobe) },
      disco: { libres_gb: libres, ok: libres === null ? true : libres >= 3 },
    },
    gestor_paquetes: { brew, winget: so === 'win32' ? Boolean(correr('winget', ['--version'])) : null, apt: so === 'linux' ? Boolean(correr('which', ['apt'])) : null },
    hyperframes: {
      instalado_en_repo: existsSync(hfLocal) ? JSON.parse(readFileSync(hfLocal, 'utf8')).version : null,
      navegador_render_en_cache: existsSync(chrome),
      skills_instaladas: JSON.parse(readFileSync(join(RAIZ, 'scripts/skills-oficiales.json'), 'utf8')).fuentes.flatMap((f) => f.skills).every((s) => existsSync(join(RAIZ, '.claude/skills', s, 'SKILL.md')) || existsSync(join(RAIZ, '.agents/skills', s, 'SKILL.md'))),   // detalle: node scripts/comprobar-skills.mjs
    },
    opcional: {
      whisper_cli: { ok: Boolean(whisper), para: 'editar lo que grabas (transcripción por tramos)' },
      modelos_whisper: { dir: modelosDir, presentes: existsSync(modelosDir) ? spawnSync('ls', [modelosDir], { encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean) : [] },
      rhubarb: { ok: existsSync(rhubarbBin), para: 'lip-sync del personaje 3D (bash scripts/personaje/instalar-rhubarb.sh)' },
      swift: { ok: so === 'darwin' && Boolean(correr('which', ['swift'])), para: 'detectar la cara al encuadrar (solo macOS; sin esto se encuadra centrado o a mano)' },
      python3: { ok: Boolean(correr('python3', ['--version'])), para: 'unir tramos de voz del personaje (opcional)' },
    },
  };
  d.ok = Object.values(d.imprescindible).every((x) => x.ok);
  return d;
}

function main() {
  const d = diagnostico();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); process.exit(d.ok ? 0 : 1); }
  const si = (b) => (b ? 'sí' : 'NO');
  console.log(`Sistema: ${d.sistema.so} ${d.sistema.arch} (${d.sistema.release})`);
  console.log(`Node ${d.imprescindible.node.version} → ${d.imprescindible.node.ok ? 'OK' : 'hace falta 22 o más nuevo'}`);
  console.log(`FFmpeg → ${d.imprescindible.ffmpeg.version || 'NO encontrado'}`);
  console.log(`FFprobe → ${d.imprescindible.ffprobe.version || 'NO encontrado'}`);
  console.log(`Espacio libre → ${d.imprescindible.disco.libres_gb ?? '?'} GB ${d.imprescindible.disco.ok ? '' : '(hacen falta al menos 3 GB)'}`);
  console.log(`Hyperframes en el repo → ${d.hyperframes.instalado_en_repo || 'no (npm install)'} · navegador de render en caché: ${si(d.hyperframes.navegador_render_en_cache)} · skills: ${si(d.hyperframes.skills_instaladas)}`);
  for (const [k, v] of Object.entries(d.opcional)) if ('ok' in v) console.log(`  opcional ${k} → ${si(v.ok)} (${v.para})`);
  console.log(d.ok ? '\nLo imprescindible está.' : '\nFalta algo imprescindible (ver arriba).');
  process.exit(d.ok ? 0 : 1);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main();
