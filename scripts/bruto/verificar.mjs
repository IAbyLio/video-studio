#!/usr/bin/env node
// verificar.mjs — control de calidad del corte, con medidas y no a ojo:
//   1. Re-transcribe el clip cortado (whisper por bloques) y lo compara con el texto esperado (words.json): una junta
//      que se come una palabra la canta el transcript. Lista palabras perdidas/sobrantes y cuáles caen junto a una junta.
//   2. Clicks: en cada junta mide el salto muestra a muestra (|Δx| máx. en ±3 ms) contra el percentil 99 del clip entero.
//   3. Sincronía: en N palabras que arrancan tras una pausa compara el inicio de words.json con el arranque REAL de la
//      envolvente del audio cortado. Una deriva que crece con el tiempo = descuadre acumulado.
//   4. Vídeo y audio miden lo mismo (≤ 1 frame).
// Uso: node scripts/bruto/verificar.mjs <dir con cortes.json, clip-cortado.mp4, words.json> [--modelo large-v3] [--puntos 6]
// Escribe <dir>/verificacion.md y verificacion.json. Sale con código 4 si algo no pasa.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { normalizar, tramosDeVoz, bloquesTranscripcion, ajustarPalabrasASilencios, aplicarCorrecciones } from './lib.mjs';
import {
  probar, extraerWav, leerPcm16, envolvente, ruidoAutomatico, silencios as detectarSilencios, transcribirBloque,
  escribirJson, leerJson, argumentos, aDb, PROMPT_MULETILLAS, modeloPorDefecto,
} from './medios.mjs';

const A = argumentos(process.argv.slice(2));
const dir = path.resolve(A._[0] || '.');
const clip = path.join(dir, 'clip-cortado.mp4');
for (const f of [clip, path.join(dir, 'words.json'), path.join(dir, 'mapa-tiempos.json')]) {
  if (!fs.existsSync(f)) { console.error(`falta ${f} (corre antes cortar.mjs)`); process.exit(1); }
}
const words = leerJson(path.join(dir, 'words.json'));
const mapa = leerJson(path.join(dir, 'mapa-tiempos.json'));
const fps = mapa.fps;
const juntas = mapa.tramos.slice(1).map((t) => t.salida[0]);
const dV = path.join(dir, 'analisis', 'verificacion');
fs.mkdirSync(path.join(dV, 'bloques'), { recursive: true });

// ---------------------------------------------------------------- 1. re-transcripción
const wav16 = extraerWav(clip, path.join(dV, 'clip-16k.wav'));
const env = envolvente(leerPcm16(wav16));
const ruido = ruidoAutomatico(env);
const info = probar(clip);
const sil = detectarSilencios(wav16, { ruidoDb: ruido, minimo: 0.2, duracion: info.duracion });
const bloques = bloquesTranscripcion(tramosDeVoz(sil, info.duracion), { duracion: info.duracion });
let obtenidas = [];
bloques.forEach((b, i) => {
  const r = transcribirBloque(wav16, b, { modelo: A.modelo || modeloPorDefecto(), prompt: PROMPT_MULETILLAS, dirTmp: path.join(dV, 'bloques'), idx: i });
  obtenidas.push(...r.palabras);
});
obtenidas = ajustarPalabrasASilencios(obtenidas, sil);
const esp = words.palabras.map((w) => ({ ...w, n: normalizar(w.texto) })).filter((w) => w.n);
// las correcciones de cortes.json (nombres propios mal oídos) se aplican también a lo re-transcrito: se compara texto con texto
const fCortes = path.join(dir, 'cortes.json');
const correcciones = fs.existsSync(fCortes) ? (leerJson(fCortes).correcciones || []) : [];
const obt = aplicarCorrecciones(obtenidas.map((w) => ({ texto: w.w, inicio: w.s })), correcciones)
  .map((w) => ({ ...w, n: normalizar(w.texto) })).filter((w) => w.n);
