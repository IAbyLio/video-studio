// Tests de las piezas propias de este repo: voz con registro vacío, captions, zonas seguras, proyectos nuevos,
// SFX sintetizados, cuentas, catálogo de estilos, copias compartidas y guías de la IA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { resolvePerfil, validarPerfiles, verifyRemoteVoice, speechPayload, perfilArgs, pitchFilter, EJEMPLO_PERFIL } from '../voice-profile.mjs';
import { extraerPalabras, agruparBloques, clasificar, bloqueHtml } from '../generate-captions.mjs';
import { DATOS, rectSeguro, cajaInvade } from '../zonas-seguras.mjs';
import { validarSlug, inyectarMarca, reescribirFuentes, bloqueZonaSegura, catalogo } from '../nuevo-proyecto.mjs';
import { sintetizar, RECETAS } from '../sfx-sintetizar.mjs';
import { revisarFormato } from '../comprobar-cuentas.mjs';
import { versionMayor } from '../comprobar-entorno.mjs';
import { lintGuion } from '../voz.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const leer = (p) => readFileSync(join(RAIZ, p), 'utf8');

// ------------------------------------------------------------------ voz
test('voz: el registro del repo viene vacío y pedir una voz explica cómo declararla', () => {
  const reg = JSON.parse(leer('modulos/voz/perfiles.json'));
  assert.deepEqual(reg.perfiles, {});
  assert.throws(() => resolvePerfil(undefined, { env: {}, perfiles: validarPerfiles(reg) }), (e) => e.amigable && e.codigo === 3 && /perfiles\.json/.test(e.message) && /voice_id/.test(e.message));
});

test('voz: un perfil declarado se resuelve, un ID ajeno se rechaza y la voz remota se verifica', () => {
  const ej = JSON.parse(JSON.stringify(EJEMPLO_PERFIL));
  ej.mi_voz.voice_id = 'abc123'; ej.mi_voz.nombre_remoto = 'Mi voz';
  const P = validarPerfiles({ perfiles: ej });
  assert.equal(resolvePerfil(undefined, { env: {}, perfiles: P }).clave, 'mi_voz');
  assert.throws(() => resolvePerfil('mi_voz', { env: { ELEVENLABS_VOICE_ID: 'intruso' }, perfiles: P }), /ningún perfil declarado/);
  assert.throws(() => verifyRemoteVoice({ voice_id: 'abc123', name: 'Otra' }, P.mi_voz), /cancelada/);
  verifyRemoteVoice({ voice_id: 'abc123', name: 'Mi voz' }, P.mi_voz);
});

test('voz: el ejemplo tal cual (con <placeholders>) no pasa como perfil habilitado', () => {
  assert.throws(() => validarPerfiles({ perfiles: EJEMPLO_PERFIL }), /voice_id/);
});

test('voz: payload v4 con language_code y tags; v2 sin él; rangos y pitch', () => {
  const ej = JSON.parse(JSON.stringify(EJEMPLO_PERFIL)); ej.mi_voz.voice_id = 'x'; ej.mi_voz.nombre_remoto = 'X';
  const P = validarPerfiles({ perfiles: ej }).mi_voz;
  const v4 = speechPayload({ text: '[calm] Hola.', args: perfilArgs(P, 'v4'), perfil: P, model: 'v4', prevRequestIds: ['a', 'b', 'c', 'd'] });
  assert.equal(v4.model_id, 'eleven_v4'); assert.equal(v4.language_code, 'es'); assert.deepEqual(v4.previous_request_ids, ['b', 'c', 'd']);
  assert.equal(speechPayload({ text: 'Hola.', args: perfilArgs(P, 'v2'), perfil: P, model: 'v2' }).language_code, undefined);
  assert.throws(() => perfilArgs(P, 'v4', { similarity: 1.5 }), /similarity/);
  assert.match(pitchFilter(4, 44100), /^asetrate=44100\*1\.259921,aresample=44100,atempo=0\.793701$/);
  assert.throws(() => lintGuion('[GANCHO] Hola', false, 'v2'), /anotaciones/);
  lintGuion('[calm] Hola, ¿qué tal?', false, 'v4');
});

test('voz.mjs --dry-run con el registro vacío explica y sale limpio (código 3, sin pila)', () => {
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts/voz.mjs'), '--dry-run'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /Todavía no hay ninguna voz declarada/);
  assert.doesNotMatch(r.stderr, /at .*\.mjs:\d+/);
});

