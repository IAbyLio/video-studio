import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Cara = require('../personaje/cara.js');
const sinIds = (s) => s.replace(/cara\d+-/g, '');
const cues = [[0, 'X'], [0.5, 'D'], [1, 'E']];

test('cara.js estilos: por defecto sigue siendo caricatura + boca orgánica (con cejas e iris)', () => {
  const svg = Cara.crear({ cues }).svgEn(0.7);
  assert.equal(Cara.RASGOS.ojo, 'caricatura');
  assert.equal(Cara.RASGOS.boca, 'organica');
  assert.match(svg, /radialGradient/);
});

test('cara.js estilos: bloque, pixel y ranura son deterministas y distintos entre sí', () => {
  const svgs = ['bloque', 'pixel', 'ranura', 'caricatura'].map((ojo) => {
    const a = Cara.crear({ cues, rasgos: { ojo, boca: 'geometrica', cejas: false } }).svgEn(0.7);
    const b = Cara.crear({ cues, rasgos: { ojo, boca: 'geometrica', cejas: false } }).svgEn(0.7);
    assert.equal(sinIds(a), sinIds(b), `determinista: ${ojo}`);
    return sinIds(a);
  });
  assert.equal(new Set(svgs).size, 4);
});

test('cara.js estilos: ojoForma feliz, parpadeo a guion bajo y mirada externa cambian el dibujo', () => {
  const expresiones = { feliz: { ojoForma: 'feliz' }, neutro2: {} };
  const base = { rasgos: { ojo: 'bloque', boca: 'geometrica', cejas: false }, expresiones };
  const n = Cara.crear({ ...base, pista: [[0, 'neutro2']] });
  const f = Cara.crear({ ...base, pista: [[0, 'feliz']] });
  assert.notEqual(sinIds(n.svgEn(0.2)), sinIds(f.svgEn(0.2)));
  assert.notEqual(sinIds(n.setBlink(1).svgEn(0.2)), sinIds(n.setBlink(0).svgEn(0.2)));
  const m = Cara.crear({ ...base, pista: [[0, 'neutro2']], mirada: (t) => [t > 1 ? 0.8 : 0, 0] });
  assert.notEqual(sinIds(m.svgEn(0.2)), sinIds(m.svgEn(1.2)));
  assert.equal(Cara.crear({ ...base, pista: [[0, 'neutro2']], mirada: () => [0.5, 0] }).stateAt(0.2).expr.L.pupil[0] > 0.3, true);
});

test('cara.js estilos: boca geométrica dibuja los 9 visemas sin contorno de serie', () => {
  const c = Cara.crear({ rasgos: { ojo: 'bloque', boca: 'geometrica', cejas: false } });
  const vistos = new Set(Object.keys(Cara.SHAPES).map((v) => sinIds(c.setMouth(v).svgEn(0))));
  assert.ok(vistos.size >= 8, `visemas distintos: ${vistos.size}`);
});

test('cara.js rasgos humanos: bigote, perilla, mejillas y cierreLimpio apagados por defecto, deterministas y vivos', () => {
  const base = { cues, rasgos: { ojo: 'caricatura', boca: 'organica' } };
  const lisa = sinIds(Cara.crear(base).svgEn(0.7));
  const humano = { ...base, rasgos: { ...base.rasgos, bigote: true, perilla: true, mejillas: true, cierreLimpio: true }, paleta: { mejilla: '#e08572' } };
  const a = sinIds(Cara.crear(humano).svgEn(0.7)), b = sinIds(Cara.crear(humano).svgEn(0.7));
  assert.equal(a, b, 'determinista');
  assert.notEqual(a, lisa, 'el vello cambia el dibujo');
  assert.equal(Cara.RASGOS.bigote || Cara.RASGOS.perilla || Cara.RASGOS.mejillas || Cara.RASGOS.cierreLimpio, false);
  // la perilla baja con la apertura de la boca (visema D vs A)
  const c = Cara.crear(humano);
  assert.notEqual(sinIds(c.setMouth('A').svgEn(0)), sinIds(c.setMouth('D').svgEn(0)));
  // cierreLimpio: con el ojo cerrado el aro del contorno desaparece
  const abierto = Cara.crear(humano).setBlink(0).svgEn(0), cerrado = Cara.crear(humano).setBlink(1).svgEn(0);
  assert.notEqual(sinIds(abierto), sinIds(cerrado));
  assert.equal(Cara.crear({ ...base, geometria: { ceja: { L: 33, grosor: 13, dy: 0 } } }).svgEn(0.7).replace(/cara\d+-/g, ''), lisa, 'ceja por defecto = la de siempre');
});

test('cara.js labios y sombra de barba: apagados por defecto, deterministas y vivos', () => {
  const base = { cues, rasgos: { ojo: 'caricatura', boca: 'organica', perilla: true } };
  const sin = sinIds(Cara.crear(base).svgEn(0.7));
  const con = { ...base, rasgos: { ...base.rasgos, labios: true }, paleta: { labio: '#d98f84' }, geometria: { perilla: { sombra: 0.16 } } };
  const a = sinIds(Cara.crear(con).svgEn(0.7)), b = sinIds(Cara.crear(con).svgEn(0.7));
  assert.equal(a, b, 'determinista');
  assert.notEqual(a, sin);
  assert.equal(Cara.RASGOS.labios, false);
  assert.equal(Cara.GEOMETRIA.perilla.sombra, 0);
  const c = Cara.crear(con);
  assert.notEqual(sinIds(c.setMouth('X').svgEn(0)), sinIds(c.setMouth('D').svgEn(0)));
});

test('cara.js trazos de primer plano: ojo.trazo, ojoContorno, trazoBoca, labioAncho y bocaKy (defaults sin cambios)', () => {
  const base = { cues, rasgos: { ojo: 'caricatura', boca: 'organica', labios: true }, paleta: { labio: '#c58571' } };
  const def = sinIds(Cara.crear(base).setMouth('D').svgEn(0));
  const explicitos = sinIds(Cara.crear({ ...base, geometria: { ojo: { dx: 45, y: -30, rx: 33, ry: 36, trazo: 5.5 }, trazoBoca: 1, labioAncho: 12 } }).setMouth('D').svgEn(0));
  assert.equal(def, explicitos, 'los valores por defecto reproducen la cara de siempre');
  const fino = Cara.crear({ ...base, geometria: { ojo: { trazo: 3 }, trazoBoca: 0.5, labioAncho: 7, bocaK: 1.8, bocaKy: 1 }, paleta: { labio: '#c58571', ojoContorno: '#5a3b2b' } });
  const a = sinIds(fino.setMouth('D').svgEn(0)), b = sinIds(fino.setMouth('D').svgEn(0));
  assert.equal(a, b, 'determinista');
  assert.notEqual(a, def);
  assert.match(a, /#5a3b2b/);
  assert.match(a, /scale\(1\.8,1\)/);
});
