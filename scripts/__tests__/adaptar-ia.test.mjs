// Tests del paso 0 (scripts/adaptar-ia.mjs): las tres opciones sobre copias temporales del repo, idempotencia,
// negativa a cambiar de IA, marcadores bien formados, descripciones dentro de los límites y prompts de instalación.
// Si el repo ya está adaptado (solo queda una guía), los tests que necesitan la versión sin adaptar se saltan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  IAS, DATOS, planificar, aplicar, detectar, resolverMarcadores, tieneMarcadores, sustituir,
  leerFrontmatter, skillEstandar, agenteToml, agenteDoc, archivosGestionados,
} from '../adaptar-ia.mjs';
import { generar } from '../prompts-instalacion.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const FUENTE = existsSync(join(RAIZ, 'CLAUDE.md')) && existsSync(join(RAIZ, 'AGENTS.md'));
const sinFuente = FUENTE ? false : 'repo ya adaptado por el paso 0: no queda la versión de partida';
const NO_COPIAR = new Set(['node_modules', '.git', '.cache', 'renders', '.hyperframes']);

function copiaLimpia() {
  const dir = mkdtempSync(join(tmpdir(), 'adaptar-ia-'));
  cpSync(RAIZ, dir, { recursive: true, filter: (src) => !NO_COPIAR.has(src.split(sep).pop()) && !/estado-onboarding\.json$/.test(src) });
  return dir;
}
function arbol(dir) {
  const out = [];
  const rec = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); statSync(p).isDirectory() ? rec(p) : out.push(relative(dir, p).split(sep).join('/')); } };
  rec(dir);
  return out;
}
const huella = (dir) => createHash('sha256').update(arbol(dir).map((f) => f + ':' + createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')).join('\n')).digest('hex');
const ejecutar = (dir, args) => spawnSync(process.execPath, [join(dir, 'scripts/adaptar-ia.mjs'), ...args], { encoding: 'utf8' });

// ------------------------------------------------------------------ piezas puras
test('marcadores: se queda el bloque de la IA, se van los demás y los de "fuente"; mal formados, error', () => {
  const t = 'a\n<!-- IA:claude -->\nC\n<!-- /IA -->\n<!-- IA:codex,otra -->\nX\n<!-- /IA -->\n# IA:fuente\nF\n# /IA\nb';
  assert.equal(resolverMarcadores(t, 'claude'), 'a\nC\nb');
  assert.equal(resolverMarcadores(t, 'codex'), 'a\nX\nb');
  assert.equal(resolverMarcadores(t, 'fuente'), 'a\nF\nb');
  assert.throws(() => resolverMarcadores('<!-- IA:claude -->\nx', 'claude'), /sin cerrar/);
  assert.throws(() => resolverMarcadores('<!-- IA:gemini -->\nx\n<!-- /IA -->', 'claude'), /desconocida/);
  assert.throws(() => resolverMarcadores('x\n<!-- /IA -->', 'claude'), /sin apertura/);
});

test('sustituciones: rutas de skills y agentes y nombre de la guía según la IA', () => {
  const t = 'Lee `CLAUDE.md`, `.claude/skills/nuevo-video/SKILL.md` y `.claude/agents/video-qa.md`; agente `video-qa`. Base: `CLAUDE.md`, `AGENTS.md`.';
  assert.equal(sustituir(t, 'codex'), 'Lee `AGENTS.md`, `.agents/skills/nuevo-video/SKILL.md` y `.codex/agents/video-qa.toml`; agente `video_qa`. Base: `AGENTS.md`.');
  assert.equal(sustituir(t, 'otra'), 'Lee `AGENTS.md`, `.agents/skills/nuevo-video/SKILL.md` y `agentes/video-qa.md`; agente `video-qa`. Base: `AGENTS.md`.');
  assert.match(sustituir(t, 'claude'), /Base: `CLAUDE\.md`\.$/);
});

test('conversiones: SKILL.md estándar, custom agent TOML de Codex y checklist en Markdown', () => {
  const skill = '---\nname: x\ndescription: "Larga de Claude"\nwhen_to_use: "frases"\n---\n\n# X\n';
  const s = skillEstandar(skill, 'x', 'Para Codex');
  assert.deepEqual(leerFrontmatter(s).campos, { name: 'x', description: 'Para Codex' });
  assert.match(s, /\n# X\n$/);
  const ag = '---\nname: video-qa\ndescription: "d"\nmodel: sonnet\n---\n\n# video-qa: revisión\n\nPaso 1.\n';
  const toml = agenteToml(ag, 'video-qa');
  assert.match(toml, /^name = "video_qa"$/m);
  assert.match(toml, /^description = ".+"$/m);
  assert.match(toml, /^developer_instructions = '''\n# video-qa: revisión\n\nPaso 1\.\n'''$/m);
  assert.doesNotMatch(toml, /model/);
  const doc = agenteDoc(ag, 'video-qa');
  assert.doesNotMatch(doc, /^---/);
  assert.match(doc, /^# video-qa: revisión\n\n> \*\*Cuándo:\*\*/);
});

test('datos: cada skill y agente propio tiene descripción para Codex dentro de los límites del estándar', () => {
  for (const [nombre, d] of Object.entries(DATOS.skills)) {
    assert.match(nombre, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${nombre}: nombre fuera del estándar Agent Skills`);
    assert.ok(nombre.length <= 64);
    assert.ok(d.descripcion.length > 0 && d.descripcion.length <= 1024, `${nombre}: ${d.descripcion.length} caracteres (máx. 1024)`);
  }
  for (const [nombre, d] of Object.entries(DATOS.agentes)) {
    assert.match(d.nombre_codex, /^[a-z0-9_]+$/, nombre);
    assert.ok(d.descripcion.length > 0 && d.descripcion.length <= 1024, nombre);
  }
});

test('repo de partida: marcadores bien formados y skills/agentes de Claude Code con descripción dentro de su límite', { skip: sinFuente }, () => {
  for (const r of archivosGestionados(RAIZ)) {
    const t = readFileSync(join(RAIZ, r), 'utf8');
    if (tieneMarcadores(t)) for (const ia of [...IAS, 'fuente']) resolverMarcadores(t, ia, r);
  }
  for (const nombre of Object.keys(DATOS.skills)) {
    const { campos } = leerFrontmatter(readFileSync(join(RAIZ, '.claude/skills', nombre, 'SKILL.md'), 'utf8'));
    assert.equal(campos.name, nombre);
    assert.ok(campos.description, nombre);
    assert.ok((campos.description + (campos.when_to_use || '')).length <= 1536, `${nombre}: description + when_to_use > 1536`);
  }
  for (const nombre of Object.keys(DATOS.agentes)) {
    const { campos } = leerFrontmatter(readFileSync(join(RAIZ, '.claude/agents', nombre + '.md'), 'utf8'));
    assert.equal(campos.name, nombre); assert.ok(campos.description, nombre);
  }
});

// ------------------------------------------------------------------ las tres opciones sobre copias limpias
const ESPERADO = {
  claude: { hay: ['CLAUDE.md', '.claude/skills/nuevo-video/SKILL.md', '.claude/skills/analisis-viralidad/SKILL.md', '.claude/agents/video-qa.md', '.claude/agents/video-orquestador.md'], no: ['AGENTS.md', '.agents', '.codex', 'agentes', 'prompts', 'PROMPT-INSTALACION.md'] },
  codex: { hay: ['AGENTS.md', '.agents/skills/nuevo-video/SKILL.md', '.agents/skills/analisis-viralidad/references/critico.md', '.codex/agents/video-qa.toml', '.codex/agents/video-orquestador.toml'], no: ['CLAUDE.md', '.claude', 'agentes', 'prompts', 'PROMPT-INSTALACION.md'] },
  otra: { hay: ['AGENTS.md', '.agents/skills/nuevo-video/SKILL.md', '.agents/skills/analisis-viralidad/SKILL.md', 'agentes/video-qa.md', 'agentes/video-orquestador.md'], no: ['CLAUDE.md', '.claude', '.codex', 'prompts', 'PROMPT-INSTALACION.md'] },
};

for (const ia of IAS) {
  test(`opción ${ia}: --dry-run no toca nada; aplicar deja el árbol esperado, sin marcadores ni menciones ajenas; repetir no cambia nada`, { skip: sinFuente }, () => {
    const dir = copiaLimpia();
    try {
      const antes = huella(dir);
      const seco = ejecutar(dir, ['--ia', ia, '--dry-run']);
      assert.equal(seco.status, 0, seco.stderr);
      assert.match(seco.stdout, /Plan \(\d+ cambios\)/);
      assert.equal(huella(dir), antes, '--dry-run cambió archivos');

      const r = ejecutar(dir, ['--ia', ia]);
      assert.equal(r.status, 0, r.stderr);
      for (const p of ESPERADO[ia].hay) assert.ok(existsSync(join(dir, p)), `${ia}: falta ${p}`);
      for (const p of ESPERADO[ia].no) assert.ok(!existsSync(join(dir, p)), `${ia}: sobra ${p}`);
      assert.equal(detectar(dir), ia);

      const est = JSON.parse(readFileSync(join(dir, 'estado-onboarding.json'), 'utf8'));
      assert.equal(est.agente, ia); assert.equal(est.pasos['0_ia'].hecho, true); assert.deepEqual(est.pasos['0_ia'].revisar, []);
      assert.ok(est.pasos['1_requisitos'] && est.pasos['1_requisitos'].hecho === false, 'el resto de pasos sale de la plantilla');

      for (const f of arbol(dir).filter((f) => !f.startsWith('node_modules') && !f.startsWith('vendor/') && /\.(md|json|toml)$|\.gitignore$/.test(f))) {
        assert.ok(!tieneMarcadores(readFileSync(join(dir, f), 'utf8')), `${ia}: quedan marcadores en ${f}`);
      }
      const plan = planificar(dir, ia);
      assert.deepEqual(plan.revisar, [], `${ia}: menciones de otras IA:\n${plan.revisar.map((h) => `${h.ruta}:${h.linea} ${h.texto}`).join('\n')}`);
      assert.equal(plan.acciones.length, 0, `${ia}: la segunda pasada no es idempotente: ${plan.acciones.map((a) => a.tipo + ' ' + (a.ruta || a.de)).join(', ')}`);
      const otra = IAS.find((x) => x !== ia);
      const neg = ejecutar(dir, ['--ia', otra]);
      assert.equal(neg.status, 2, `cambiar a ${otra} tendría que negarse`);
      assert.match(neg.stderr, /ya está adaptado/);

      const guia = readFileSync(join(dir, ia === 'claude' ? 'CLAUDE.md' : 'AGENTS.md'), 'utf8');
      assert.match(guia, ia === 'claude' ? /^# .*Claude Code/ : ia === 'codex' ? /^# .*Codex/ : /^# .*tu IA/);
      if (ia === 'codex') {
        assert.ok(Buffer.byteLength(guia) < 32 * 1024, 'AGENTS.md pasa de los 32 KiB que Codex carga por defecto');
        for (const n of Object.keys(DATOS.agentes)) {
          const toml = readFileSync(join(dir, `.codex/agents/${n}.toml`), 'utf8');
          for (const campo of ['name', 'description', 'developer_instructions']) assert.match(toml, new RegExp(`^${campo} = `, 'm'), `${n}: falta ${campo}`);
        }
      }
      if (ia !== 'claude') {
        for (const n of Object.keys(DATOS.skills)) {
          const { campos } = leerFrontmatter(readFileSync(join(dir, `.agents/skills/${n}/SKILL.md`), 'utf8'));
          assert.deepEqual(Object.keys(campos), ['name', 'description'], `${n}: frontmatter no estándar`);
          assert.equal(campos.description, DATOS.skills[n].descripcion);
        }
      }
      // los tests del repo siguen en verde con una sola guía
      const t = spawnSync(process.execPath, ['--test', join(dir, 'scripts/__tests__/repo.test.mjs')], { encoding: 'utf8', cwd: dir });
      assert.equal(t.status, 0, t.stdout.slice(-2000));
      const c = spawnSync(process.execPath, [join(dir, 'scripts/sincronizar-copias.mjs'), '--check'], { encoding: 'utf8' });
      assert.equal(c.status, 0, c.stderr);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('cambios locales sin guardar en un archivo que se tocaría: se niega sin --forzar', { skip: sinFuente }, () => {
  const dir = copiaLimpia();
  try {
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    if (g('init', '-q').status !== 0) return;
    g('add', '-A'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
    writeFileSync(join(dir, 'AGENTS.md'), readFileSync(join(dir, 'AGENTS.md'), 'utf8') + '\nmío\n');
    const r = ejecutar(dir, ['--ia', 'claude']);
    assert.equal(r.status, 3, r.stdout + r.stderr);
    assert.ok(existsSync(join(dir, 'AGENTS.md')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ prompts de instalación
test('prompts: tres opciones {id, etiqueta, texto}, cada una con su línea de IA, el paso 0 y los 5 puntos; el .md al día', { skip: existsSync(join(RAIZ, 'prompts/prompts.json')) ? false : 'repo ya adaptado' }, () => {
  const d = JSON.parse(readFileSync(join(RAIZ, 'prompts/prompts.json'), 'utf8'));
  assert.deepEqual(d.prompts.map((p) => p.id), IAS);
  for (const p of d.prompts) {
    assert.ok(p.etiqueta && p.texto);
    assert.match(p.texto, /^Uso /);
    assert.match(p.texto, new RegExp(`paso 0 con la opción "${p.id}"`));
    for (const n of [1, 2, 3, 4, 5]) assert.match(p.texto, new RegExp(`^${n}\\. `, 'm'));
    assert.doesNotMatch(p.texto, /\u2014/);
  }
  assert.equal(readFileSync(join(RAIZ, 'PROMPT-INSTALACION.md'), 'utf8'), generar(d), 'correr: node scripts/prompts-instalacion.mjs');
});

// ------------------------------------------------------------------ recuento que se cita en el README
test('README: el recuento de agentes, skills, estilos y captions coincide con lo que hay', () => {
  const readme = readFileSync(join(RAIZ, 'README.md'), 'utf8');
  const n = (re) => Number((readme.match(re) || [])[1]);
  const agentes = ['.claude/agents', '.codex/agents', 'agentes'].flatMap((d) => (existsSync(join(RAIZ, d)) ? readdirSync(join(RAIZ, d)).filter((f) => /\.(md|toml)$/.test(f)) : []));
  const skills = Object.keys(DATOS.skills).filter((s) => ['.claude/skills', '.agents/skills'].some((d) => existsSync(join(RAIZ, d, s, 'SKILL.md'))));
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'estilos/catalogo.json'), 'utf8')).estilos.filter((e) => e.id !== 'libre');
  const captions = readdirSync(join(RAIZ, 'modulos/captions/ejemplos')).filter((d) => statSync(join(RAIZ, 'modulos/captions/ejemplos', d)).isDirectory());
  const oficiales = (readFileSync(join(RAIZ, 'ONBOARDING.md'), 'utf8').match(/^npx --yes skills@[\d.]+ add .*$/gm) || [])
    .slice(0, 2).flatMap((l) => l.split('--skill ')[1].split(' --agent')[0].trim().split(/\s+/));
  assert.equal(n(/(\d+) agentes/), agentes.length, 'agentes');
  assert.equal(n(/(\d+) skills propias/), skills.length, 'skills propias');
  assert.equal(n(/más (\d+) oficiales/), oficiales.length, 'skills oficiales');
  assert.equal(n(/(\d+) estilos visuales/), catalogo.length, 'estilos visuales');
  assert.equal(n(/(\d+) estilos de captions/), captions.length, 'estilos de captions');
});