// ------------------------------------------------------------------ captions
test('captions: entiende los tres formatos de transcript', () => {
  assert.deepEqual(extraerPalabras([{ text: 'Hola,', start: 0, end: 0.3 }]), [{ text: 'Hola,', start: 0, end: 0.3 }]);
  assert.deepEqual(extraerPalabras({ palabras: [{ texto: 'hola', inicio: 1, fin: 1.4 }] }), [{ text: 'hola', start: 1, end: 1.4 }]);
  const w = extraerPalabras({ transcription: [{ text: ' dos palabras', offsets: { from: 0, to: 1000 } }] });
  assert.equal(w.length, 2); assert.equal(w[1].start, 0.5);
  assert.throws(() => extraerPalabras({ otra: 1 }), /no reconocido/);
});

test('captions: bloques cortan en punto y respetan el máximo de palabras; clasifica claves', () => {
  const words = 'Esto es una prueba. Y esta otra frase sigue hasta el final'.split(' ').map((t, i) => ({ text: t, start: i * 0.3, end: i * 0.3 + 0.25 }));
  const b = agruparBloques(words, { maxPalabras: 4 });
  assert.equal(b[0].words.map((x) => x.text).join(' '), 'Esto es una prueba.');
  assert.ok(b.every((x) => x.words.length <= 4));
  assert.equal(clasificar('¡Gratis!', { positivas: ['gratis'] }), 'positiva');
  assert.equal(clasificar('el', { positivas: ['el'] }), '');
  assert.match(bloqueHtml(b[0], 0, {}), /class="clip cap" id="cap1" data-start="0\.000" data-duration="[\d.]+" data-track-index="100"/);
});

// ------------------------------------------------------------------ zonas seguras
test('zonas seguras: rectángulo seguro de reel y detección de invasiones', () => {
  assert.deepEqual(rectSeguro(DATOS.formats.reel), [35, 220, 1045, 1470]);
  assert.deepEqual(rectSeguro(DATOS.formats.story), [35, 250, 1045, 1670]);
  assert.deepEqual(cajaInvade(DATOS.formats.reel, [185, 700, 710, 300]), []);
  assert.ok(cajaInvade(DATOS.formats.reel, [900, 1200, 100, 100]).some((n) => /botones/.test(n)));
  assert.ok(cajaInvade(DATOS.formats.reel, [200, 1500, 100, 50]).some((n) => /abajo/.test(n)));
  for (const f of Object.values(DATOS.formats)) for (const z of [...f.prohibida, ...f.precaucion]) assert.equal(z.rect.length, 4);
});

