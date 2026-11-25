import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAMS_DEFECTO, normalizar, parsearSilencedetect, tramosDeVoz, bloquesTranscripcion, tokensAPalabras, esAlucinacion,
  ajustarPalabrasASilencios, detectarValles, bordesDeVoz, anclarAValles, agruparFrases, detectarTomas,
  detectarRepeticionesInmediatas, detectarMuletillas, descartesDeSilencio, depurarDescartes, planificar, huellaPlan,
  validarConservar, filtroCorte, mapaTiempos, fuenteASalida, retemporizarPalabras, aTranscriptWhisper, aplicarCorrecciones,
  ajustarAFrame, ventanaRecorte, intervalosZoom, parsearZoomsManuales, cambiosDeFrase, expresionSeguimiento,
  suavizarTrayectoria, caraEnSalida, caraEnZonaSegura,
} from '../bruto/lib.mjs';

// palabras {w,s,e} a partir de "texto@s-e texto@s-e"
const P = (spec) => spec.trim().split(/\s+/).map((t) => { const [w, r] = t.split('@'); const [s, e] = r.split('-').map(Number); return { w, s, e }; });
const fr = (spec, pausa) => agruparFrases(P(spec), { pausaFrase: pausa ?? PARAMS_DEFECTO.pausaFrase });

// ---------------------------------------------------------------- silencios y tramos
test('parsearSilencedetect: pares start/end y silencio abierto hasta el final', () => {
  const err = '[silencedetect @ 0x1] silence_start: 0\n[silencedetect @ 0x1] silence_end: 1.2 | silence_duration: 1.2\n' +
    'silence_start: 3.5\nsilence_end: 4.75 | silence_duration: 1.25\nsilence_start: 9.1\n';
  assert.deepEqual(parsearSilencedetect(err, 10), [
    { inicio: 0, fin: 1.2, dur: 1.2 }, { inicio: 3.5, fin: 4.75, dur: 1.25 }, { inicio: 9.1, fin: 10, dur: 0.9 }]);
});

test('tramosDeVoz es el complemento de los silencios', () => {
  assert.deepEqual(tramosDeVoz([{ inicio: 0, fin: 1 }, { inicio: 3, fin: 4 }], 6), [{ inicio: 1, fin: 3 }, { inicio: 4, fin: 6 }]);
});

test('bloquesTranscripcion: por defecto un bloque por tramo (con margen), unirSi agrupa', () => {
  const t = [{ inicio: 1, fin: 2 }, { inicio: 2.3, fin: 3 }];
  assert.deepEqual(bloquesTranscripcion(t, { duracion: 10 }), [{ inicio: 0.88, fin: 2.12 }, { inicio: 2.18, fin: 3.12 }]);
  assert.equal(bloquesTranscripcion(t, { unirSi: 0.6, duracion: 10 }).length, 1);
});

// ---------------------------------------------------------------- whisper → palabras
test('tokensAPalabras une tokens BPE, pega la puntuación y salta los especiales', () => {
  const tr = [{ tokens: [
    { text: '[_BEG_]', offsets: { from: 0, to: 0 } }, { text: ' ab', offsets: { from: 100, to: 200 } },
    { text: 'eja', offsets: { from: 200, to: 300 } }, { text: ',', offsets: { from: 300, to: 320 } },
    { text: ' vuela', offsets: { from: 400, to: 700 } }, { text: '[_TT_50]', offsets: { from: 700, to: 700 } }] }];
  assert.deepEqual(tokensAPalabras(tr, 10), [{ w: 'abeja,', s: 10.1, e: 10.32 }, { w: 'vuela', s: 10.4, e: 10.7 }]);
});

test('esAlucinacion reconoce las frases fantasma típicas', () => {
  assert.ok(esAlucinacion('Subtítulos realizados por la comunidad de Amara.org'));
  assert.ok(!esAlucinacion('Gracias por ver mi tutorial de edición'));
  assert.ok(esAlucinacion('Subtitulado'));
  assert.ok(esAlucinacion('Subtitulado por Jnkoil'));
  assert.ok(!esAlucinacion('Subtitulado por mí y por mi equipo durante toda la semana pasada, sin parar'));
});

