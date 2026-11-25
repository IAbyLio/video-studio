#!/usr/bin/env node
// encuadrar.mjs — pasa un clip (normalmente el clip-cortado.mp4 horizontal) a vertical 1080×1920 (o 4:5 / 1:1):
//   - recorte centrado en la CARA: detectada con Vision de macOS (detectar-caras.swift, se compila una vez; sin npm
//     ni modelos), o fijada a mano con --cara <x> | <x,y> (px de la fuente o fracción 0–1). Sin detección: centro + aviso.
//   - --seguir: la ventana sigue a la cara (mediana móvil + zona muerta + interpolación lineal; nada de temblor).
//   - punch-ins: zoom constante por intervalos que alterna 1 ↔ --zoom (por defecto 1.12) en las juntas del corte
//     (--zooms cortes, disimula los jump cuts), en los cambios de frase (--zooms frases) o en los instantes que se
//     indiquen (--zooms "3.2:1.15,7.8:1"). El zoom se ancla a la cara. Por defecto se HORNEAN en el MP4; con
//     --zooms-en-composicion se hornea solo el recorte base y se exportan los keyframes GSAP para la composición.
//   - hoja de encuadre (encuadre-hoja.png: ventana + cara sobre la fuente) y hoja del resultado (resultado-hoja.png).
//
// Uso: node scripts/bruto/encuadrar.mjs <clip.mp4> [--salida <out.mp4>] [--formato 9x16|4x5|1x1] [--cara auto|x|x,y]
//        [--seguir] [--zooms ninguno|cortes|frases|"t:z,..."] [--zoom 1.12] [--mapa mapa-tiempos.json]
//        [--words words.json] [--zooms-en-composicion] [--muestreo 1] [--crf 18]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ventanaRecorte, intervalosZoom, parsearZoomsManuales, cambiosDeFrase, expresionSeguimiento, suavizarTrayectoria,
  mediana, caraEnSalida, caraEnZonaSegura,
} from './lib.mjs';
import { probar, ffmpeg, escribirJson, leerJson, argumentos, fmt } from './medios.mjs';

const A = argumentos(process.argv.slice(2));
const entrada = A._[0] && path.resolve(A._[0]);
if (!entrada || !fs.existsSync(entrada)) {
  console.error('uso: encuadrar.mjs <clip.mp4> [--salida out.mp4] [--formato 9x16] [--cara auto|x|x,y] [--seguir] [--zooms cortes|frases|ninguno|"t:z,..."] [--zoom 1.12]');
  process.exit(1);
}
const dir = path.dirname(entrada);
const FORMATOS = { '9x16': [1080, 1920], '4x5': [1080, 1350], '1x1': [1080, 1080] };
const formato = A.formato || '9x16';
if (!FORMATOS[formato]) { console.error(`formato ${formato} desconocido (9x16 | 4x5 | 1x1)`); process.exit(1); }
const [OW, OH] = FORMATOS[formato];
const salida = path.resolve(A.salida || path.join(dir, `${path.parse(entrada).name}-${formato}.mp4`));
const base = path.join(path.dirname(salida), path.parse(salida).name);
const info = probar(entrada);
if (!info.video) { console.error('el clip no tiene vídeo'); process.exit(1); }
const W = info.video.ancho, H = info.video.alto;
const fps = Math.round(info.video.fpsNominal) || 30;
const D = Math.round(info.duracion * fps) / fps;
const avisos = [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'encuadre-'));

// ---------------------------------------------------------------- detección de caras (Vision)
function detector() {
  const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'detectar-caras.swift');
  const bin = path.join(os.homedir(), '.cache/video-studio-bruto/detectar-caras');
  if (process.platform !== 'darwin') return null;
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    const r = spawnSync('swiftc', ['-O', '-o', bin, src], { encoding: 'utf8' });
    if (r.status !== 0) { avisos.push(`no se pudo compilar el detector Vision: ${(r.stderr || '').slice(0, 200)}`); return null; }
  }
  return bin;
}