// alineación LCS para sacar perdidas y sobrantes
const m = esp.length, n = obt.length;
const L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = esp[i].n === obt[j].n ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
const perdidas = [], sobrantes = [];
for (let i = 0, j = 0; i < m || j < n;) {
  if (i < m && j < n && esp[i].n === obt[j].n) { i++; j++; }
  else if (j < n && (i >= m || L[i][j + 1] >= L[i + 1][j])) { sobrantes.push(obt[j]); j++; }
  else { perdidas.push(esp[i]); i++; }
}
const cerca = (t) => juntas.some((J) => Math.abs(J - t) < 0.5);
const coincidencia = m ? L[0][0] / m : 1;

// ---------------------------------------------------------------- 2. clicks en las juntas (sobre la voz a 48 kHz)
const fVoz = path.join(dir, 'voz-cortada.wav');
const voz = leerPcm16(fs.existsSync(fVoz) ? fVoz : extraerWav(clip, path.join(dV, 'clip-48k.wav'), { sr: 48000 }));
const dif = new Float32Array(voz.muestras.length - 1);
for (let i = 1; i < voz.muestras.length; i++) dif[i - 1] = Math.abs(voz.muestras[i] - voz.muestras[i - 1]) / 32768;
const p99 = Float32Array.from(dif).sort()[Math.floor(dif.length * 0.99)] || 1e-6;
const clicks = juntas.map((J) => {
  const c = Math.round(J * voz.sr), w = Math.round(0.003 * voz.sr);
  let mx = 0;
  for (let i = Math.max(0, c - w); i < Math.min(dif.length, c + w); i++) mx = Math.max(mx, dif[i]);
  return { t: J, saltoMax: +mx.toFixed(5), ratioP99: +(mx / p99).toFixed(2), click: mx > p99 * 1.5 };
});

// ---------------------------------------------------------------- 3. sincronía palabra ↔ envolvente
const umbral = Math.pow(10, (ruido + 6) / 20);
function arranqueReal(t) {
  const h = env.hop, i0 = Math.max(0, Math.floor((t - 0.3) / h)), i1 = Math.min(env.valores.length - 1, Math.ceil((t + 0.3) / h));
  let mejor = null;
  for (let i = i0; i <= i1; i++) {
    if (env.valores[i] < umbral) continue;
    let ok = true;                                            // tiene que sostenerse 30 ms y venir de silencio (40 ms)
    for (let k = 1; k <= 6 && i + k < env.valores.length; k++) if (env.valores[i + k] < umbral) { ok = false; break; }
    for (let k = 1; k <= 8 && i - k >= 0; k++) if (env.valores[i - k] >= umbral) { ok = false; break; }
    if (ok && (mejor === null || Math.abs(i * h - t) < Math.abs(mejor - t))) mejor = i * h;
  }
  return mejor;
}
// Puntos de medida: arranques REALES tras un silencio medido en el clip (no huecos entre palabras de whisper, que pueden
// ser artefactos). Para cada uno, la primera palabra de words.json que empieza después de ese silencio.
const arranques = [{ fin: 0, inicio: 0 }, ...sil.filter((z) => z.fin < info.duracion - 0.2)].map((z) => {
  const w = words.palabras.find((p) => p.inicio >= z.inicio + 0.02);
  const real = w ? arranqueReal(z.fin > 0 ? z.fin : w.inicio) : null;
  return w && real != null ? { palabra: w.texto, esperado: w.inicio, real: +real.toFixed(3), delta: +(w.inicio - real).toFixed(3) } : null;
}).filter(Boolean);
const N = Number(A.puntos || 6);
const sync = arranques.length <= N ? arranques : Array.from({ length: N }, (_, k) => arranques[Math.round(k * (arranques.length - 1) / (N - 1))]);
const deltas = sync.filter((s) => s.delta != null);
const derivaFinal = deltas.length >= 2 ? +(deltas[deltas.length - 1].delta - deltas[0].delta).toFixed(3) : 0;

// ---------------------------------------------------------------- 4. vídeo vs audio
const st = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-count_frames', '-show_entries', 'stream=codec_type,nb_read_frames,duration', clip], { encoding: 'utf8' })).streams;
const durV = Number(st.find((s) => s.codec_type === 'video').nb_read_frames) / fps;
const durA = parseFloat(st.find((s) => s.codec_type === 'audio')?.duration ?? durV);
const av = +(durA - durV).toFixed(3);