// ------------------------------------------------------------------ proyectos nuevos
test('nuevo-proyecto: slug, marca y fuentes', () => {
  assert.equal(validarSlug('mi-reel-1'), 'mi-reel-1');
  assert.throws(() => validarSlug('Mi Reel'), /minúsculas/);
  assert.throws(() => validarSlug('_plantilla'));
  const html = '<style id="marca">\n/* MARCA:INICIO (x) */\n:root{--fondo:#000}\n/* MARCA:FIN */\n</style>';
  const out = inyectarMarca(html, '/* cabecera */\n:root { --fondo: #123456; }\n');
  assert.match(out, /--fondo: #123456/); assert.doesNotMatch(out, /#000/); assert.doesNotMatch(out, /cabecera/);
  assert.equal(inyectarMarca(out, ':root { --fondo: #123456; }'), out);   // idempotente
  assert.throws(() => inyectarMarca('<html></html>', ':root{}'), /MARCA/);
  assert.equal(reescribirFuentes('src: url("fuentes/a.woff2") format("woff2")'), 'src: url("assets/fuentes/a.woff2") format("woff2")');
  assert.match(bloqueZonaSegura('reel'), /y 220–1470/);
  assert.throws(() => bloqueZonaSegura('cine'), /formato desconocido/);
});

// ------------------------------------------------------------------ catálogo de estilos
test('catálogo: cada estilo tiene ficha, ejemplo con bloque de marca, composición "main" y miniatura', () => {
  const ids = catalogo().map((e) => e.id);
  assert.ok(ids.includes('libre') && ids.length >= 10);
  for (const e of catalogo()) {
    assert.ok(['probado', 'experimental'].includes(e.estado), e.id);
    if (e.id === 'libre') continue;
    for (const f of ['FICHA.md', 'miniatura.png', 'ejemplo/index.html', 'ejemplo/meta.json', 'ejemplo/hyperframes.json']) {
      assert.ok(existsSync(join(RAIZ, e.carpeta, f)), `${e.id}: falta ${f}`);
    }
    const html = readFileSync(join(RAIZ, e.carpeta, 'ejemplo/index.html'), 'utf8');
    assert.match(html, /MARCA:INICIO/, `${e.id}: sin bloque de marca`);
    assert.match(html, /data-composition-id="main"/, `${e.id}: la composición raíz tiene que llamarse main`);
    assert.match(html, /window\.__timelines\["main"\]/, `${e.id}: timeline sin registrar`);
    assert.doesNotMatch(html, /Math\.random\(|Date\.now\(/, `${e.id}: no determinista`);
    assert.match(leer('estilos/README.md'), new RegExp(`${e.id}/miniatura\\.png`), `${e.id}: falta en estilos/README.md`);
  }
});

test('copias compartidas al día (three, liqui-glass, cara.js, muñeco, marca neutra)', () => {
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts/sincronizar-copias.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

// ------------------------------------------------------------------ SFX
test('SFX sintetizados: deterministas e idénticos a los del repo, manifest completo', () => {
  const m = JSON.parse(leer('modulos/sonido/sfx/sfx-manifest.json'));
  for (const id of Object.keys(RECETAS)) {
    const a = createHash('sha256').update(sintetizar(id)).digest('hex');
    const b = createHash('sha256').update(readFileSync(join(RAIZ, 'modulos/sonido/sfx', `${id}.wav`))).digest('hex');
    assert.equal(a, b, `${id}.wav no coincide con su receta (correr node scripts/sfx-sintetizar.mjs)`);
    assert.ok(m.samples[id], `${id} falta en el manifest`);
  }
  assert.ok(Object.keys(RECETAS).length >= 6);
});

// ------------------------------------------------------------------ cuentas y entorno
test('cuentas: formato sin enseñar la clave', () => {
  const r = revisarFormato('ELEVENLABS_API_KEY', 'sk_' + 'a'.repeat(40));
  assert.equal(r.formato_ok, true); assert.ok(!JSON.stringify(r).includes('a'.repeat(10)));
  assert.equal(revisarFormato('ELEVENLABS_API_KEY', '').presente, false);
  assert.equal(revisarFormato('ELEVENLABS_API_KEY', 'pegué mal la clave').formato_ok, false);
  assert.equal(versionMayor('v22.18.0'), 22); assert.equal(versionMayor('v18.2.0'), 18);
});

// ------------------------------------------------------------------ guías para la IA
test('guías: AGENTS.md copia el cuerpo de CLAUDE.md mientras existen las dos; tras el paso 0 queda una sola', () => {
  const hay = (p) => existsSync(join(RAIZ, p));
  assert.ok(hay('CLAUDE.md') || hay('AGENTS.md'), 'falta la guía de la IA (CLAUDE.md o AGENTS.md)');
  if (!(hay('CLAUDE.md') && hay('AGENTS.md'))) return;
  const cuerpo = (p) => leer(p).slice(leer(p).search(/^## /m));
  assert.equal(cuerpo('AGENTS.md'), cuerpo('CLAUDE.md'));
});

test('ningún archivo de texto lleva rutas absolutas de un usuario ni pinta de clave', () => {
  const malos = [];
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      if (['node_modules', '.git', 'renders', '.hyperframes', '.cache', 'vendor'].includes(n)) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!/\.(md|mjs|js|json|html|css|sh|py|swift|txt|example)$/.test(n) || /three\.(module|core)\.min\.js$/.test(n)) continue;
      const s = readFileSync(p, 'utf8');
      if (/\/Users\/[a-z]+\/|C:\\Users\\[A-Za-z]+\\/.test(s)) malos.push(`${p}: ruta absoluta`);
      if (/\bsk_[A-Za-z0-9]{30,}|r8_[A-Za-z0-9]{30,}/.test(s)) malos.push(`${p}: pinta de clave`);
    }
  };
  recorrer(RAIZ);
  assert.deepEqual(malos, []);
});

// ------------------------------------------------------------------ marca
import { leerPaleta, leerTipos, construirCss } from '../marca-desde-design.mjs';
import { coloresEnTexto, contraste, normalizarHex } from '../extraer-colores.mjs';

test('marca: DESIGN.md → marca.css con variables y @font-face; colores de archivos de texto y contraste', () => {
  const md = `# X\n## Paleta\n| Rol | Hex | Variable |\n|---|---|---|\n| Fondo | \`#101820\` | \`--fondo\` |\n| Acento | #FFB347 | \`--acento\` |\n\n## Tipografías\n| Uso | Familia | Peso | Archivo | Licencia |\n|---|---|---|---|---|\n| Títulos | Sora | 800 | \`marca/fuentes/sora.woff2\` | OFL |\n| Texto | Inter | 400 | del sistema | OFL |\n`;
  const p = leerPaleta(md);
  assert.deepEqual(p, { '--fondo': '#101820', '--acento': '#ffb347' });
  const t = leerTipos(md);
  assert.equal(t.titulos.familia, 'Sora'); assert.equal(t.titulos.archivo, 'fuentes/sora.woff2'); assert.equal(t.texto.archivo, null);
  const css = construirCss(p, t, { existeArchivo: () => true });
  assert.match(css, /--fondo: #101820;/); assert.match(css, /--texto: #f3f1ec;/);   // lo que falta sale del neutro
  assert.match(css, /@font-face \{ font-family: "Sora"; src: url\("fuentes\/sora\.woff2"\) format\("woff2"\); font-weight: 800;/);
  assert.match(css, /--fuente-titulos: "Sora",/); assert.match(css, /--peso-titulos: 800;/);
  assert.match(css, /--fuente-mono: "Inter",/);   // sin fuente de datos en el manual: no se agrega una tercera familia
  assert.deepEqual(coloresEnTexto('<svg fill="#FFF" stroke="#1a2b3c"/> rgb(255, 0, 0)'), { '#ffffff': 1, '#1a2b3c': 1, '#ff0000': 1 });
  assert.equal(normalizarHex('#abc'), '#aabbcc');
  assert.equal(contraste('#000000', '#ffffff'), 21);
});

// ------------------------------------------------------------------ estilos de captions
import { createRequire } from 'node:module';
const requireCjs = createRequire(import.meta.url);
const CaptionsEstilos = requireCjs('../captions/captions-estilos.js');

test('captions premium: componer es determinista, respeta overrides y las salidas; eventos sugieren SFX del repo', () => {
  const G = [
    { t0: 0.3, t1: 1.0, ws: [{ txt: 'Tu', s: 0.35 }, { txt: 'IA', s: 0.55, tono: 'positivo' }] },
    { t0: 1.0, t1: 1.8, ws: [{ txt: 'edita', s: 1.05 }, { txt: 'el', s: 1.35 }, { txt: 'vídeo,', s: 1.5, fin: true }] },
    { t0: 1.8, t1: 2.7, ws: [{ txt: 'pone', s: 1.9 }, { txt: 'los', s: 2.15 }, { txt: 'subtítulos', s: 2.3, tono: 'az' }] },
  ];
  const plan = { escenas: { S: { tpl: ['escalon', 'esparcido'] } }, bloques: { 'pone los subtitulos': { detras: true, tpl: 'apilado', entrada: 'zoom' } } };
  const a = CaptionsEstilos.componer(G, { plan }), b = CaptionsEstilos.componer(G, { plan });
  const firma = (B) => JSON.stringify(B.map((x) => [x.clave, x.tpl, x.entrada, x.salida, x.t0, x.tFin, x.detras]));
  assert.equal(firma(a), firma(b));
  const sub = a.find((x) => x.clave === 'pone los subtitulos');
  assert.equal(sub.detras, true); assert.equal(sub.tpl, 'apilado'); assert.equal(sub.entrada, 'zoom');
  assert.equal(a[0].lineas.find((l) => l.tipo === 'enf').tono, 'az');   // 'positivo' → az
  const ev = CaptionsEstilos.eventos(a);
  assert.ok(ev.every((e) => e.sfx === null || ['pop', 'tick', 'swipe'].includes(e.sfx)));
  assert.match(CaptionsEstilos.TOKENS.base.familia, /Helvetica/);   // por defecto, tipografía neutra
});