function detectarCaras() {
  const paso = Number(A.muestreo || 1);
  const escala = Math.min(1, 960 / W);
  ffmpeg(['-v', 'error', '-i', entrada, '-vf', `fps=1/${paso},scale=${Math.round(W * escala / 2) * 2}:-2`, path.join(tmp, 'm%04d.png')]);
  const imgs = fs.readdirSync(tmp).filter((f) => /^m\d+\.png$/.test(f)).sort();
  const bin = detector();
  if (!bin) return null;
  const salidaDet = execFileSync(bin, imgs.map((f) => path.join(tmp, f)), { encoding: 'utf8', maxBuffer: 1 << 26 });
  const muestras = [];
  salidaDet.trim().split('\n').forEach((l, i) => {
    const j = JSON.parse(l);
    const t = +(i * paso + paso / 2).toFixed(3);                  // fps=1/paso toma el frame del centro de cada ventana
    if (!j.caras?.length) { muestras.push({ t, cara: null }); return; }
    const c = j.caras.reduce((m, x) => (x.w * x.h > m.w * m.h ? x : m));  // la más grande = el que habla
    muestras.push({ t, cara: { x: c.x / escala, y: c.y / escala, w: c.w / escala, h: c.h / escala, conf: c.conf } });
  });
  return muestras;
}

let cara = null, muestras = [], metodo = 'centro';
if (A.cara && A.cara !== 'auto' && A.cara !== true) {
  const [xs, ys] = String(A.cara).split(',').map(Number);
  const px = (v, tot) => (v <= 1 ? v * tot : v);
  cara = { cx: px(xs, W), cy: ys != null && !Number.isNaN(ys) ? px(ys, H) : H * 0.4, w: H * 0.3, h: H * 0.3 };
  metodo = 'manual';
} else {
  muestras = detectarCaras() || [];
  const con = muestras.filter((m) => m.cara);
  if (con.length >= Math.max(1, muestras.length * 0.5)) {
    cara = {
      cx: mediana(con.map((m) => m.cara.x + m.cara.w / 2)), cy: mediana(con.map((m) => m.cara.y + m.cara.h / 2)),
      w: mediana(con.map((m) => m.cara.w)), h: mediana(con.map((m) => m.cara.h)),
    };
    metodo = 'vision';
    if (con.length < muestras.length) avisos.push(`cara detectada en ${con.length}/${muestras.length} muestras (en el resto no había cara o salió de cuadro)`);
  } else {
    avisos.push(`sin detección fiable (cara en ${con.length}/${muestras.length} muestras): recorte CENTRADO. Mira encuadre-hoja.png y fijalo con --cara <x>.`);
    cara = { cx: W / 2, cy: H * 0.4, w: H * 0.3, h: H * 0.3 };
  }
}
const cajaCara = { x: cara.cx - cara.w / 2, y: cara.cy - cara.h / 2, w: cara.w, h: cara.h };

// ---------------------------------------------------------------- intervalos de zoom
const zoom = Number(A.zoom || 1.12);
const modoZoom = A.zooms || 'ninguno';
let intervalos;
if (modoZoom === 'ninguno') intervalos = [{ inicio: 0, fin: D, zoom: 1 }];
else if (modoZoom === 'cortes') {
  const fMapa = path.resolve(A.mapa || path.join(dir, 'mapa-tiempos.json'));
  if (!fs.existsSync(fMapa)) { console.error(`--zooms cortes necesita el mapa de tiempos (${fMapa})`); process.exit(1); }
  const juntas = leerJson(fMapa).tramos.slice(1).map((t) => t.salida[0]);
  intervalos = intervalosZoom(juntas, D, { zoom, fps, minPermanencia: Number(A.permanencia || 1.5) });
} else if (modoZoom === 'frases') {
  const fW = path.resolve(A.words || path.join(dir, 'words.json'));
  if (!fs.existsSync(fW)) { console.error(`--zooms frases necesita words.json (${fW})`); process.exit(1); }
  intervalos = intervalosZoom(cambiosDeFrase(leerJson(fW).palabras), D, { zoom, fps, minPermanencia: Number(A.permanencia || 2.5) });
} else intervalos = parsearZoomsManuales(modoZoom, D, fps);
const hornear = !A.zoomsEnComposicion;