test('ajustarPalabrasASilencios: ninguna palabra empieza ni acaba dentro de un silencio', () => {
  const out = ajustarPalabrasASilencios(P('hola@1.0-2.4 mundo@2.4-3.0'), [{ inicio: 1.6, fin: 2.6 }]);
  assert.deepEqual(out.map((p) => [p.s, p.e]), [[1, 1.6], [2.6, 3]]);
});

// ---------------------------------------------------------------- anclaje a la envolvente
function envSintetica(dur, voz, { hop = 0.005, habla = -20, fondo = -60, brisa = [] } = {}) {
  const n = Math.round(dur / hop), e = new Float32Array(n).fill(fondo);
  for (const [a, b] of voz) for (let i = Math.round(a / hop); i < Math.round(b / hop); i++) e[i] = habla;
  for (const [a, b] of brisa) for (let i = Math.round(a / hop); i < Math.round(b / hop); i++) e[i] = -48;   // respiración
  return e;
}

test('detectarValles encuentra las pausas de coma dentro de un tramo y descarta los bordes', () => {
  const env = envSintetica(3, [[0.2, 1.0], [1.2, 2.0], [2.15, 2.8]]);
  assert.deepEqual(detectarValles(env, 0.005, { inicio: 0.2, fin: 2.8, ruidoDb: -50 }), [{ inicio: 1, fin: 1.2 }, { inicio: 2, fin: 2.15 }]);
});

test('bordesDeVoz recorta la respiración que silencedetect contó como voz', () => {
  const env = envSintetica(3, [[0.6, 2.4]], { brisa: [[0.3, 0.6]] });
  assert.deepEqual(bordesDeVoz(env, 0.005, { inicio: 0.3, fin: 2.4, ruidoDb: -55 }), { inicio: 0.6, fin: 2.4 });
});

test('anclarAValles (caso real medido): la pausa de la coma gana al micro-valle de una oclusiva', () => {
  // whisper (tramo aislado) + valles reales del bruto de prueba 1: "que, | o sea, | no tienes"
  const ws = P('Lo@17.89-17.91 mejor@17.91-18.26 es@18.26-18.40 que,@18.40-18.68 o@18.82-18.82 sea,@18.88-19.21 ' +
    'no@19.21-19.28 tienes@19.49-19.65 que@19.71-19.84 tocar@19.84-20.13 nada@20.13-20.36 a@20.36-20.41 mano.@20.41-20.87');
  const valles = [{ inicio: 18.48, fin: 18.54 }, { inicio: 18.685, fin: 18.88 }, { inicio: 19.29, fin: 19.485 }, { inicio: 19.95, fin: 20.005 }];
  const out = anclarAValles(ws, valles, { inicio: 17.891, fin: 20.961 });
  const w = (t) => out.find((x) => x.w === t);
  assert.equal(w('que,').e, 18.685);
  assert.equal(w('o').s, 18.88);
  assert.equal(w('sea,').e, 19.29);
  assert.equal(w('no').s, 19.485);
  assert.equal(out[0].s, 17.891);
  assert.equal(out[out.length - 1].e, 20.961);
});

// ---------------------------------------------------------------- tomas, repeticiones, muletillas
test('toma repetida: se descarta la primera y se conserva la última completa', () => {
  const f = fr('El@1-1.2 primer@1.2-1.5 paso@1.5-1.8 es@1.8-1.9 grabar@1.9-2.3 sin@2.3-2.5 miedo.@2.5-3 ' +
    'El@4-4.2 primer@4.2-4.5 paso@4.5-4.8 es@4.8-4.9 grabar@4.9-5.3 sin@5.3-5.5 miedo.@5.5-6');
  const d = detectarTomas(f);
  assert.equal(d.length, 1);
  assert.equal(d[0].motivo, 'toma-repetida');
  assert.equal(d[0].inicio, 1);
  assert.equal(d[0].decision, 'cortar');
});

