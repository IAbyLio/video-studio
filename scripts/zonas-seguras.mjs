#!/usr/bin/env node
// zonas-seguras.mjs — pinta las zonas que tapa la interfaz de cada plataforma encima de fotogramas (PNG/JPG), para
// comprobar a ojo que nada importante cae debajo. Rojo = prohibido · amarillo = precaución · verde = contorno de
// la zona segura. Datos: modulos/zonas-seguras/zonas-seguras.json · Explicación: modulos/zonas-seguras/README.md
//
// CLI: node scripts/zonas-seguras.mjs <fotograma.png> [más...] --format <reel|story|ad-vertical|post-3x4|feed-4x5|square-1x1|horizontal-16x9> [--out <dir>]
//      node scripts/zonas-seguras.mjs --list
//      node scripts/zonas-seguras.mjs --rect <reel>           (imprime el rectángulo seguro en JSON)
// Salida: <dir>/<nombre>-zs-<formato>.png (por defecto junto a cada fotograma). Escala por ancho si hace falta.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATOS = JSON.parse(readFileSync(fileURLToPath(new URL('../modulos/zonas-seguras/zonas-seguras.json', import.meta.url)), 'utf8'));

/** Rectángulo interior que dejan libres las zonas prohibidas que tocan un borde y lo cruzan entero. [l, t, r, b] */
export function rectSeguro(spec) {
  let [l, t, r, b] = [0, 0, spec.base.w, spec.base.h];
  for (const { rect: [x, y, bw, bh] } of spec.prohibida) {
    if (bw >= spec.base.w) { if (y === 0) t = Math.max(t, bh); else if (y + bh >= spec.base.h) b = Math.min(b, y); }
    if (bh >= spec.base.h) { if (x === 0) l = Math.max(l, bw); else if (x + bw >= spec.base.w) r = Math.min(r, x); }
  }
  return [l, t, r, b];
}

/** ¿La caja [x, y, w, h] (px del lienzo base) pisa alguna zona prohibida? Devuelve los nombres que pisa. */
export function cajaInvade(spec, [x, y, w, h]) {
  return spec.prohibida.filter(({ rect: [zx, zy, zw, zh] }) => x < zx + zw && x + w > zx && y < zy + zh && y + h > zy).map((z) => z.name);
}

function main(args) {
  const { formats } = DATOS;
  if (args.includes('--list')) {
    for (const [k, f] of Object.entries(formats)) console.log(`${k.padEnd(16)} ${f.base.w}x${f.base.h}  ${f.label}`);
    return;
  }
  const ri = args.indexOf('--rect');
  if (ri >= 0) {
    const f = formats[args[ri + 1]];
    if (!f) { console.error('formato desconocido (--list)'); process.exit(1); }
    const [l, t, r, b] = rectSeguro(f);
    console.log(JSON.stringify({ formato: args[ri + 1], base: f.base, seguro: { x: l, y: t, ancho: r - l, alto: b - t },
      extra: f.prohibida.filter((z) => z.rect[2] < f.base.w && z.rect[3] < f.base.h).map((z) => ({ name: z.name, rect: z.rect })) }, null, 2));
    return;
  }
  const fi = args.indexOf('--format'), oi = args.indexOf('--out');
  const format = fi >= 0 ? args[fi + 1] : null, outDir = oi >= 0 ? args[oi + 1] : null;
  const valores = new Set([fi, oi].filter((i) => i >= 0).map((i) => i + 1));
  const frames = args.filter((a, i) => !a.startsWith('--') && !valores.has(i));
  if (!format || !formats[format] || !frames.length) {
    console.error('uso: zonas-seguras.mjs <fotograma.png> [...] --format <formato> [--out dir]   (--list para ver formatos)');
    process.exit(1);
  }
  const spec = formats[format];
  const escritos = [];
  for (const frame of frames) {
    const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', frame])
      .toString().trim().split('x').map(Number);
    const k = w / spec.base.w;
    if (Math.abs(Math.round(spec.base.h * k) - h) > 2) console.warn(`[aviso] ${basename(frame)} mide ${w}x${h}; ${format} espera proporción ${spec.base.w}x${spec.base.h}. ¿Formato equivocado?`);
    const box = ([x, y, bw, bh], color, t = 'fill') =>
      `drawbox=x=${Math.round(x * k)}:y=${Math.round(y * k)}:w=${Math.round(bw * k)}:h=${Math.round(bh * k)}:color=${color}:t=${t}`;
    const [l, t, r, b] = rectSeguro(spec);
    const filtros = [
      ...spec.precaucion.map((z) => box(z.rect, 'yellow@0.28')),
      ...spec.prohibida.map((z) => box(z.rect, 'red@0.38')),
      box([l, t, r - l, b - t], 'lime@0.9', Math.max(2, Math.round(4 * k))),
    ];
    const dir = outDir || dirname(frame);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `${basename(frame, extname(frame))}-zs-${format}.png`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', frame, '-vf', filtros.join(','), '-frames:v', '1', out]);
    escritos.push(out);
  }
  console.log(escritos.join('\n'));
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
