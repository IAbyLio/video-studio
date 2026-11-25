#!/usr/bin/env node
// analizar.mjs — de un bruto grabado a cámara saca: transcripción palabra a palabra (whisper-cli local, por bloques
// que empiezan y acaban en silencio), mapa de silencios (silencedetect con umbral automático) y la PROPUESTA de cortes:
// pausas largas, tomas repetidas (se queda la última completa), arranques en falso, repeticiones inmediatas y
// muletillas. Escribe `cortes.json` (editable) y `cortes.md` (para revisar antes de cortar). No corta nada.
//
// Uso:
//   node scripts/bruto/analizar.mjs <bruto.mp4|.mov|.wav> [--out <dir>] [--modelo large-v3|medium|small] (por defecto, el mejor que tengas)
//        [--fps 30] [--ruido -38] [--silencio-max 0.6] [--sin-prompt] [--muletillas "eh,mmm"] [--dudosas "bueno,o sea"]
//   node scripts/bruto/analizar.mjs --replanificar <dir>/cortes.json     (tras editar decisiones; sin re-transcribir)
//
// Salida en <dir> (por defecto <carpeta-del-bruto>/<nombre>-edicion/): cortes.json, cortes.md, analisis/ (caché).
import fs from 'node:fs';
import path from 'node:path';
import {
  PARAMS_DEFECTO, tramosDeVoz, bloquesTranscripcion, ajustarPalabrasASilencios, agruparFrases, detectarTomas,
  detectarRepeticionesInmediatas, detectarMuletillas, descartesDeSilencio, depurarDescartes, planificar, huellaPlan,
  detectarValles, anclarAValles, bordesDeVoz,
} from './lib.mjs';
import {
  probar, extraerWav, leerPcm16, envolvente, ruidoAutomatico, silencios as detectarSilencios, transcribirBloque,
  loudness, escribirJson, leerJson, argumentos, fmt, aDb, PROMPT_MULETILLAS, modeloPorDefecto,
} from './medios.mjs';

const A = argumentos(process.argv.slice(2));

const DOC = 'Cómo editar: (1) cambia "decision" de cada descarte a "cortar" o "conservar" — los "pendiente" OBLIGAN a decidir ' +
  'antes de cortar; (2) para cortar algo que la IA no vio, añade un descarte {"inicio":s,"fin":s,"motivo":"manual","decision":"cortar"} ' +
  '(segundos de la FUENTE); (3) corre `node scripts/bruto/analizar.mjs --replanificar <este cortes.json>` para regenerar "conservar". ' +
  'Si retocas "conservar" a mano, cortar.mjs pide --usar-conservar. Los tiempos van en segundos del bruto y se ajustan a la rejilla de fps. ' +
  '"correcciones": [{"de":"Clot","a":"Claude"}] arregla palabras mal transcritas en words.json (captions); no cambia los cortes.';

function fpsSalida(info, pedido) {
  if (pedido) return Number(pedido);
  const v = info.video;
  if (!v) return 30;
  // VFR de móvil: la media baja con poca luz (frames tirados), pero la cadencia de captura es la nominal (30/60).
  // Se normaliza a la cadencia estándar más cercana a la nominal; si la nominal es absurda (timebase), a la media.
  const base = v.vfr && !(v.fpsNominal >= 23 && v.fpsNominal <= 61) ? v.fpsMedio : v.fpsNominal;
  return [24, 25, 30, 50, 60].reduce((m, x) => (Math.abs(x - base) < Math.abs(m - base) ? x : m), 30);
}

function resumen(conservar, descartes, duracion) {
  const dur = conservar.reduce((s, x) => s + x.dur, 0);
  return {
    duracion_fuente: +duracion.toFixed(3), duracion_resultado: +dur.toFixed(3),
    recortado_s: +(duracion - dur).toFixed(3), recortado_pct: +(100 * (1 - dur / duracion)).toFixed(1),
    tramos: conservar.length, juntas: Math.max(0, conservar.length - 1),
    pendientes: descartes.filter((d) => d.decision === 'pendiente').length,
  };
}

