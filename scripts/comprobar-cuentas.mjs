#!/usr/bin/env node
// comprobar-cuentas.mjs — revisa las claves de .env SIN mostrarlas y SIN gastar.
//   Sin flags: solo formato (¿está?, ¿tiene pinta de clave?). No usa la red.
//   --en-linea: una consulta GRATUITA por cuenta presente (datos de la cuenta / saldo). Nunca genera nada.
// CLI: node scripts/comprobar-cuentas.mjs [--en-linea] [--json]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEnv, enmascarar, ENV_PATH } from './lib/env.mjs';
import { existsSync } from 'node:fs';

export const CUENTAS = {
  ELEVENLABS_API_KEY: { servicio: 'ElevenLabs (voz y SFX generados)', formato: /^sk_[A-Za-z0-9]{20,}$/, pista: 'empieza por sk_',
    probar: async (k) => {
      const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': k } });
      if (!r.ok) return { ok: false, detalle: `HTTP ${r.status}` };
      const j = await r.json();
      return { ok: true, detalle: `plan ${j.tier ?? '?'} · caracteres usados ${j.character_count ?? '?'} de ${j.character_limit ?? '?'}` };
    } },
  HEYGEN_API_KEY: { servicio: 'HeyGen (avatar de vídeo)', formato: /^[A-Za-z0-9_\-=]{20,}$/, pista: 'cadena larga sin espacios',
    probar: async (k) => {
      const r = await fetch('https://api.heygen.com/v2/user/remaining_quota', { headers: { 'X-Api-Key': k } });
      if (!r.ok) return { ok: false, detalle: `HTTP ${r.status}` };
      const j = await r.json();
      return { ok: true, detalle: `cuota restante ${j?.data?.remaining_quota ?? '?'}` };
    } },
  HIGGSFIELD_API_KEY: { servicio: 'Higgsfield (ganchos con IA de vídeo)', formato: /^\S{16,}$/, pista: 'cadena sin espacios', probar: null },
  FAL_KEY: { servicio: 'fal.ai (modelos de vídeo, p. ej. Seedance)', formato: /^\S+:\S+$|^\S{20,}$/, pista: 'id:secreto', probar: null },
  REPLICATE_API_TOKEN: { servicio: 'Replicate (modelos de vídeo)', formato: /^r8_\S{20,}$/, pista: 'empieza por r8_',
    probar: async (k) => {
      const r = await fetch('https://api.replicate.com/v1/account', { headers: { Authorization: `Bearer ${k}` } });
      return r.ok ? { ok: true, detalle: `cuenta ${(await r.json()).username ?? '?'}` } : { ok: false, detalle: `HTTP ${r.status}` };
    } },
};

export function revisarFormato(nombre, valor) {
  const c = CUENTAS[nombre];
  if (!valor) return { presente: false };
  return { presente: true, formato_ok: c.formato.test(valor.trim()), espacios: /\s/.test(valor.trim()), muestra: enmascarar(valor.trim()), pista: c.pista };
}

async function main(argv) {
  const enLinea = argv.includes('--en-linea');
  if (!existsSync(ENV_PATH)) console.log('No hay .env todavía (copia .env.example como .env). Se revisan solo variables del entorno.');
  cargarEnv(Object.keys(CUENTAS));
  const out = {};
  for (const [nombre, c] of Object.entries(CUENTAS)) {
    const v = process.env[nombre];
    const r = { servicio: c.servicio, ...revisarFormato(nombre, v) };
    if (enLinea && r.presente && c.probar) {
      try { r.en_linea = await c.probar(v.trim()); } catch (e) { r.en_linea = { ok: false, detalle: `sin conexión (${e.cause?.code || e.message})` }; }
    } else if (enLinea && r.presente) r.en_linea = { ok: null, detalle: 'sin comprobación gratuita automática: se valida al usarla, con tu OK' };
    out[nombre] = r;
  }
  if (argv.includes('--json')) { console.log(JSON.stringify(out, null, 2)); return; }
  for (const [n, r] of Object.entries(out)) {
    if (!r.presente) { console.log(`${n.padEnd(20)} no configurada (${r.servicio})`); continue; }
    const f = r.formato_ok ? 'formato OK' : `formato raro (${r.pista}${r.espacios ? ', tiene espacios' : ''})`;
    console.log(`${n.padEnd(20)} ${r.muestra} · ${f}${r.en_linea ? ` · en línea: ${r.en_linea.ok === null ? '—' : r.en_linea.ok ? 'OK' : 'FALLA'} ${r.en_linea.detalle}` : ''}`);
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