// ---------------------------------------------------------------- ventanas, seguimiento y comprobación de safe zones
let trayectoria = null;
if (A.seguir) {
  const con = muestras.filter((m) => m.cara);
  if (con.length >= 2) trayectoria = suavizarTrayectoria(con.map((m) => ({ t: m.t, x: m.cara.x + m.cara.w / 2 })), { zonaMuerta: Math.round(W * 0.03) });
  else avisos.push('--seguir sin muestras de cara suficientes: recorte fijo');
}
const zonas = { '9x16': { x0: 35, x1: 1045, y0: 220, y1: 1470 }, '4x5': { x0: 50, x1: 1030, y0: 150, y1: 1170 }, '1x1': { x0: 50, x1: 1030, y0: 110, y1: 945 } };
const planes = intervalos.map((iv) => {
  const z = hornear ? iv.zoom : 1;
  const v = ventanaRecorte({ anchoFuente: W, altoFuente: H, anchoSalida: OW, altoSalida: OH, cx: cara.cx, cy: cara.cy, zoom: z });
  const cs = caraEnSalida(cajaCara, v, OW, OH);
  return { ...iv, ventana: v, caraSalida: cs, caraEnZonaSegura: caraEnZonaSegura(cs, zonas[formato]) };
});
for (const p of planes) if (!p.caraEnZonaSegura) avisos.push(`${p.inicio.toFixed(2)}–${p.fin.toFixed(2)} s (zoom ${p.zoom}): la cara cae fuera de la zona segura ${formato} (${JSON.stringify(p.caraSalida)})`);
const escalado = OW / planes[0].ventana.w;
if (escalado > 1.5) avisos.push(`el recorte se amplía ×${escalado.toFixed(2)} para llegar a ${OW}×${OH}: con una fuente ${W}×${H} el vertical pierde nitidez (grabar en vertical o en 4K evita esto).`);

// ---------------------------------------------------------------- filtro y render
const cropDe = (p) => {
  const v = p.ventana;
  const x = trayectoria ? `max(0\\,min(iw-ow\\,(${expresionSeguimiento(trayectoria, p.inicio)})-ow/2))` : v.x;
  return `crop=${v.w}:${v.h}:${x}:${v.y},scale=${OW}:${OH}:flags=lanczos,setsar=1`;
};
let filtro;
if (planes.length === 1 || !hornear) filtro = `[0:v]${cropDe(planes[0])},fps=${fps}[v]`;
else {
  const ps = planes.map((p, i) => `[s${i}]trim=start_frame=${Math.round(p.inicio * fps)}:end_frame=${Math.round(p.fin * fps)},setpts=PTS-STARTPTS,${cropDe(p)}[v${i}]`);
  filtro = `[0:v]split=${planes.length}${planes.map((_, i) => `[s${i}]`).join('')};\n` + ps.join(';\n') + `;\n${planes.map((_, i) => `[v${i}]`).join('')}concat=n=${planes.length}:v=1:a=0[v]`;
}
const fFiltro = path.join(tmp, 'filtro.txt');
fs.writeFileSync(fFiltro, filtro);
const t0 = Date.now();
ffmpeg(['-v', 'error', '-i', entrada, '-/filter_complex', fFiltro, '-map', '[v]', '-map', '0:a?', '-c:a', 'copy',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(A.crf || 18), '-pix_fmt', 'yuv420p', '-r', String(fps),
  '-video_track_timescale', String(fps * 1000), '-movflags', '+faststart', salida]);
const pr = probar(salida);
const nf = Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', salida], { encoding: 'utf8' }).trim());
const nfEntrada = Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', entrada], { encoding: 'utf8' }).trim());