function escribirMd(dir, c, palabras) {
  const r = c.resumen;
  const L = [];
  L.push(`# Cortes propuestos — ${path.basename(c.fuente)}`, '');
  L.push(`> Generado por \`scripts/bruto/analizar.mjs\`. **Revisar antes de cortar.** Editar \`cortes.json\` y, si cambian decisiones, \`--replanificar\`.`, '');
  L.push('| | |', '|---|---|');
  L.push(`| Duración del bruto | ${fmt(r.duracion_fuente)} |`, `| Duración tras cortar | **${fmt(r.duracion_resultado)}** |`);
  L.push(`| Recortado | ${fmt(r.recortado_s)} (${r.recortado_pct} %) |`, `| Tramos / juntas | ${r.tramos} / ${r.juntas} |`);
  L.push(`| fps de salida | ${c.fps}${c.info.vfr ? ' (bruto VFR: se normaliza a CFR)' : ''} |`);
  L.push(`| Umbral de silencio | ${c.info.ruidoDb} dBFS (${c.info.ruidoAuto ? 'automático' : 'manual'}) |`);
  L.push(`| Loudness del bruto | ${c.info.lufs ?? '—'} LUFS |`, `| **Pendientes de decidir** | **${r.pendientes}** |`, '');
  if (c.avisos.length) { L.push('## Avisos', ''); for (const a of c.avisos) L.push(`- ${a}`); L.push(''); }
  const pend = c.descartes.filter((d) => d.decision === 'pendiente');
  if (pend.length) {
    L.push('## Pendientes (decide el humano)', '', '| id | fuente | motivo | texto | por qué |', '|---|---|---|---|---|');
    for (const d of pend) L.push(`| ${d.id} | ${d.inicio.toFixed(2)}–${d.fin.toFixed(2)} | ${d.motivo} | ${d.texto || '—'} | ${d.detalle} |`);
    L.push('');
  }
  L.push('## Descartes que la IA corta sola', '', '| id | fuente | dur | motivo | texto | detalle |', '|---|---|---|---|---|---|');
  for (const d of c.descartes.filter((x) => x.decision === 'cortar')) {
    L.push(`| ${d.id} | ${d.inicio.toFixed(2)}–${d.fin.toFixed(2)} | ${(d.fin - d.inicio).toFixed(2)} | ${d.motivo} | ${d.texto || '—'} | ${d.detalle} |`);
  }
  const cons = c.descartes.filter((x) => x.decision === 'conservar');
  if (cons.length) {
    L.push('', '## Descartes revertidos (se conservan)', '');
    for (const d of cons) L.push(`- ${d.id} ${d.inicio.toFixed(2)}–${d.fin.toFixed(2)} ${d.motivo}: ${d.texto || '—'}`);
  }
  L.push('', '## Tramos que se conservan', '', '| id | fuente | dur | texto |', '|---|---|---|---|');
  for (const x of c.conservar) L.push(`| ${x.id} | ${x.inicio.toFixed(3)}–${x.fin.toFixed(3)} | ${x.dur.toFixed(2)} | ${x.texto || '(aire)'} |`);
  L.push('', '## Texto antes / después', '', '**Antes (bruto completo):**', '', '> ' + palabras.map((p) => p.w).join(' '), '');
  L.push('**Después (lo que queda):**', '', '> ' + c.conservar.map((x) => x.texto).filter(Boolean).join(' '), '');
  L.push('Siguiente paso: `node scripts/bruto/cortar.mjs ' + path.join(dir, 'cortes.json') + '`');
  fs.writeFileSync(path.join(dir, 'cortes.md'), L.join('\n') + '\n');
}

function plan(c, palabras, silencios, env) {
  const descartes = c.descartes;
  const conservar = planificar({ duracion: c.duracion_fuente, silencios, descartes, palabras, envolvente: env.valores, hop: env.hop, params: { ...c.parametros, fps: c.fps } });
  c.conservar = conservar;
  c.huella_plan = huellaPlan(descartes, { ...c.parametros, fps: c.fps });
  c.resumen = resumen(conservar, descartes, c.duracion_fuente);
  return c;
}