test('arranque en falso: frase corta que es el principio de la siguiente', () => {
  const d = detectarTomas(fr('Después,@1-1.4 Claude.@1.4-2 Después,@3-3.4 Claude@3.4-3.8 escucha@3.8-4.3 la@4.3-4.4 grabación.@4.4-5'));
  assert.equal(d.length, 1);
  assert.equal(d[0].motivo, 'arranque-en-falso');
  assert.equal(d[0].fin, 2);
});

test('si la última toma se corta, se queda la última COMPLETA', () => {
  const d = detectarTomas(fr('Hoy@1-1.2 te@1.2-1.3 cuento@1.3-1.6 cómo@1.6-1.8 edito@1.8-2.1 vídeos.@2.1-2.6 ' +
    'Hoy@4-4.2 te@4.2-4.3 cuento@4.3-4.6.'));
  assert.equal(d.length, 1);
  assert.equal(d[0].inicio, 4, 'se descarta el intento truncado del final');
});

test('frases distintas no se marcan como tomas', () => {
  assert.deepEqual(detectarTomas(fr('Grabo@1-1.4 sin@1.4-1.6 guion.@1.6-2 Después@3-3.4 corto@3.4-3.8 los@3.8-3.9 silencios.@3.9-4.5')), []);
});

test('lo que queda entre dos tomas se marca pendiente (entre-tomas)', () => {
  const d = detectarTomas(fr('Vamos@1-1.3 a@1.3-1.4 ver@1.4-1.6 el@1.6-1.7 tablero.@1.7-2.2 Perdón.@3-3.5 ' +
    'Vamos@4.5-4.8 a@4.8-4.9 ver@4.9-5.1 el@5.1-5.2 tablero.@5.2-5.7'));
  assert.deepEqual(d.map((x) => [x.motivo, x.decision]), [['toma-repetida', 'cortar'], ['entre-tomas', 'pendiente']]);
});

test('repetición inmediata: n ≥ 2 se corta sola, n = 1 queda pendiente', () => {
  const d = detectarRepeticionesInmediatas(P('vamos@1-1.2 a@1.2-1.3 vamos@1.4-1.6 a@1.6-1.7 ver@1.7-2 el@2.1-2.2 el@2.3-2.4 tablero@2.4-2.9'));
  assert.deepEqual(d.map((x) => [x.texto, x.decision, x.inicio, x.fin]), [['vamos a', 'cortar', 1, 1.4], ['el', 'pendiente', 2.1, 2.3]]);
});

test('muletillas: "eh" se corta sola; "o sea" entre comas pendiente; "bueno" con contenido no se toca', () => {
  const d = detectarMuletillas(P('Eh...@0.5-0.7 lo@1-1.1 mejor@1.1-1.4 es@1.4-1.5 que,@1.5-1.7 o@1.7-1.8 sea,@1.8-2 no@2-2.1 ' +
    'tocas@2.1-2.5 nada.@2.5-3 Es@3.5-3.7 bueno@3.7-4 para@4-4.2 ti.@4.2-4.6'));
  assert.deepEqual(d.map((x) => [x.texto, x.decision]), [['Eh...', 'cortar'], ['o sea,', 'pendiente']]);
});

test('normalizar quita tildes y puntuación', () => {
  assert.equal(normalizar('¿Qué TAL, cómo vas?'), 'que tal como vas');
});

// ---------------------------------------------------------------- plan
const base = () => {
  const palabras = P('Hola.@1.0-1.6 Grabo@3.0-3.4 bien.@3.4-4.0 Eh@4.3-4.5 sigo@4.8-5.4');
  const silencios = [{ inicio: 0, fin: 1 }, { inicio: 1.6, fin: 3 }, { inicio: 4.0, fin: 4.3 }, { inicio: 4.5, fin: 4.8 }, { inicio: 5.4, fin: 6 }];
  return { duracion: 6, palabras, silencios };
};

