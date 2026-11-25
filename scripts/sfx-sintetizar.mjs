#!/usr/bin/env node
// sfx-sintetizar.mjs — fabrica la mini-librería de efectos de sonido del repo SOLO CON CÓDIGO (sin samples ajenos,
// sin cuentas, sin red): ruido y osciladores filtrados, con semilla fija. Mismo comando = mismos bytes.
// Los WAV resultantes son parte del repo (licencia MIT, como el resto). Para sumar efectos propios ver
// modulos/sonido/README.md.
//
// CLI: node scripts/sfx-sintetizar.mjs [--out modulos/sonido/sfx] [--solo whoosh,pop]
// Escribe <out>/<id>.wav (44,1 kHz, mono, 16 bit) y actualiza <out>/sfx-manifest.json midiendo el arranque real
// de cada archivo con ffmpeg (sfx-measure.mjs).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureTransientOffset } from './sfx-measure.mjs';
import { upsertEntry, validateManifest, MANIFEST_DEFECTO } from './sfx-manifest.mjs';

export const SR = 44100;

export function prng(semilla) {   // mulberry32
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Filtro paso banda RBJ (biquad) con frecuencia que puede cambiar muestra a muestra.
function pasoBanda(x, freqAt, q) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < x.length; n++) {
    const w0 = 2 * Math.PI * Math.min(freqAt(n / SR), SR * 0.45) / SR, al = Math.sin(w0) / (2 * q), c = Math.cos(w0);
    const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    const v = (b0 * x[n] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[n]; y2 = y1; y1 = v; y[n] = v;
  }
  return y;
}
function pasoBajo(x, f) {   // un polo, suave
  const y = new Float32Array(x.length), k = Math.exp(-2 * Math.PI * f / SR);
  let p = 0; for (let n = 0; n < x.length; n++) { p = (1 - k) * x[n] + k * p; y[n] = p; }
  return y;
}
const ruido = (n, azar) => Float32Array.from({ length: n }, () => azar() * 2 - 1);
const lerp = (a, b, u) => a + (b - a) * u;
const env = (t, ataque, caida) => (t < ataque ? t / ataque : Math.exp(-(t - ataque) / caida));

function normalizar(x, pico = 0.7) {
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
  const k = m > 0 ? pico / m : 1;
  return x.map((v) => v * k);
}
function conSilencioPrevio(x, seg) { const pre = new Float32Array(Math.round(seg * SR)); const out = new Float32Array(pre.length + x.length); out.set(x, pre.length); return out; }
function fundidoFinal(x, seg = 0.01) { const n = Math.round(seg * SR); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }

/** Cada receta devuelve muestras float en [-1, 1]. Todas deterministas. */
export const RECETAS = {
  whoosh: { category: 'transition', volume: 0.35, use_for: ['cambio de escena', 'entrada de tarjeta grande'], gen() {
    const d = 0.62, n = Math.round(d * SR), azar = prng(11);
    const f = (t) => { const u = t / d; return u < 0.55 ? lerp(320, 2600, u / 0.55) : lerp(2600, 700, (u - 0.55) / 0.45); };
    const y = pasoBanda(ruido(n, azar), f, 1.4);
    return y.map((v, i) => { const u = i / n; return v * Math.sin(Math.PI * Math.pow(u, 0.8)); });
  } },
  swipe: { category: 'transition', volume: 0.3, use_for: ['deslizar un panel', 'cambio dentro de una tarjeta'], gen() {
    const d = 0.28, n = Math.round(d * SR), azar = prng(23);
    const y = pasoBanda(ruido(n, azar), (t) => lerp(1800, 5200, t / d), 2.2);
    return y.map((v, i) => v * Math.sin(Math.PI * i / n));
  } },
  click: { category: 'ui', volume: 0.4, use_for: ['clic en un botón', 'marcar una casilla'], gen() {
    const d = 0.06, n = Math.round(d * SR), azar = prng(37);
    const nz = pasoBanda(ruido(n, azar), () => 3800, 3);
    return Float32Array.from({ length: n }, (_, i) => { const t = i / SR; return (0.6 * nz[i] + 0.5 * Math.sin(2 * Math.PI * 2400 * t)) * Math.exp(-t / 0.006); });
  } },
  pop: { category: 'reveal', volume: 0.35, use_for: ['aparece un elemento chico', 'badge o etiqueta'], gen() {
    const d = 0.18, n = Math.round(d * SR); let fase = 0;
    return Float32Array.from({ length: n }, (_, i) => { const t = i / SR; fase += 2 * Math.PI * lerp(950, 280, Math.min(1, t / 0.09)) / SR; return Math.sin(fase) * env(t, 0.003, 0.035); });
  } },
  tick: { category: 'ui', volume: 0.3, use_for: ['contador que sube', 'paso de una lista'], gen() {
    const d = 0.045, n = Math.round(d * SR);
    return Float32Array.from({ length: n }, (_, i) => { const t = i / SR; return (Math.sin(2 * Math.PI * 2100 * t) + 0.4 * Math.sin(2 * Math.PI * 4300 * t)) * Math.exp(-t / 0.008); });
  } },
  riser: { category: 'riser', volume: 0.3, use_for: ['tensión antes de un golpe (el pico está al final)'], gen() {
    const d = 1.5, n = Math.round(d * SR), azar = prng(41);
    const nz = pasoBanda(ruido(n, azar), (t) => lerp(400, 6000, Math.pow(t / d, 2)), 1.2); let fase = 0;
    return Float32Array.from({ length: n }, (_, i) => {
      const t = i / SR, u = t / d; fase += 2 * Math.PI * lerp(180, 1100, u * u) / SR;
      const saw = ((fase / (2 * Math.PI)) % 1) * 2 - 1;
      return (0.55 * nz[i] + 0.35 * saw) * Math.pow(u, 2.2) * (u > 0.985 ? (1 - u) / 0.015 : 1);
    });
  } },
  'impacto-suave': { category: 'impact', volume: 0.45, use_for: ['palabra clave', 'golpe de cámara', 'sello'], gen() {
    const d = 0.9, n = Math.round(d * SR), azar = prng(53); let fase = 0;
    const nz = pasoBajo(ruido(n, azar), 900);
    return Float32Array.from({ length: n }, (_, i) => {
      const t = i / SR; fase += 2 * Math.PI * lerp(95, 42, Math.min(1, t / 0.25)) / SR;
      return Math.sin(fase) * env(t, 0.004, 0.22) + 1.2 * nz[i] * env(t, 0.002, 0.03);
    });
  } },
  tecleo: { category: 'ui', volume: 0.3, use_for: ['texto que se escribe letra a letra'], gen() {
    const d = 0.9, n = Math.round(d * SR), azar = prng(67), out = new Float32Array(n);
    let t0 = 0.0;
    while (t0 < d - 0.05) {
      const i0 = Math.round(t0 * SR), f = lerp(2600, 4200, azar()), amp = lerp(0.5, 1, azar());
      for (let k = 0; k < Math.round(0.03 * SR) && i0 + k < n; k++) {
        const t = k / SR; out[i0 + k] += amp * ((azar() * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * f * t) * 0.5) * Math.exp(-t / 0.005);
      }
      t0 += lerp(0.06, 0.13, azar());
    }
    return pasoBanda(out, () => 3000, 0.7);
  } },
};

/** WAV PCM16 mono. */
export function wavPcm16(muestras, sr = SR) {
  const b = Buffer.alloc(44 + muestras.length * 2);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(36 + muestras.length * 2, 4); b.write('WAVEfmt ', 8, 'latin1');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36, 'latin1'); b.writeUInt32LE(muestras.length * 2, 40);
  muestras.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return b;
}

export function sintetizar(id) {
  const r = RECETAS[id];
  if (!r) throw new Error(`receta desconocida: ${id} (hay: ${Object.keys(RECETAS).join(', ')})`);
  return wavPcm16(fundidoFinal(conSilencioPrevio(normalizar(r.gen()), 0.02)));
}

function main(argv) {
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const out = resolve(get('--out') || dirname(MANIFEST_DEFECTO));
  const ids = get('--solo') ? get('--solo').split(',') : Object.keys(RECETAS);
  mkdirSync(out, { recursive: true });
  const mPath = join(out, 'sfx-manifest.json');
  const manifest = existsSync(mPath) ? JSON.parse(readFileSync(mPath, 'utf8')) : { version: 1, samples: {} };
  manifest._doc = manifest._doc || 'Ficha de cada efecto. transient_offset = segundos de silencio antes del sonido: data-start = evento − transient_offset (en el riser, el pico está al final: data-start = evento − duration). La validan scripts/sfx-manifest.mjs y los tests.';
  for (const id of ids) {
    const file = join(out, `${id}.wav`);
    const buf = sintetizar(id);
    writeFileSync(file, buf);
    const r = RECETAS[id];
    upsertEntry(manifest, id, {
      file: `${id}.wav`, duration: +((buf.length - 44) / 2 / SR).toFixed(3), transient_offset: measureTransientOffset(file),
      category: r.category, default_volume: r.volume, use_for: r.use_for,
      license: 'MIT (sintetizado por código en este repo)', source: 'scripts/sfx-sintetizar.mjs',
    });
    console.log(`${id.padEnd(14)} → ${file}`);
  }
  const errs = validateManifest(manifest);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  writeFileSync(mPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest: ${mPath} (${Object.keys(manifest.samples).length} efectos)`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