// ---------------------------------------------------------------- --replanificar
if (A.replanificar) {
  const ruta = path.resolve(typeof A.replanificar === 'string' ? A.replanificar : A._[0]);
  const dir = path.dirname(ruta);
  const c = leerJson(ruta);
  const palabras = leerJson(path.join(dir, 'analisis/palabras-fuente.json'));
  const silencios = leerJson(path.join(dir, 'analisis/silencios.json'));
  const env = envolvente(leerPcm16(path.join(dir, 'analisis/audio-16k.wav')));
  c.descartes = c.descartes.map((d, i) => ({ id: d.id || `m${String(i + 1).padStart(2, '0')}`, texto: '', detalle: d.detalle || 'añadido a mano', ...d }))
    .sort((a, b) => a.inicio - b.inicio);
  for (const d of c.descartes) if (!['cortar', 'conservar', 'pendiente'].includes(d.decision)) {
    console.error(`descarte ${d.id}: decision "${d.decision}" inválida (cortar | conservar | pendiente)`); process.exit(1);
  }
  plan(c, palabras, silencios, env);
  escribirJson(ruta, c);
  escribirMd(dir, c, palabras);
  console.log(`[analizar] re-planificado: ${fmt(c.resumen.duracion_fuente)} → ${fmt(c.resumen.duracion_resultado)} · ${c.resumen.tramos} tramos · pendientes ${c.resumen.pendientes}`);
  process.exit(0);
}

// ---------------------------------------------------------------- análisis completo
const entrada = A._[0] && path.resolve(A._[0]);
if (!entrada || !fs.existsSync(entrada)) {
  console.error('uso: analizar.mjs <bruto> [--out dir] [--modelo small] [--fps 30] [--ruido -38] [--silencio-max 0.6]\n     analizar.mjs --replanificar <cortes.json>');
  process.exit(1);
}
const dir = path.resolve(A.out || path.join(path.dirname(entrada), path.parse(entrada).name + '-edicion'));
const dAn = path.join(dir, 'analisis'), dTmp = path.join(dAn, 'bloques');
fs.mkdirSync(dTmp, { recursive: true });

const params = { ...PARAMS_DEFECTO };
if (A.silencioMax) params.silencioMax = Number(A.silencioMax);
if (A.muletillas) params.muletillasSeguras = String(A.muletillas).split(',').map((s) => s.trim()).filter(Boolean);
if (A.dudosas) params.muletillasDudosas = String(A.dudosas).split(',').map((s) => s.trim()).filter(Boolean);
const modelo = A.modelo || modeloPorDefecto();

const t0 = Date.now();
const info = probar(entrada);
if (!info.audio) { console.error('el bruto no tiene pista de audio: no hay nada que analizar'); process.exit(1); }
const fps = fpsSalida(info, A.fps);
const avisos = [];
if (info.video?.vfr) avisos.push(`El bruto es VFR (frame rate variable, típico de móvil; desviación ${info.video.desviacionFrame}). cortar.mjs lo normaliza a ${fps} fps CFR en la misma pasada.`);
if (info.video?.rotacion) avisos.push(`Rotación de ${info.video.rotacion}° en los metadatos: ffmpeg la aplica al decodificar; dimensiones visibles ${info.video.ancho}×${info.video.alto}.`);
console.log(`[analizar] ${path.basename(entrada)} · ${fmt(info.duracion)} · ${info.video ? `${info.video.ancho}×${info.video.alto} @ ${info.video.fpsNominal.toFixed(2)} fps${info.video.vfr ? ' VFR' : ''}` : 'solo audio'} → salida ${fps} fps`);

const wav = extraerWav(entrada, path.join(dAn, 'audio-16k.wav'));
const pcm = leerPcm16(wav);
const env = envolvente(pcm);
const ruidoAuto = A.ruido == null;
const ruidoDb = ruidoAuto ? ruidoAutomatico(env) : Number(A.ruido);
const sil = detectarSilencios(wav, { ruidoDb, minimo: params.silencioMinimo, duracion: info.duracion });
if (!sil.length && info.duracion > 8) avisos.push(`silencedetect no encontró silencios a ${ruidoDb} dB: room tone alto o música de fondo. Prueba --ruido con un valor más alto (p. ej. ${ruidoDb + 6}).`);
const loud = loudness(entrada);
if (loud.lufs != null && loud.lufs < -26) avisos.push(`El bruto está muy bajo (${loud.lufs} LUFS). No se normaliza aquí: el máster del canon de sonido lo lleva a −14 LUFS; si la voz se usa suelta, normalizarla.`);
console.log(`[analizar] silencios ≥ ${params.silencioMinimo}s a ${ruidoDb} dB: ${sil.length} · loudness ${loud.lufs} LUFS`);