test('descartesDeSilencio: cabeza, cola y pausas largas (con el aire descontado); las cortas no', () => {
  const { silencios } = base();
  const d = descartesDeSilencio(silencios, 6);
  assert.deepEqual(d.map((x) => [x.inicio, x.fin]), [[0, 0.9], [1.76, 2.9], [5.56, 6]]);
});

test('planificar: tramos en la rejilla de frames, sin aire acumulado en la junta de la muletilla', () => {
  const b = base();
  const descartes = [...descartesDeSilencio(b.silencios, 6), { inicio: 4.3, fin: 4.5, motivo: 'muletilla', decision: 'cortar' }];
  const c = planificar({ ...b, descartes, params: { fps: 30 } });
  for (const x of c) for (const t of [x.inicio, x.fin]) assert.ok(Math.abs(t * 30 - Math.round(t * 30)) < 0.02, `${t} fuera de rejilla`);
  assert.deepEqual(c.map((x) => x.texto), ['Hola.', 'Grabo bien.', 'sigo']);
  // a cada lado de la junta de la muletilla queda como mucho su colchón (0,16 + 0,10), no las dos pausas enteras
  const izq = c[1], der = c[2];
  assert.ok(izq.fin <= 4.0 + 0.16 + 0.034, `fin del tramo izq ${izq.fin}`);
  assert.ok(der.inicio >= 4.8 - 0.10 - 0.034, `inicio del tramo der ${der.inicio}`);
});

test('planificar respeta decision "conservar" (pausa dramática) y planifica los "pendiente" como corte', () => {
  const b = base();
  const ds = descartesDeSilencio(b.silencios, 6);
  ds[1].decision = 'conservar';
  const c = planificar({ ...b, descartes: ds, params: { fps: 30 } });
  assert.ok(c.some((x) => x.inicio <= 1.6 && x.fin >= 3), 'la pausa conservada sigue dentro de un tramo');
  const pend = planificar({ ...b, descartes: [...descartesDeSilencio(b.silencios, 6), { inicio: 4.8, fin: 5.4, motivo: 'muletilla', decision: 'pendiente' }], params: { fps: 30 } });
  assert.ok(!pend.some((x) => x.texto.includes('sigo')));
});

test('huellaPlan cambia al cambiar una decisión', () => {
  const d = [{ inicio: 1, fin: 2, motivo: 'muletilla', decision: 'pendiente' }];
  const h1 = huellaPlan(d, { fps: 30 });
  assert.notEqual(h1, huellaPlan([{ ...d[0], decision: 'cortar' }], { fps: 30 }));
  assert.equal(h1, huellaPlan(d, { fps: 30 }));
});

test('validarConservar detecta solapes, desorden y tiempos fuera de rejilla', () => {
  assert.deepEqual(validarConservar([{ id: 't1', inicio: 0, fin: 1 }, { id: 't2', inicio: 1.5, fin: 2.0 }], 3, 30), []);
  const e = validarConservar([{ id: 't1', inicio: 0, fin: 1.01 }, { id: 't2', inicio: 0.9, fin: 2 }], 3, 30);
  assert.ok(e.some((x) => /rejilla/.test(x)) && e.some((x) => /solapa/.test(x)));
});

test('ajustarAFrame elige el frame vecino con menos energía', () => {
  assert.equal(ajustarAFrame(1.01, 30, (t) => (t < 1.01 ? 0.5 : 0.1)), 1.033);
  assert.equal(ajustarAFrame(1.01, 30, (t) => (t < 1.01 ? 0.1 : 0.5)), 1);
});

