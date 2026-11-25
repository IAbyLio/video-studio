#!/usr/bin/env node
// preparar-demo.mjs — pone una voz en el demo del muñeco y le saca las bocas (lip-sync) con Rhubarb.
//
//   node modulos/personaje-3d/muneco/preparar-demo.mjs --audio <voz.wav|mp3|m4a|aiff> [--guion guion.txt] [--envolvente]
//   node modulos/personaje-3d/muneco/preparar-demo.mjs --quitar     (vuelve a las bocas sintéticas, sin audio)
//
// Qué hace: copia la voz a demo/assets/voz.wav, corre scripts/personaje/build-mouth-data.mjs (Rhubarb si está
// instalado con scripts/personaje/instalar-rhubarb.sh; si no, boca por volumen) → demo/assets/boca-data.js, y deja
// cableados en demo/index.html el <script> de las bocas y el <audio> de la voz. Ajusta la duración del demo a la voz.
// La voz y sus bocas quedan fuera de git (.gitignore). Usa una voz tuya o con permiso.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
const DEMO = join(AQUI, 'demo');
const INDEX = join(DEMO, 'index.html');

/** Reemplaza lo que hay entre <!-- NOMBRE:INICIO ... --> y <!-- NOMBRE:FIN -->. */
export function entreMarcas(html, nombre, contenido) {
  const re = new RegExp(`(<!-- ${nombre}:INICIO[^>]*-->)[\\s\\S]*?(\\s*<!-- ${nombre}:FIN -->)`);
  if (!re.test(html)) throw new Error(`index.html sin marcas ${nombre}`);
  return html.replace(re, (_, a, b) => a + (contenido ? '\n    ' + contenido : '') + b);
}

/** Cambia la duración del demo (root, clips, DUR del timeline y del módulo). */
export function fijarDuracion(html, dur) {
  return html.replace(/data-duration="[\d.]+"/g, `data-duration="${dur}"`).replace(/const DUR = [\d.]+/g, `const DUR = ${dur}`);
}

function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  let html = readFileSync(INDEX, 'utf8');
  if (argv.includes('--quitar')) {
    html = fijarDuracion(entreMarcas(entreMarcas(html, 'BOCA', ''), 'VOZ', ''), 6).replace(/inicioAudio: [\d.]+/, 'inicioAudio: 0');
    writeFileSync(INDEX, html);
    for (const f of ['voz.wav', 'boca-data.js']) rmSync(join(DEMO, 'assets', f), { force: true });
    console.log('demo sin voz: vuelve a las bocas sintéticas (6 s)');
    return;
  }
  const audio = get('--audio');
  if (!audio || !existsSync(audio)) { console.error('uso: preparar-demo.mjs --audio <archivo> [--guion guion.txt] [--envolvente] | --quitar'); process.exit(1); }
  const voz = join(DEMO, 'assets/voz.wav');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', resolve(audio), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', voz]);
  const durVoz = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voz], { encoding: 'utf8' }).trim());
  const args = [join(RAIZ, 'scripts/personaje/build-mouth-data.mjs'), '--audio', voz, '--out', join(DEMO, 'assets/boca.json'), '--js', join(DEMO, 'assets/boca-data.js'), '--var', 'MOUTH'];
  if (get('--guion')) args.push('--guion', resolve(get('--guion')));
  if (argv.includes('--envolvente')) args.push('--envolvente');
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  rmSync(join(DEMO, 'assets/boca.json'), { force: true });
  const inicio = 0.4;                                       // la voz entra a los 0,4 s
  const dur = Math.max(6, Math.ceil((durVoz + inicio + 0.8) * 10) / 10);
  html = entreMarcas(html, 'BOCA', '<script src="assets/boca-data.js"></script>');
  html = entreMarcas(html, 'VOZ', `<audio id="voz" src="assets/voz.wav" data-start="${inicio}" data-duration="${durVoz.toFixed(3)}" data-track-index="9" data-volume="1"></audio>`);
  html = fijarDuracion(html, dur).replace(/data-duration="[\d.]+"( data-track-index="9")/, `data-duration="${durVoz.toFixed(3)}"$1`);
  html = html.replace(/inicioAudio: [\d.]+/, `inicioAudio: ${inicio}`);
  writeFileSync(INDEX, html);
  console.log(`demo con voz: ${durVoz.toFixed(2)} s de voz desde ${inicio} s · duración ${dur} s · siguiente: cd ${DEMO.slice(RAIZ.length + 1)} && npx hyperframes render --quality draft --output renders/demo.mp4`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