const voz = tramosDeVoz(sil, info.duracion);
const bloques = bloquesTranscripcion(voz, { duracion: info.duracion });
let palabras = [];
const alucinados = [];
// Un whisper por tramo de voz (aislado: empieza y acaba en silencio) y después anclaje a la envolvente: los bordes
// del tramo y sus micro-valles (comas, respiraciones) fijan los tiempos reales; whisper solo reparte entre anclas.
// --reusar-transcripcion: reutiliza la salida cruda de whisper de los tramos que no cambiaron (re-detecta sin pagar).
const envDb = Float32Array.from(env.valores, aDb);
let reusados = 0;
bloques.forEach((b, i) => {
  const yaEstaba = A.reusarTranscripcion && fs.existsSync(path.join(dTmp, `b${String(i).padStart(3, '0')}.json`));
  const r = transcribirBloque(wav, b, { modelo, prompt: A.sinPrompt ? '' : PROMPT_MULETILLAS, dirTmp: dTmp, idx: i, reusar: !!A.reusarTranscripcion });
  if (yaEstaba) reusados++;
  if (r.alucinacion) alucinados.push({ ...b, texto: r.texto });
  const tramo = bordesDeVoz(envDb, env.hop, { ...(voz[i] || b), ruidoDb });   // sin la respiración de los bordes
  const valles = detectarValles(envDb, env.hop, { inicio: tramo.inicio, fin: tramo.fin, ruidoDb });
  palabras.push(...anclarAValles(r.palabras, valles, tramo));
  process.stdout.write(`\r[analizar] whisper ${modelo}: tramo ${i + 1}/${bloques.length}`);
});
process.stdout.write(reusados ? ` (salida de whisper reutilizada donde no cambió el tramo)\n` : '\n');
if (alucinados.length) avisos.push(`${alucinados.length} bloque(s) con texto típico de alucinación de whisper descartado(s): ${alucinados.map((x) => `${x.inicio.toFixed(1)} s "${x.texto}"`).join('; ')}.`);
palabras = ajustarPalabrasASilencios(palabras, sil).sort((a, b) => a.s - b.s);

const frases = agruparFrases(palabras, params);
let descartes = [
  ...descartesDeSilencio(sil, info.duracion, params),
  ...detectarTomas(frases, params),
  ...detectarRepeticionesInmediatas(palabras),
  ...detectarMuletillas(palabras, params),
];
descartes = depurarDescartes(descartes).sort((a, b) => a.inicio - b.inicio)
  .map(({ palabras: _p, frase: _f, ...d }, i) => ({ id: `d${String(i + 1).padStart(2, '0')}`, ...d, inicio: +d.inicio.toFixed(3), fin: +d.fin.toFixed(3) }));

escribirJson(path.join(dAn, 'palabras-fuente.json'), palabras);
escribirJson(path.join(dAn, 'silencios.json'), sil);
escribirJson(path.join(dAn, 'frases.json'), frases.map(({ palabras: _p, ...f }) => f));

const c = {
  _doc: DOC, version: 1, fuente: entrada, duracion_fuente: +info.duracion.toFixed(3), fps,
  info: { ...(info.video || {}), audio: info.audio, ruidoDb, ruidoAuto, lufs: loud.lufs, modelo, bloques: bloques.length },
  parametros: Object.fromEntries(Object.entries(params).filter(([k]) => !['ruidoDb'].includes(k))),
  avisos, huella_plan: null, resumen: null, correcciones: [], conservar: [], descartes,
};
plan(c, palabras, sil, env);
escribirJson(path.join(dir, 'cortes.json'), c);
escribirMd(dir, c, palabras);

const r = c.resumen;
console.log(`[analizar] ${palabras.length} palabras · ${frases.length} frases · ${descartes.length} descartes (${r.pendientes} pendientes)`);
for (const m of ['silencio', 'toma-repetida', 'arranque-en-falso', 'entre-tomas', 'repeticion-inmediata', 'muletilla']) {
  const n = descartes.filter((d) => d.motivo === m);
  if (n.length) console.log(`           ${m.padEnd(21)} ${String(n.length).padStart(3)}  (${n.reduce((s, d) => s + d.fin - d.inicio, 0).toFixed(2)} s)`);
}
console.log(`[analizar] ${fmt(r.duracion_fuente)} → ${fmt(r.duracion_resultado)} (−${r.recortado_pct} %) en ${r.tramos} tramos · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const a of avisos) console.log(`[aviso] ${a}`);
console.log(`[analizar] revisar: ${path.join(dir, 'cortes.md')}`);
