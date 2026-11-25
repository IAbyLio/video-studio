#!/usr/bin/env node
// nuevo-proyecto.mjs — crea proyectos/<slug>/ a partir del estilo elegido, con TU marca ya puesta.
//
//   node scripts/nuevo-proyecto.mjs <slug> --estilo <id> [--formato reel] [--titulo "Nombre legible"]
//   node scripts/nuevo-proyecto.mjs --estilos          (lista los estilos del catálogo)
//
// Qué hace: copia el ejemplo del estilo (estilos/<id>/ejemplo, o proyectos/_plantilla si el estilo es "libre"),
// actualiza meta.json, reemplaza el bloque de marca del index.html por marca/marca.css (si todavía no existe, deja la
// neutra y avisa), copia las fuentes de marca/fuentes/ a assets/fuentes/ y escribe un BRIEF.md con el estilo y el
// bloque "## Zona segura" del formato elegido. No toca nada fuera de proyectos/<slug>/.
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATOS as ZONAS, rectSeguro } from './zonas-seguras.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const INI = '/* MARCA:INICIO (lo reemplaza scripts/nuevo-proyecto.mjs con marca/marca.css) */';
const FIN = '/* MARCA:FIN */';

export function validarSlug(slug) {
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) throw new Error('el nombre del proyecto va en minúsculas, números y guiones (ej. "mi-primer-reel")');
  if (slug.startsWith('_')) throw new Error('los nombres que empiezan por "_" están reservados');
  return slug;
}

/** Reemplaza lo que hay entre los marcadores MARCA:INICIO y MARCA:FIN del <style id="marca">. */
export function inyectarMarca(html, css) {
  const i = html.indexOf('/* MARCA:INICIO');
  const f = html.indexOf(FIN);
  if (i < 0 || f < 0 || f < i) throw new Error('el index.html no tiene el bloque /* MARCA:INICIO */ … /* MARCA:FIN */');
  const cuerpo = css.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '').trim();   // sin el comentario de cabecera del css
  return html.slice(0, i) + INI + '\n' + cuerpo + '\n' + html.slice(f);
}

