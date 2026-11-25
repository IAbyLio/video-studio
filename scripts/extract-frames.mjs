#!/usr/bin/env node
// extract-frames.mjs — saca fotogramas de un MP4 ya renderizado en los segundos que pidas (para revisar el render;
// para mirar la composición sin renderizar, usa `npx hyperframes snapshot --at ...` dentro del proyecto).
// CLI: node scripts/extract-frames.mjs <video.mp4> <t1> <t2> ... [--out <dir>]
// Salida: <dir>/t<segundos>.png (por defecto <carpeta-del-video>/frames-qa/)
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const video = args.find((a) => !a.startsWith('--') && /\.(mp4|mov|webm|mkv)$/i.test(a));
if (!video) { console.error('uso: extract-frames.mjs <video.mp4> <t1> [t2 ...] [--out dir]'); process.exit(1); }
const oi = args.indexOf('--out');
const outDir = oi >= 0 ? args[oi + 1] : join(dirname(video), 'frames-qa');
const times = args.filter((a, i) => !a.startsWith('--') && a !== video && i !== oi + 1 && !Number.isNaN(Number(a)));
mkdirSync(outDir, { recursive: true });
const escritos = [];
for (const t of times) {
  const out = join(outDir, `t${String(t).replace('.', '_')}.png`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', out]);
  escritos.push(out);
}
console.log(escritos.join('\n'));