// ---------------------------------------------------------------- hojas
function hoja(fuente, tiempos, cajas, destino, ancho) {
  tiempos.forEach((t, i) => {
    const dib = cajas ? cajas(t).map((b) => `drawbox=x=${Math.round(b.x)}:y=${Math.round(b.y)}:w=${Math.round(b.w)}:h=${Math.round(b.h)}:color=${b.color}:t=${b.t}`).join(',') : '';
    // (sin drawtext: no todas las builds de ffmpeg lo traen; los tiempos de cada viñeta van en encuadre.json → hojas)
    ffmpeg(['-v', 'error', '-ss', String(t), '-i', fuente, '-frames:v', '1', '-vf', `${dib ? dib + ',' : ''}scale=${ancho}:-2`, path.join(tmp, `h${String(i).padStart(2, '0')}.png`)]);
  });
  const cols = tiempos.length <= 6 ? tiempos.length : Math.ceil(tiempos.length / 2);
  ffmpeg(['-v', 'error', '-i', path.join(tmp, 'h%02d.png'), '-vf', `tile=${cols}x${Math.ceil(tiempos.length / cols)}:padding=6:color=0x222222`, '-frames:v', '1', destino]);
  for (const f of fs.readdirSync(tmp)) if (/^h\d+\.png$/.test(f)) fs.unlinkSync(path.join(tmp, f));
}
const tiemposHoja = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((k) => +(k * D).toFixed(2));
const planEn = (t) => planes.find((p) => t >= p.inicio && t < p.fin) || planes[planes.length - 1];
const muestraEn = (t) => muestras.filter((m) => m.cara).reduce((m, x) => (!m || Math.abs(x.t - t) < Math.abs(m.t - t) ? x : m), null);
hoja(entrada, tiemposHoja, (t) => {
  const p = planEn(t), m = muestraEn(t);
  const out = [{ ...p.ventana, color: 'yellow', t: 6 }];
  if (m) out.push({ ...m.cara, color: 'lime', t: 4 });
  return out;
}, base + '-encuadre-hoja.png', 640);
hoja(salida, tiemposHoja, null, base + '-resultado-hoja.png', 360);

// ---------------------------------------------------------------- encuadre.json (+ keyframes para la composición)
const camara = intervalos.filter((iv) => iv.zoom !== 1 || !hornear).map((iv) => {
  const cs = planes.find((p) => p.inicio === iv.inicio).caraSalida;
  return { t: iv.inicio, hasta: iv.fin, scale: iv.zoom, transformOrigin: `${Math.round(cs.x + cs.w / 2)}px ${Math.round(cs.y + cs.h / 2)}px` };
});
const gsap = !hornear ? [
  '// Punch-ins sobre el wrapper del clip (nunca sobre el <video>): instantáneos al inicio de cada intervalo.',
  ...intervalos.map((iv) => `tl.set("#bruto-wrap", { scale: ${iv.zoom}, transformOrigin: "${camara.find((k) => k.t === iv.inicio)?.transformOrigin || '50% 40%'}" }, ${iv.inicio});`),
] : [];
const salidaJson = {
  fuente: entrada, salida, formato, dimensiones: [OW, OH], fps, duracion: D,
  cara: { metodo, cx: Math.round(cara.cx), cy: Math.round(cara.cy), caja: Object.fromEntries(Object.entries(cajaCara).map(([k, v]) => [k, Math.round(v)])), muestras: muestras.length, conCara: muestras.filter((m) => m.cara).length },
  seguimiento: trayectoria, zoomsHorneados: hornear, intervalos: planes, camaraComposicion: hornear ? [] : camara, gsapComposicion: gsap, avisos,
  hojas: { encuadre: base + '-encuadre-hoja.png', resultado: base + '-resultado-hoja.png', tiempos: tiemposHoja,
    leyenda: 'encuadre-hoja: fuente con la ventana de recorte (amarillo) y la cara detectada más cercana (verde)' },
};
escribirJson(base + '-encuadre.json', salidaJson);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`[encuadrar] ${W}×${H} → ${OW}×${OH} · cara ${metodo} (cx ${Math.round(cara.cx)}, cy ${Math.round(cara.cy)}) · ${planes.length} intervalo(s) de zoom ${hornear ? 'horneados' : 'exportados para la composición'}${trayectoria ? ' · con seguimiento' : ''}`);
console.log(`[encuadrar] frames ${nfEntrada} → ${nf} ${nf === nfEntrada ? 'OK' : 'DESCUADRE'} · duración ${fmt(pr.duracion)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const a of avisos) console.log(`[aviso] ${a}`);
console.log(`[encuadrar] ${path.relative(process.cwd(), salida)} · hojas: ${path.basename(base)}-encuadre-hoja.png / -resultado-hoja.png`);
if (nf !== nfEntrada) process.exit(3);