// ---------------------------------------------------------------- veredicto
const fallos = [];
if (coincidencia < 0.9) fallos.push(`texto: solo ${(coincidencia * 100).toFixed(1)} % de las palabras esperadas aparecen`);
const perdidasJunta = perdidas.filter((p) => cerca(p.inicio));
if (perdidasJunta.length) fallos.push(`${perdidasJunta.length} palabra(s) perdida(s) junto a una junta: ${perdidasJunta.map((p) => `"${p.texto}" @${p.inicio.toFixed(2)}`).join(', ')}`);
const nClicks = clicks.filter((c) => c.click).length;
if (nClicks) fallos.push(`${nClicks} junta(s) con click (salto > 1,5 × p99)`);
if (deltas.some((s) => Math.abs(s.delta) > 0.12)) fallos.push('alguna palabra se desvía > 120 ms de su arranque real');
if (Math.abs(derivaFinal) > 0.08) fallos.push(`deriva acumulada ${derivaFinal} s entre el primer y el último punto`);
if (Math.abs(av) > 1 / fps + 0.03) fallos.push(`vídeo y audio no miden lo mismo (audio − vídeo = ${av} s)`);

const res = { clip, duracion: info.duracion, coincidencia: +coincidencia.toFixed(3), perdidas, sobrantes, clicks, p99: +p99.toFixed(5), sync, derivaFinal, audioMenosVideo: av, ruidoDb: ruido, fallos, pasa: !fallos.length };
escribirJson(path.join(dir, 'verificacion.json'), res);
const md = [
  `# Verificación del corte — ${path.basename(clip)}`, '',
  `**${res.pasa ? 'PASA' : 'NO PASA'}** · duración ${info.duracion.toFixed(3)} s · ${juntas.length} juntas · audio − vídeo ${av} s`, '',
  `## Texto (re-transcripción del clip cortado)`, '', `Coincidencia con lo esperado: **${(coincidencia * 100).toFixed(1)} %**`, '',
  `- Perdidas: ${perdidas.map((p) => `"${p.texto}" @${p.inicio.toFixed(2)}${cerca(p.inicio) ? ' (junta)' : ''}`).join(', ') || 'ninguna'}`,
  `- Sobrantes: ${sobrantes.map((p) => `"${p.texto}" @${p.inicio.toFixed(2)}`).join(', ') || 'ninguna'}`, '',
  '> Lo obtenido: ' + obtenidas.map((w) => w.w).join(' '), '',
  `## Clicks en juntas (umbral 1,5 × p99 = ${(p99 * 1.5).toFixed(4)})`, '', '| junta (s) | salto máx | × p99 | click |', '|---|---|---|---|',
  ...clicks.map((c) => `| ${c.t.toFixed(3)} | ${c.saltoMax} | ${c.ratioP99} | ${c.click ? 'SÍ' : 'no'} |`), '',
  `## Sincronía palabra ↔ envolvente (umbral ${(aDb(umbral)).toFixed(0)} dBFS)`, '', '| palabra | esperado | arranque real | Δ (s) |', '|---|---|---|---|',
  ...sync.map((s) => `| ${s.palabra} | ${s.esperado.toFixed(3)} | ${s.real ?? '—'} | ${s.delta ?? '—'} |`), '',
  `Puntos medidos: ${sync.length} de ${arranques.length} arranques tras silencio.`, '',
  `Deriva entre el primer y el último punto: ${derivaFinal} s`, '',
  ...(fallos.length ? ['## Fallos', '', ...fallos.map((f) => `- ${f}`)] : []),
];
fs.writeFileSync(path.join(dir, 'verificacion.md'), md.join('\n') + '\n');
console.log(`[verificar] ${res.pasa ? 'PASA' : 'NO PASA'} · texto ${(coincidencia * 100).toFixed(1)} % · clicks ${nClicks}/${juntas.length} · Δ sync máx ${Math.max(0, ...deltas.map((s) => Math.abs(s.delta))).toFixed(3)} s · deriva ${derivaFinal} s · A−V ${av} s`);
for (const f of fallos) console.log(`[fallo] ${f}`);
if (!res.pasa) process.exit(4);