// ---------------------------------------------------------------- filtro de corte
test('filtroCorte: frames y muestras exactos por tramo, micro-fundidos y concat', () => {
  const f = filtroCorte([{ inicio: 1.1, fin: 4.033 }, { inicio: 8.867, fin: 11.367 }], { fps: 30, sr: 48000, fadeMs: 20 });
  assert.match(f, /trim=start=1\.083333:end=4\.016667,setpts=PTS-1\.100000\/TB,fps=30:start_time=0/);
  assert.match(f, /trim=end_frame=88,/);                 // 4.0333-1.1 = 88 frames
  assert.match(f, /trim=end_frame=75,/);                 // 2.5 s
  assert.match(f, /apad=whole_len=140800,atrim=end_sample=140800/);   // 88/30 × 48000
  assert.match(f, /atrim=start=8\.866667:end=11\.366667/);
  assert.equal((f.match(/afade=t=in/g) || []).length, 2);
  assert.match(f, /\[v0\]\[a0\]\[v1\]\[a1\]concat=n=2:v=1:a=1\[v\]\[a\]$/);
  assert.match(filtroCorte([{ inicio: 0, fin: 1 }], { conAudio: false }), /\[v0\]concat=n=1:v=1:a=0\[v\]$/);
});

// ---------------------------------------------------------------- re-temporizado
test('mapaTiempos + retemporizarPalabras: las cortadas desaparecen y el resto se desplaza', () => {
  const mapa = mapaTiempos([{ id: 't01', inicio: 1, fin: 2 }, { id: 't02', inicio: 5, fin: 6.5 }], 30);
  assert.deepEqual(mapa.map((m) => m.salida), [[0, 1], [1, 2.5]]);
  const ws = retemporizarPalabras(P('hola@1.1-1.5 basura@3-3.5 sigo@5.2-5.9 borde@6.4-6.7'), mapa);
  assert.deepEqual(ws.map((w) => [w.texto, w.inicio, w.fin]), [['hola', 0.1, 0.5], ['sigo', 1.2, 1.9]]);
  assert.equal(fuenteASalida(5.5, mapa), 1.5);
  assert.equal(fuenteASalida(3, mapa), null);
  const ws2 = retemporizarPalabras(P('cola@6.3-6.6'), mapa);   // mitad dentro: se recorta al borde del tramo
  assert.deepEqual(ws2.map((w) => [w.inicio, w.fin]), [[2.3, 2.5]]);
});

test('aTranscriptWhisper produce el formato que lee generate-captions.mjs (una palabra por segmento)', () => {
  const t = aTranscriptWhisper([{ texto: 'Hola.', inicio: 0.1, fin: 0.374 }]);
  assert.deepEqual(t.transcription[0].offsets, { from: 100, to: 374 });
  assert.equal(t.transcription[0].text.trim(), 'Hola.');
  assert.equal(t.transcription[0].timestamps.from, '00:00:00,100');
});

test('aplicarCorrecciones arregla la palabra y conserva la puntuación', () => {
  const out = aplicarCorrecciones([{ texto: 'Clot.', inicio: 0, fin: 1 }, { texto: 'con', inicio: 1, fin: 2 }], [{ de: 'clot', a: 'Claude' }]);
  assert.deepEqual(out.map((w) => w.texto), ['Claude.', 'con']);
  assert.equal(out[0].corregida, 'Clot.');
});

test('depurarDescartes quita la muletilla que ya está dentro de una toma descartada', () => {
  const d = depurarDescartes([
    { inicio: 1, fin: 3, motivo: 'toma-repetida' }, { inicio: 1.5, fin: 1.7, motivo: 'muletilla' }, { inicio: 0, fin: 4, motivo: 'silencio' }]);
  assert.deepEqual(d.map((x) => x.motivo).sort(), ['silencio', 'toma-repetida']);
});

// ---------------------------------------------------------------- encuadre
test('ventanaRecorte: 9:16 sobre 1920×1080, centrada en la cara, par y dentro de la fuente', () => {
  assert.deepEqual(ventanaRecorte({ anchoFuente: 1920, altoFuente: 1080, cx: 1282, cy: 642 }), { x: 979, y: 0, w: 606, h: 1080 });
  assert.deepEqual(ventanaRecorte({ anchoFuente: 1920, altoFuente: 1080, cx: 1900, cy: 642 }).x, 1920 - 606);
  const z = ventanaRecorte({ anchoFuente: 1920, altoFuente: 1080, cx: 1282, cy: 642, zoom: 1.12 });
  assert.deepEqual([z.w % 2, z.h % 2], [0, 0]);
  assert.ok(z.w < 606 && z.y > 0 && z.y + z.h <= 1080);
});

