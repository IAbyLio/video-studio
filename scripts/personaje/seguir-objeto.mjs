#!/usr/bin/env node
// seguir-objeto.mjs — sigue un objeto de color reconocible entre fotogramas de un clip para que una cara montada
// con cara.js (Cara.mount → layout(forma)) se quede pegada a él cuando el vídeo se mueve (p. ej. al descongelar).
//
// Método: máscara de color dentro de una ventana que sigue a la elipse anterior → caja por percentiles (2–98 %) →
// centro y tamaño. Se usan las DIFERENCIAS respecto al primer fotograma (el sesgo de la máscara se cancela), se
// ajusta una parábola por parámetro (movimiento físico, sin temblor) y se aplica a la elipse medida a mano en el
// primer fotograma. El giro queda fijo (para giros grandes, medirlo aparte).
//
// Uso: node scripts/personaje/seguir-objeto.mjs <config.json>
// config = {
//   "video": "assets/clip.mp4", "ancho": 480, "alto": 854,            // tamaño REAL del vídeo fuente
//   "desde": 175, "hasta": 189,                                        // fotogramas fuente medidos (índice n de ffmpeg)
//   "elipse": { "cx": 282, "cy": 377, "rx": 123, "ry": 141, "rot": -8 }, // medida a mano en "desde" (px de la fuente)
//   "color": { "muestra": [60, 120, 40], "tolerancia": 60, "satMin": 0.2 },
//   "margen": 1.3, "iteraciones": 5,                                   // opcionales: ventana y re-medidas por fotograma
//   "salida": { "ancho": 1080, "alto": 1920, "fps": 30, "fpsFuente": 24, "tInicio": 7.3, "hastaExtrapolado": 191 },
//   "out": "assets/cara/seguimiento.json"
// }
// Salida: { fps, frames: [{ n, src, cx, cy, rx, ry, rot }] } en px de la composición (cada frame de salida usa el
// fotograma fuente más cercano: la cara no resbala sobre fotogramas duplicados).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cfgPath = process.argv[2];
if (!cfgPath) { console.error('uso: seguir-objeto.mjs <config.json>'); process.exit(1); }
const C = JSON.parse(fs.readFileSync(cfgPath, 'utf8')), base = path.dirname(path.resolve(cfgPath));
const W = C.ancho, H = C.alto, F0 = C.desde, F1 = C.hasta, N = F1 - F0 + 1, E0 = C.elipse;
const So = Object.assign({ ancho: W, alto: H, fps: 30, fpsFuente: 30, tInicio: F0 / (C.salida?.fpsFuente || 30), hastaExtrapolado: F1 }, C.salida);
const KX = So.ancho / W, KY = So.alto / H;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path.resolve(base, C.video), '-vf', `select='between(n,${F0},${F1})'`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
if (raw.length !== N * W * H * 3) throw new Error(`fotogramas leídos: ${raw.length / (W * H * 3)} (esperados ${N}); revisar ancho/alto/desde/hasta`);
const MARGEN = C.margen || 1.3, ITER = C.iteraciones || 5;   // ventana = elipse × MARGEN; re-medidas por fotograma
const [r0, g0, b0] = C.color.muestra, tol = C.color.tolerancia || 60, satMin = C.color.satMin ?? 0;
const esObjeto = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return Math.hypot(r - r0, g - g0, b - b0) < tol && (mx ? (mx - mn) / mx : 0) >= satMin; };
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];

function caja(n, win) {
  const off = n * W * H * 3, xs = [], ys = [], c = Math.cos(win.rot * Math.PI / 180), s = Math.sin(win.rot * Math.PI / 180);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - win.cx, dy = y - win.cy, u = (dx * c + dy * s) / (win.rx * MARGEN), v = (-dx * s + dy * c) / (win.ry * MARGEN);
    if (u * u + v * v > 1) continue;
    const i = off + (y * W + x) * 3; if (esObjeto(raw[i], raw[i + 1], raw[i + 2])) { xs.push(x); ys.push(y); }
  }
  if (xs.length < 20) throw new Error(`fotograma ${F0 + n}: casi no hay píxeles del color (${xs.length}); revisar color.muestra/tolerancia`);
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const x0 = pct(xs, 0.02), x1 = pct(xs, 0.98), y0 = pct(ys, 0.02), y1 = pct(ys, 0.98);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
let win = { ...E0 }; const meas = [];
for (let n = 0; n < N; n++) {
  let b = caja(n, win);
  // la ventana arranca en la elipse anterior; se re-centra y re-mide hasta que deja de moverse (objeto rápido)
  for (let it = 0; n && it < ITER; it++) {
    const k = Math.sqrt((b.w * b.h) / (meas[0].w * meas[0].h)), prev = b;
    win = { cx: E0.cx + b.cx - meas[0].cx, cy: E0.cy + b.cy - meas[0].cy, rx: E0.rx * k, ry: E0.ry * k, rot: E0.rot };
    b = caja(n, win);
    if (Math.hypot(b.cx - prev.cx, b.cy - prev.cy) < 0.25 && Math.abs(b.w - prev.w) < 0.5) break;
  }
  meas.push(b);
}
const m0 = meas[0], d = meas.map((b) => ({ dx: b.cx - m0.cx, dy: b.cy - m0.cy, k: Math.sqrt((b.w * b.h) / (m0.w * m0.h)) }));
function parabola(key, y0) {   // mínimos cuadrados que pasa por el primer fotograma: y = y0 + A·n + B·n²
  let s11 = 0, s12 = 0, s22 = 0, r1 = 0, r2 = 0;
  d.forEach((v, n) => { const a = n, b = n * n, y = v[key] - y0; s11 += a * a; s12 += a * b; s22 += b * b; r1 += a * y; r2 += b * y; });
  const det = s11 * s22 - s12 * s12; if (Math.abs(det) < 1e-9) return () => y0;
  const A = (r1 * s22 - r2 * s12) / det, B = (s11 * r2 - s12 * r1) / det;
  return (n) => y0 + A * n + B * n * n;
}
const fx = parabola('dx', 0), fy = parabola('dy', 0), fk = parabola('k', 1);
let peor = 0; d.forEach((v, n) => { peor = Math.max(peor, Math.abs(v.dx - fx(n)), Math.abs(v.dy - fy(n))); });
console.log(`residuo máx. del ajuste: ${peor.toFixed(2)} px de la fuente (×${KX.toFixed(2)} en pantalla)`);
const frames = [];
for (let n = 0; ; n++) {
  const src = Math.round((So.tInicio + n / So.fps) * So.fpsFuente); if (src > So.hastaExtrapolado) break;
  if (src < F0) continue;
  const j = src - F0, k = fk(j);
  frames.push({ n, src, cx: +((E0.cx + fx(j)) * KX).toFixed(1), cy: +((E0.cy + fy(j)) * KY).toFixed(1), rx: +(E0.rx * k * KX).toFixed(1), ry: +(E0.ry * k * KY).toFixed(1), rot: E0.rot });
}
const out = path.resolve(base, C.out || 'seguimiento.json');
fs.writeFileSync(out, JSON.stringify({ fps: So.fps, fuente: `${path.basename(C.video)} fotogramas ${F0}–${F1} (parábola${So.hastaExtrapolado > F1 ? `; hasta ${So.hastaExtrapolado} extrapolado` : ''})`, frames }, null, 1));
console.log(`${frames.length} frames → ${out}`);
