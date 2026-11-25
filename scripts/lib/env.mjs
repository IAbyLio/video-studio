// env.mjs — lee el .env de la raíz del repo sin pisar variables que ya estén en el entorno y sin imprimir valores.
// Las claves las escribe la persona en .env (ignorado por git). Ningún script de este repo las muestra ni las sube.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
export const ENV_PATH = fileURLToPath(new URL('../../.env', import.meta.url));

/** Carga solo las claves pedidas (o todas si no se pasa lista). Devuelve las que quedaron definidas (sin valores). */
export function cargarEnv(claves = null, { path = ENV_PATH, env = process.env } = {}) {
  if (!existsSync(path)) return [];
  const local = parseEnv(readFileSync(path, 'utf8'));
  const cargadas = [];
  for (const [k, v] of Object.entries(local)) {
    if (claves && !claves.includes(k)) continue;
    if (env[k] === undefined && v !== '') { env[k] = v; cargadas.push(k); }
  }
  return cargadas;
}

/** "sk_abc…xyz" → "sk_a…(41 caracteres)": para confirmar que hay algo sin enseñar la clave. */
export function enmascarar(v) {
  if (!v) return '(vacía)';
  return `${v.slice(0, 3)}…(${v.length} caracteres)`;
}