/** url("fuentes/x.woff2") del css de marca → url("assets/fuentes/x.woff2") dentro del proyecto. */
export function reescribirFuentes(css) {
  return css.replace(/url\((["']?)fuentes\//g, 'url($1assets/fuentes/');
}

export function bloqueZonaSegura(formato) {
  const f = ZONAS.formats[formato];
  if (!f) throw new Error(`formato desconocido: ${formato} (node scripts/zonas-seguras.mjs --list)`);
  const [l, t, r, b] = rectSeguro(f);
  const extra = f.prohibida.filter((z) => z.rect[2] < f.base.w && z.rect[3] < f.base.h)
    .map((z) => `nada en x ${z.rect[0]}–${z.rect[0] + z.rect[2]} entre y ${z.rect[1]}–${z.rect[1] + z.rect[3]} (${z.name})`);
  const centro = f.base.w / 2;
  return [
    '## Zona segura',
    `- Destino: ${f.label} → \`--format ${formato}\` (lienzo ${f.base.w}x${f.base.h})`,
    `- Zona segura: x ${l}–${r} · y ${t}–${b}${extra.length ? ' · ' + extra.join(' · ') : ''}`,
    `- Lo centrado se centra en x = ${centro}${formato === 'reel' || formato === 'ad-vertical' ? ' (ancho máximo 710 px: x 185–895)' : ''}`,
    formato === 'reel' ? '- Primer fotograma y portada: lo que tenga que leerse, entre y 240 e y 1470' : null,
    '- Bandas fijas de esta pieza: (captions, personaje, CTA: completar antes de construir)',
  ].filter(Boolean).join('\n');
}

export function catalogo() {
  return JSON.parse(readFileSync(join(RAIZ, 'estilos/catalogo.json'), 'utf8')).estilos;
}

function origenDe(estilo) {
  const e = catalogo().find((x) => x.id === estilo);
  if (!e) throw new Error(`estilo desconocido: ${estilo}. Disponibles: ${catalogo().map((x) => x.id).join(', ')}`);
  return { e, dir: e.id === 'libre' ? join(RAIZ, 'proyectos/_plantilla') : join(RAIZ, e.carpeta, 'ejemplo') };
}

function main(argv) {
  if (argv.includes('--estilos')) {
    for (const e of catalogo()) console.log(`${e.id.padEnd(20)} ${e.estado.padEnd(13)} ${e.nombre}: ${e.una_linea}`);
    return;
  }
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const valores = new Set(['--estilo', '--formato', '--titulo'].map((k) => argv.indexOf(k)).filter((i) => i >= 0).map((i) => i + 1));
  const slug = validarSlug(argv.find((a, i) => !a.startsWith('--') && !valores.has(i)));
  const estilo = get('--estilo') || 'libre';
  const formato = get('--formato') || 'reel';
  const { e, dir: origen } = origenDe(estilo);
  if (!existsSync(origen)) throw new Error(`el estilo ${estilo} no tiene ejemplo en ${origen}`);
  const destino = join(RAIZ, 'proyectos', slug);
  if (existsSync(destino)) throw new Error(`ya existe proyectos/${slug}: elige otro nombre o sigue trabajando en ese`);

  cpSync(origen, destino, { recursive: true, filter: (src) => !/[\\/](renders|\.hyperframes|node_modules)([\\/]|$)/.test(src) && !src.endsWith('miniatura.png') });

  const zona = ZONAS.formats[formato];
  if (!zona) throw new Error(`formato desconocido: ${formato}`);
  const metaPath = join(destino, 'meta.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  Object.assign(meta, { id: slug, name: get('--titulo') || slug, width: zona.base.w, height: zona.base.h });
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

  const marcaPath = join(RAIZ, 'marca/marca.css');
  const tieneMarca = existsSync(marcaPath);
  const css = reescribirFuentes(readFileSync(tieneMarca ? marcaPath : join(RAIZ, 'marca/marca.neutra.css'), 'utf8'));
  const indexPath = join(destino, 'index.html');
  let html = inyectarMarca(readFileSync(indexPath, 'utf8'), css);
  if (zona.base.w !== 1080 || zona.base.h !== 1920) {
    html = html.replace(/data-width="1080"/, `data-width="${zona.base.w}"`).replace(/data-height="1920"/, `data-height="${zona.base.h}"`);
  }
  writeFileSync(indexPath, html);
  const fuentes = join(RAIZ, 'marca/fuentes');
  if (existsSync(fuentes) && readdirSync(fuentes).length) cpSync(fuentes, join(destino, 'assets/fuentes'), { recursive: true });
  // logos de la marca (marca/logo*.svg|png) también viajan con el proyecto: cada proyecto es portable
  for (const f of readdirSync(join(RAIZ, 'marca'))) if (/^logo.*\.(svg|png|webp)$/i.test(f)) cpSync(join(RAIZ, 'marca', f), join(destino, 'assets', f));

  const brief = readFileSync(join(RAIZ, 'plantillas/BRIEF.plantilla.md'), 'utf8')
    .replace('{{TITULO}}', get('--titulo') || slug).replace('{{ESTILO}}', `${e.nombre} (\`${e.id}\`, ${e.estado})`)
    .replace('{{NECESITA}}', e.necesita.length ? e.necesita.map((n) => `- ${n}`).join('\n') : '- nada extra')
    .replace('{{ZONA_SEGURA}}', bloqueZonaSegura(formato));
  writeFileSync(join(destino, 'BRIEF.md'), brief);

  console.log(`proyecto creado: proyectos/${slug}/ (estilo ${e.id}, formato ${formato})`);
  if (!tieneMarca) console.log('AVISO: todavía no hay marca/marca.css: se usó la identidad neutra. Haz el paso de marca de ONBOARDING.md.');
  if (zona.base.w !== 1080 || zona.base.h !== 1920) console.log(`AVISO: el ejemplo está compuesto para 9:16; en ${zona.base.w}x${zona.base.h} hay que recolocar los elementos.`);
  console.log(`siguiente: cd proyectos/${slug} && npx hyperframes lint && npx hyperframes preview`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (err) { console.error(err.message); process.exit(1); }
}
