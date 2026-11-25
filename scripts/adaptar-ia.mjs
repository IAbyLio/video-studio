#!/usr/bin/env node
// adaptar-ia.mjs: paso 0 del onboarding: deja el repo con los archivos de UNA IA y quita los de las demás.
//
//   node scripts/adaptar-ia.mjs --ia claude|codex|otra [--dry-run] [--forzar] [--raiz <carpeta>]
//
//   claude  se queda CLAUDE.md + .claude/ (skills y agentes); se borra AGENTS.md.
//   codex   se queda AGENTS.md con cabecera de Codex; skills → .agents/skills/ (formato Agent Skills, descripción
//           para Codex); agentes → .codex/agents/<nombre>.toml (custom agents); se borran CLAUDE.md y .claude/.
//   otra    se queda AGENTS.md como fuente única; skills → .agents/skills/ (estándar); agentes → agentes/<nombre>.md
//           (checklists en Markdown); se borran CLAUDE.md y .claude/.
//
// En todos: los bloques <!-- IA:… --> … <!-- /IA --> (o "# IA:…" en .gitignore) de los documentos se resuelven
// (se queda el de la IA elegida, se van los demás y los "fuente"), las rutas se reescriben, se borran los prompts
// de instalación (sirven antes de clonar) y se anota el paso en estado-onboarding.json. Primero muestra el plan;
// con --dry-run no toca nada. Idempotente: repetirlo con la misma IA no cambia nada; con otra IA, se niega.
import { realpathSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ_REPO = fileURLToPath(new URL('../', import.meta.url));
export const IAS = ['claude', 'codex', 'otra'];
export const NOMBRES = { claude: 'Claude Code', codex: 'Codex', otra: 'otra IA agéntica (AGENTS.md)' };
const IDS_MARCADOR = new Set([...IAS, 'fuente']);
export const DATOS = JSON.parse(readFileSync(join(RAIZ_REPO, 'scripts/adaptar-ia.datos.json'), 'utf8'));

/** Cabecera (todo lo anterior al primer "## ") de la guía que queda. */
export const CABECERAS = {
  claude: '# Estudio de vídeo: guía de trabajo para Claude Code\n\n> Claude Code lee este archivo al abrir la carpeta. Skills en `.claude/skills/`, agentes en `.claude/agents/`.\n\n',
  codex: '# Estudio de vídeo: guía de trabajo para Codex\n\n> Codex lee este AGENTS.md al empezar cada sesión en esta carpeta (si lo cambias, abre una sesión nueva). Skills en `.agents/skills/`, agentes en `.codex/agents/`.\n\n',
  otra: '# Estudio de vídeo: guía de trabajo para tu IA\n\n> Fuente única de instrucciones (formato AGENTS.md, ver agents.md). Skills en formato estándar en `.agents/skills/`, agentes como checklists en `agentes/`. Sin probar con tu herramienta: si algo no coincide, díselo a la persona en vez de improvisar.\n\n',
};

// ------------------------------------------------------------------ transformaciones de texto (puras)
const RE_INICIO = /^\s*(?:<!--|#|\/\/)\s*IA:([a-z,]+)\s*(?:-->)?\s*$/;
const RE_FIN = /^\s*(?:<!--|#|\/\/)\s*\/IA\s*(?:-->)?\s*$/;

/** Resuelve los bloques de marcadores para `ia`. Lanza si están desbalanceados o con un id desconocido. */
export function resolverMarcadores(texto, ia, archivo = '') {
  const out = [];
  let abierto = null;
  texto.split('\n').forEach((linea, i) => {
    const ini = linea.match(RE_INICIO);
    if (ini) {
      if (abierto) throw new Error(`${archivo}:${i + 1}: bloque IA anidado (falta <!-- /IA --> antes)`);
      const ids = ini[1].split(',');
      for (const id of ids) if (!IDS_MARCADOR.has(id)) throw new Error(`${archivo}:${i + 1}: IA desconocida "${id}"`);
      abierto = { ids, linea: i + 1 };
      return;
    }
    if (RE_FIN.test(linea)) {
      if (!abierto) throw new Error(`${archivo}:${i + 1}: <!-- /IA --> sin apertura`);
      abierto = null;
      return;
    }
    if (!abierto || abierto.ids.includes(ia)) out.push(linea);
  });
  if (abierto) throw new Error(`${archivo}:${abierto.linea}: bloque IA sin cerrar`);
  return out.join('\n');
}

export const tieneMarcadores = (texto) => texto.split('\n').some((l) => RE_INICIO.test(l) || RE_FIN.test(l));

function nombreCodex(agente) { return DATOS.agentes[agente]?.nombre_codex || agente.replace(/-/g, '_'); }

/** Reescrituras mecánicas de rutas y nombres. */
export function sustituir(texto, ia) {
  if (ia === 'claude') return texto.replace(/`CLAUDE\.md`, `AGENTS\.md`/g, '`CLAUDE.md`');
  let t = texto.replace(/`CLAUDE\.md`, `AGENTS\.md`/g, '`AGENTS.md`').replace(/\.claude\/skills/g, '.agents/skills');
  if (ia === 'codex') {
    t = t.replace(/\.claude\/agents\/([a-z0-9-]+)\.md/g, '.codex/agents/$1.toml').replace(/\.claude\/agents/g, '.codex/agents');
    for (const a of Object.keys(DATOS.agentes)) t = t.split('`' + a + '`').join('`' + nombreCodex(a) + '`');
  } else {
    t = t.replace(/\.claude\/agents\/([a-z0-9-]+)\.md/g, 'agentes/$1.md').replace(/\.claude\/agents/g, 'agentes');
  }
  return t.replace(/CLAUDE\.md/g, 'AGENTS.md');
}

/** Frontmatter YAML sencillo (clave: valor de una línea). */
export function leerFrontmatter(texto) {
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { campos: {}, cuerpo: texto };
  const campos = {};
  for (const linea of m[1].split('\n')) {
    const kv = linea.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"')) { try { v = JSON.parse(v); } catch { /* se deja tal cual */ } }
    else if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
    campos[kv[1]] = v;
  }
  return { campos, cuerpo: texto.slice(m[0].length) };
}

/** SKILL.md de Claude Code → formato estándar Agent Skills (solo name + description; fuera when_to_use y demás campos de Claude). */
export function skillEstandar(texto, nombre, descripcion) {
  const { campos, cuerpo } = leerFrontmatter(texto);
  const desc = descripcion || campos.description || '';
  return `---\nname: ${nombre}\ndescription: ${JSON.stringify(desc)}\n---\n${cuerpo.startsWith('\n') ? '' : '\n'}${cuerpo}`;
}

function cadenaTomlMultilinea(s) {
  if (!s.includes("'''")) return `'''\n${s}'''`;
  return `"""\n${s.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`;
}

/** Agente de Claude Code (.md con frontmatter) → custom agent de Codex (.toml). */
export function agenteToml(texto, agente) {
  const { campos, cuerpo } = leerFrontmatter(texto);
  const desc = DATOS.agentes[agente]?.descripcion || campos.description || '';
  const instrucciones = cuerpo.replace(/^\n+/, '').replace(/\s*$/, '\n');
  return `# Custom agent de Codex (generado por scripts/adaptar-ia.mjs en el paso 0 del onboarding).\n` +
    `name = ${JSON.stringify(nombreCodex(agente))}\n` +
    `description = ${JSON.stringify(desc)}\n` +
    `developer_instructions = ${cadenaTomlMultilinea(instrucciones)}\n`;
}

/** Agente de Claude Code → checklist en Markdown para cualquier IA (sin frontmatter, con el "cuándo" arriba). */
export function agenteDoc(texto, agente) {
  const { campos, cuerpo } = leerFrontmatter(texto);
  const desc = DATOS.agentes[agente]?.descripcion || campos.description || '';
  const nota = `> **Cuándo:** ${desc}\n>\n> Si tu IA puede lanzar subagentes, dale este archivo como instrucciones; si no, sigue tú este checklist.\n`;
  const lineas = cuerpo.replace(/^\n+/, '').split('\n');
  const h1 = lineas.findIndex((l) => l.startsWith('# '));
  if (h1 === -1) return `# ${agente}\n\n${nota}\n${lineas.join('\n')}`;
  lineas.splice(h1 + 1, 0, '', nota.replace(/\n$/, ''));
  return lineas.join('\n');
}

/** Términos que no deberían quedar en los documentos de trabajo de cada IA. */
export const TERMINOS_AJENOS = {
  claude: [/\bCodex\b/, /AGENTS\.md/, /\.agents\//, /\.codex\//, /\bCursor\b/, /Gemini CLI/, /Antigravity/],
  codex: [/\bClaude\b/, /CLAUDE\.md/, /\.claude\//, /\bCursor\b/, /Gemini CLI/, /Antigravity/],
  otra: [/\bClaude\b/, /CLAUDE\.md/, /\.claude\//, /\bCodex\b/, /\.codex\//],
};

/** Lista de { ruta, linea, termino, texto } con menciones ajenas en los archivos finales. */
export function revisar(archivos, ia) {
  const hallazgos = [];
  for (const { ruta, contenido } of archivos) {
    contenido.split('\n').forEach((l, i) => {
      const re = TERMINOS_AJENOS[ia].find((x) => x.test(l));
      if (re) hallazgos.push({ ruta, linea: i + 1, termino: re.source, texto: l.trim().slice(0, 140) });
    });
  }
  return hallazgos;
}

// ------------------------------------------------------------------ sistema de archivos
const EXCLUIR_DIRS = new Set(['node_modules', 'vendor', '.git', '.cache', 'renders', '.hyperframes', 'scripts', 'proyectos', 'prompts']);
const EXCLUIR_ARCH = new Set(['package.json', 'package-lock.json', 'estado-onboarding.json', 'PROMPT-INSTALACION.md', 'skills-lock.json']);
const ES_TEXTO = (n) => /\.(md|json|toml|txt|ya?ml)$/.test(n) || n === '.gitignore';
const SKILL_DIRS = ['.claude/skills', '.agents/skills'];
const rel = (raiz, p) => relative(raiz, p).split(sep).join('/');

/** Archivos de texto que el script gestiona (rutas relativas). Las skills ajenas (oficiales de Hyperframes/GSAP) no se tocan. */
export function archivosGestionados(raiz) {
  const out = [];
  const nuestras = new Set(Object.keys(DATOS.skills));
  const recorrer = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const r = rel(raiz, p);
      if (statSync(p).isDirectory()) {
        if (EXCLUIR_DIRS.has(n)) continue;
        const padre = rel(raiz, d);
        if (SKILL_DIRS.includes(padre) && !nuestras.has(n)) continue;
        recorrer(p);
        continue;
      }
      if (ES_TEXTO(n) && !EXCLUIR_ARCH.has(n)) out.push(r);
    }
  };
  recorrer(raiz);
  return out.sort();
}

const leerJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const listar = (p) => (existsSync(p) ? readdirSync(p).filter((n) => !n.startsWith('.')) : []);

/** 'fuente' (sin adaptar) o la IA para la que ya está adaptado. */
export function detectar(raiz) {
  const est = leerJson(join(raiz, 'estado-onboarding.json'));
  if (est?.pasos?.['0_ia']?.hecho && IAS.includes(est.agente)) return est.agente;
  const c = existsSync(join(raiz, 'CLAUDE.md')), a = existsSync(join(raiz, 'AGENTS.md'));
  if (c && a) return 'fuente';
  if (c) return 'claude';
  if (existsSync(join(raiz, '.codex/agents'))) return 'codex';
  if (a) return 'otra';
  return 'desconocido';
}

/** Calcula el plan sin tocar nada: { acciones, avisos, finales, revisar }. */
export function planificar(raiz, ia) {
  if (!IAS.includes(ia)) throw new Error(`--ia tiene que ser una de: ${IAS.join(', ')}`);
  const estado = detectar(raiz);
  if (estado !== 'fuente' && estado !== ia) {
    const e = new Error(`Este repo ya está adaptado para ${NOMBRES[estado] || estado}. Para cambiar de IA, clona el repo de nuevo en otra carpeta (o recupera los archivos con git) y vuelve a hacer el paso 0.`);
    e.codigo = 2; throw e;
  }
  const acciones = [], avisos = [];
  const A = (a) => acciones.push(a);
  const existe = (r) => existsSync(join(raiz, r));
  const guia = ia === 'claude' ? 'CLAUDE.md' : 'AGENTS.md';
  if (!existe(guia)) { const e = new Error(`Falta ${guia}: no se puede adaptar para ${NOMBRES[ia]}.`); e.codigo = 2; throw e; }

  // 1. Movimientos y conversiones de skills y agentes
  const destinoDe = new Map();          // ruta origen relativa → ruta destino relativa (para archivos de texto)
  const borrados = new Set();
  if (ia === 'claude') {
    for (const d of listar(join(raiz, '.agents/skills'))) {
      if (existe(`.claude/skills/${d}`)) { avisos.push(`.agents/skills/${d} ya está en .claude/skills/: se deja sin tocar`); continue; }
      A({ tipo: 'mover', de: `.agents/skills/${d}`, a: `.claude/skills/${d}` });
      for (const f of archivosBajo(raiz, `.agents/skills/${d}`)) destinoDe.set(f, f.replace(/^\.agents\/skills\//, '.claude/skills/'));
    }
    for (const d of ['.codex', 'agentes', '.cursor', '.gemini']) if (existe(d)) avisos.push(`${d}/ existe y es de otra IA o tuyo: no lo toco`);
  } else {
    for (const d of listar(join(raiz, '.claude/skills'))) {
      if (existe(`.agents/skills/${d}`)) { avisos.push(`.claude/skills/${d} ya existe en .agents/skills/: se deja sin tocar`); continue; }
      A({ tipo: 'mover', de: `.claude/skills/${d}`, a: `.agents/skills/${d}` });
      for (const f of archivosBajo(raiz, `.claude/skills/${d}`)) destinoDe.set(f, f.replace(/^\.claude\/skills\//, '.agents/skills/'));
    }
    for (const n of listar(join(raiz, '.claude/agents')).filter((n) => n.endsWith('.md'))) {
      const agente = n.replace(/\.md$/, '');
      const de = `.claude/agents/${n}`;
      const a = ia === 'codex' ? `.codex/agents/${agente}.toml` : `agentes/${agente}.md`;
      if (existe(a)) { avisos.push(`${a} ya existe: no se sobrescribe`); continue; }
      const contenido = sustituir(resolverMarcadores(readFileSync(join(raiz, de), 'utf8'), ia, de), ia);
      A({ tipo: 'convertir', de, a, contenido: ia === 'codex' ? agenteToml(contenido, agente) : agenteDoc(contenido, agente) });
      borrados.add(de);
    }
  }

  // 2. Borrados
  const borrar = (r, motivo) => { if (existe(r)) { A({ tipo: 'borrar', ruta: r, motivo }); borrados.add(r); } };
  if (ia === 'claude') borrar('AGENTS.md', 'guía de otras IA');
  else borrar('CLAUDE.md', 'guía de Claude Code');
  borrar('PROMPT-INSTALACION.md', 'prompts de instalación: solo sirven antes de clonar');
  borrar('prompts', 'prompts de instalación: solo sirven antes de clonar');
  if (ia !== 'claude') {
    // .claude/ entero solo si queda vacío tras mover skills y agentes (si hay algo tuyo, p. ej. settings.local.json, se queda)
    const restos = archivosBajo(raiz, '.claude').filter((f) => !destinoDe.has(f) && !borrados.has(f));
    if (restos.length) avisos.push(`.claude/ conserva archivos que no son de este repo: ${restos.join(', ')}`);
    else if (existe('.claude')) A({ tipo: 'borrar', ruta: '.claude', motivo: 'queda vacía' });
  }
  // (con claude, .agents/ se borra al final solo si queda vacía tras mover sus skills: lo hace aplicar())

  // 3. Reescrituras de texto (marcadores, rutas, cabecera de la guía, frontmatter de skills)
  const finales = [];
  for (const r of archivosGestionados(raiz)) {
    if (!destinoDe.has(r) && (borrados.has(r) || [...borrados].some((b) => r.startsWith(b + '/')))) continue;
    const destino = destinoDe.get(r) || r;
    const original = readFileSync(join(raiz, r), 'utf8');
    let t = sustituir(resolverMarcadores(original, ia, r), ia);
    if (r === guia) t = CABECERAS[ia] + t.slice(t.search(/^## /m));
    const skill = destino.match(/^\.(?:agents|claude)\/skills\/([^/]+)\/SKILL\.md$/);
    if (skill && ia !== 'claude' && DATOS.skills[skill[1]]) t = skillEstandar(t, skill[1], DATOS.skills[skill[1]].descripcion);
    finales.push({ ruta: destino, contenido: t });
    if (t !== original) A({ tipo: 'reescribir', ruta: destino, contenido: t, motivo: motivoCambio(original, t, r === guia) });
  }
  for (const a of acciones) if (a.tipo === 'convertir') finales.push({ ruta: a.a, contenido: a.contenido });

  // 4. Estado
  const est = leerJson(join(raiz, 'estado-onboarding.json'));
  if (!(est?.agente === ia && est?.pasos?.['0_ia']?.hecho)) A({ tipo: 'estado', ruta: 'estado-onboarding.json' });

  const pendientes = revisar(finales, ia);
  return { ia, guia, acciones, avisos, finales, revisar: pendientes };
}

function motivoCambio(antes, despues, esGuia) {
  const m = [];
  if (esGuia) m.push('cabecera de la IA');
  if (tieneMarcadores(antes)) m.push('bloques de otras IA fuera');
  if (/\.claude\/|CLAUDE\.md|AGENTS\.md|`video-/.test(antes) && !esGuia) m.push('rutas y nombres');
  if (/^---\n/.test(antes) && antes.split('\n---')[0] !== despues.split('\n---')[0]) m.push('frontmatter estándar');
  return m.join(', ') || 'rutas';
}

function archivosBajo(raiz, r) {
  const base = join(raiz, r);
  if (!existsSync(base)) return [];
  if (!statSync(base).isDirectory()) return [r];
  const out = [];
  const rec = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? rec(p) : out.push(rel(raiz, p)); } };
  rec(base);
  return out;
}

/** Archivos que el plan toca y que tienen cambios locales sin commitear (solo si es un repo git). */
export function cambiosLocales(raiz, plan) {
  if (!existsSync(join(raiz, '.git'))) return [];
  const g = spawnSync('git', ['status', '--porcelain'], { cwd: raiz, encoding: 'utf8' });
  if (g.status !== 0) return [];
  const tocados = plan.acciones.flatMap((a) => [a.ruta, a.de].filter(Boolean));
  return g.stdout.split('\n').filter((l) => l && !l.startsWith('??')).map((l) => l.slice(3).trim())
    .filter((f) => tocados.some((t) => f === t || f.startsWith(t + '/')));
}

/** Ejecuta el plan en orden: mover → convertir → reescribir → borrar → estado. */
export function aplicar(raiz, plan, hoy = new Date().toISOString().slice(0, 10)) {
  const P = (r) => join(raiz, r);
  for (const a of plan.acciones.filter((x) => x.tipo === 'mover')) { mkdirSync(dirname(P(a.a)), { recursive: true }); renameSync(P(a.de), P(a.a)); }
  for (const a of plan.acciones.filter((x) => x.tipo === 'convertir')) { mkdirSync(dirname(P(a.a)), { recursive: true }); writeFileSync(P(a.a), a.contenido); rmSync(P(a.de)); }
  for (const a of plan.acciones.filter((x) => x.tipo === 'reescribir')) writeFileSync(P(a.ruta), a.contenido);
  for (const a of plan.acciones.filter((x) => x.tipo === 'borrar')) rmSync(P(a.ruta), { recursive: true, force: true });
  for (const d of ['.claude/agents', '.claude/skills', '.claude', '.agents/skills', '.agents']) {
    if (existsSync(P(d)) && statSync(P(d)).isDirectory() && readdirSync(P(d)).length === 0) rmSync(P(d), { recursive: true });
  }
  if (plan.acciones.some((x) => x.tipo === 'estado')) {
    const ruta = P('estado-onboarding.json');
    const plantilla = P('plantillas/estado-onboarding.plantilla.json');
    const est = leerJson(ruta) || leerJson(plantilla) || { version: 1, pasos: {} };
    est.agente = plan.ia;
    const pasos = { '0_ia': { hecho: true, fecha: hoy, ia: plan.ia, guia: plan.guia, revisar: plan.revisar.map((h) => `${h.ruta}:${h.linea}`) } };
    for (const [k, v] of Object.entries(est.pasos || {})) if (k !== '0_ia') pasos[k] = v;
    est.pasos = pasos;
    writeFileSync(ruta, JSON.stringify(est, null, 2) + '\n');
  }
}

export function textoPlan(plan) {
  const L = [`Adaptar el repo a: ${NOMBRES[plan.ia]} (guía: ${plan.guia})`];
  const cambios = plan.acciones;
  if (!cambios.length) L.push('Nada que hacer: el repo ya está adaptado así.');
  else {
    L.push(`Plan (${cambios.length} cambios):`);
    for (const a of cambios) {
      if (a.tipo === 'mover') L.push(`  mover       ${a.de}  →  ${a.a}`);
      else if (a.tipo === 'convertir') L.push(`  convertir   ${a.de}  →  ${a.a}`);
      else if (a.tipo === 'borrar') L.push(`  borrar      ${a.ruta}  (${a.motivo})`);
      else if (a.tipo === 'reescribir') L.push(`  reescribir  ${a.ruta}  (${a.motivo})`);
      else if (a.tipo === 'estado') L.push(`  anotar      estado-onboarding.json → agente y pasos.0_ia`);
    }
  }
  for (const a of plan.avisos) L.push(`[aviso] ${a}`);
  if (plan.revisar.length) {
    L.push(`Para revisar a mano (menciones de otras IA que el script no resuelve):`);
    for (const h of plan.revisar) L.push(`  ${h.ruta}:${h.linea}  ${h.texto}`);
  } else L.push('Para revisar a mano: nada (no quedan menciones de otras IA en los documentos de trabajo).');
  return L.join('\n');
}

function main(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
  const ia = arg('--ia');
  const raiz = resolve(arg('--raiz') || RAIZ_REPO);
  const seco = argv.includes('--dry-run');
  if (!ia || argv.includes('--help')) {
    console.log('Uso: node scripts/adaptar-ia.mjs --ia claude|codex|otra [--dry-run] [--forzar] [--raiz <carpeta>]');
    process.exit(ia ? 0 : 1);
  }
  let plan;
  try { plan = planificar(raiz, ia); } catch (e) { console.error(e.message); process.exit(e.codigo || 1); }
  console.log(textoPlan(plan));
  if (seco) { console.log('\n(--dry-run: no se cambió nada)'); return; }
  if (!plan.acciones.length) return;
  const locales = cambiosLocales(raiz, plan);
  if (locales.length && !argv.includes('--forzar')) {
    console.error(`\nHay cambios sin guardar en archivos que tocaría: ${locales.join(', ')}.\nNo se cambió nada. Revísalos con la persona; si da igual perderlos, repite con --forzar.`);
    process.exit(3);
  }
  aplicar(raiz, plan);
  console.log(`\nHecho. Abre una sesión nueva de ${ia === 'otra' ? 'tu IA' : NOMBRES[ia]} en esta carpeta cuando termine el onboarding: la guía, las skills y los agentes se leen al empezar la sesión.`);
}

const esPrincipal = () => { try { return realpathSync(process.argv[1] || '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (esPrincipal()) main(process.argv.slice(2));