test('intervalosZoom alterna 1 ↔ zoom en las juntas respetando la permanencia mínima', () => {
  assert.deepEqual(intervalosZoom([2.9, 3.5, 5.4, 9.933, 11.7], 15.867, { zoom: 1.12, minPermanencia: 1.5, fps: 30 }), [
    { inicio: 0, fin: 2.9, zoom: 1 }, { inicio: 2.9, fin: 5.4, zoom: 1.12 }, { inicio: 5.4, fin: 9.933, zoom: 1 },
    { inicio: 9.933, fin: 11.7, zoom: 1.12 }, { inicio: 11.7, fin: 15.867, zoom: 1 }]);
});

test('parsearZoomsManuales y cambiosDeFrase', () => {
  assert.deepEqual(parsearZoomsManuales('2:1.2,5:1', 8), [{ inicio: 0, fin: 2, zoom: 1 }, { inicio: 2, fin: 5, zoom: 1.2 }, { inicio: 5, fin: 8, zoom: 1 }]);
  assert.throws(() => parsearZoomsManuales('2:0.8', 8), /zoom inválido/);
  assert.deepEqual(cambiosDeFrase([{ texto: 'Hola.', inicio: 0, fin: 0.5 }, { texto: 'Sigo', inicio: 0.6, fin: 1 }, { texto: 'aquí', inicio: 1.5, fin: 2 }]), [0.55, 1.45]);
});

test('expresionSeguimiento interpola, escapa comas y admite desfase de tiempo local', () => {
  const e = expresionSeguimiento([{ t: 0, x: 100 }, { t: 2, x: 300 }]);
  assert.equal(e, 'if(lt(t\\,0)\\,100\\,if(lt(t\\,2)\\,100+(200)*(t-0)/2\\,300))');
  assert.match(expresionSeguimiento([{ t: 0, x: 100 }, { t: 2, x: 300 }], 1.5), /\(t\+1\.5\)/);
  assert.equal(expresionSeguimiento([{ t: 0, x: 42 }]), '42');
});

test('suavizarTrayectoria ignora el temblor por debajo de la zona muerta', () => {
  const m = [0, 1, 2, 3, 4, 5].map((t) => ({ t, x: 1000 + (t % 2) * 10 }));
  assert.equal(suavizarTrayectoria(m, { zonaMuerta: 40 }).filter((p) => p.x !== 1000).length, 0);
});

test('caraEnSalida + caraEnZonaSegura (reel: y 220–1470, x 35–1045)', () => {
  const v = { x: 979, y: 0, w: 606, h: 1080 };
  const c = caraEnSalida({ x: 1087, y: 447, w: 391, h: 391 }, v);
  assert.deepEqual(c, { x: 192, y: 797, w: 697, h: 697 });
  assert.equal(caraEnZonaSegura(c), false);    // la barbilla baja de y 1470
  assert.equal(caraEnZonaSegura({ x: 200, y: 400, w: 600, h: 600 }), true);
});

import { quitarColaFantasma } from '../bruto/medios.mjs';
test('quitarColaFantasma saca "Subtitulado" al final del bloque pero no deja el bloque vacío', () => {
  assert.deepEqual(quitarColaFantasma(P('corta@1-1.3 lo@1.3-1.4 que@1.4-1.5 sobra.@1.5-2 Subtitulado@2.9-3')).map((p) => p.w), ['corta', 'lo', 'que', 'sobra.']);
  assert.deepEqual(quitarColaFantasma(P('Gracias@1-1.5')).map((p) => p.w), ['Gracias']);
});
