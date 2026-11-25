import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseWav, rmsDb, puertaSilencio, cuesEnvolvente, limpiarGuion } from '../personaje/build-mouth-data.mjs';

const require = createRequire(import.meta.url);
const Cara = require('../personaje/cara.js');

// audio sintético: 0–0,5 s tono fuerte, 0,5–0,8 s silencio digital, 0,8–1,2 s tono suave
function audioSintetico(sr = 16000) {
  const s = new Int16Array(Math.round(1.2 * sr));
  for (let i = 0; i < s.length; i++) {
    const t = i / sr;
    s[i] = t < 0.5 ? Math.round(20000 * Math.sin(2 * Math.PI * 200 * t)) : t < 0.8 ? 0 : Math.round(5000 * Math.sin(2 * Math.PI * 200 * t));
  }
  return { sr, samples: s };
}
function wavBuffer({ sr, samples }) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVEfmt ', 8, 'latin1');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36, 'latin1'); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(v, 44 + i * 2));
  return b;
}

test('parseWav lee PCM16 mono y rmsDb distingue voz de silencio', () => {
  const a = parseWav(wavBuffer(audioSintetico()));
  assert.equal(a.sr, 16000);
  assert.equal(a.samples.length, 19200);
  assert.ok(rmsDb(a, 0.1, 0.2) > -10);
  assert.ok(Math.abs(rmsDb(a, 0.55, 0.75) - 20 * Math.log10(1 / 32768)) < 1e-9);   // piso: 1/32768 en dB
});

test('puerta de silencio: una boca abierta sobre silencio ≥ 0,10 s pasa a X; A y X no se tocan', () => {
  const a = audioSintetico();
  const { cues, tramos } = puertaSilencio([
    { start: 0, end: 0.4, value: 'C' },
    { start: 0.4, end: 0.9, value: 'D' },     // 0,4–0,5 voz, 0,5–0,8 silencio, 0,8–0,9 voz
    { start: 0.9, end: 1.0, value: 'A' },
    { start: 1.0, end: 1.2, value: 'X' },
  ], a);
  assert.deepEqual(tramos, [['D', 0.5, 0.8]]);
  assert.deepEqual(cues, [[0, 'C'], [0.4, 'D'], [0.5, 'X'], [0.8, 'D'], [0.9, 'A'], [1.0, 'X']]);
});

test('envolvente: silencio → A, tono fuerte → apertura alta, sin destellos de un paso', () => {
  const cues = cuesEnvolvente(audioSintetico(), 30);
  assert.equal(cues[0][0], 0);
  assert.notEqual(cues[0][1], 'A');
  const enSilencio = cues.filter(([t]) => t > 0.52 && t < 0.78);
  assert.ok(cues.some(([t, v]) => t >= 0.49 && t <= 0.54 && v === 'A'), JSON.stringify(cues));
  assert.equal(enSilencio.length, 0, 'sin cambios dentro del silencio');
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i][0] - cues[i - 1][0] > 1 / 30 + 1e-6 || cues[i][1] !== cues[i - 1][1]);
});

test('limpiarGuion quita audio tags y break', () => {
  assert.equal(limpiarGuion('[cheeky] Hola, ¿qué tal?\n[pause] Bien. <break time="1s" /> Fin.'), 'Hola, ¿qué tal?\nBien. Fin.\n');
});

test('cara.js: determinista, 9 visemas, cue y parpadeo sembrado', () => {
  const cues = [[0, 'X'], [0.5, 'D'], [1, 'G']];
  const a = Cara.crear({ cues, semilla: 3 }), b = Cara.crear({ cues, semilla: 3 });
  assert.equal(a.stateAt(0.7).mouth, 'D');
  assert.equal(a.stateAt(1.2).mouth, 'G');
  assert.equal(a.stateAt(0.2).mouth, 'X');
  assert.equal(a.svgEn(0.7).replace(/cara\d+-/g, ''), b.svgEn(0.7).replace(/cara\d+-/g, ''));
  assert.notEqual(a.svgEn(0.7), a.svgEn(1.2));
  assert.deepEqual(Object.keys(Cara.SHAPES).sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X']);
  let parpadea = false; for (let t = 0; t < 8; t += 0.01) if (a.stateAt(t).blink > 0.9) parpadea = true;
  assert.ok(parpadea);
  assert.throws(() => Cara.crear({ pista: [[0, 'inexistente']] }).stateAt(0), /expresión desconocida/);
});
