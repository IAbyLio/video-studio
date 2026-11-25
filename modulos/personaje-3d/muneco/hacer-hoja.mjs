#!/usr/bin/env node
// hacer-hoja.mjs — regenera hoja-modelo.png: todas las poses del muñeco (cada una con una expresión) en una lámina.
// Sirve para revisar una pose nueva sin renderizar un vídeo. Arma un proyecto Hyperframes temporal (fuera del repo)
// con las piezas del muñeco y saca una foto con `npx hyperframes snapshot`.
//   node modulos/personaje-3d/muneco/hacer-hoja.mjs [--salida modulos/personaje-3d/muneco/hoja-modelo.png]
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
const argv = process.argv.slice(2);
const salida = resolve(argv[argv.indexOf('--salida') + 1] && argv.includes('--salida') ? argv[argv.indexOf('--salida') + 1] : join(AQUI, 'hoja-modelo.png'));

const datos = JSON.parse(readFileSync(join(AQUI, 'poses.json'), 'utf8'));
const EXPR = { reposo: 'neutro', saluda: 'contento', 'senalar-der': 'neutro', 'senalar-izq': 'duda', pensar: 'pensativo', celebrar: 'contento', sorpresa: 'sorpresa', caminar: 'guino' };
const poses = Object.keys(datos.poses);
const W = 1600, H = 1100, cols = 4, filas = Math.ceil(poses.length / cols);

const dir = mkdtempSync(join(tmpdir(), 'hoja-muneco-'));
try {
  mkdirSync(join(dir, 'assets/vendor/three'), { recursive: true });
  for (const f of ['three.module.min.js', 'three.core.min.js']) copyFileSync(join(RAIZ, 'vendor/three', f), join(dir, 'assets/vendor/three', f));
  copyFileSync(join(RAIZ, 'scripts/personaje/cara.js'), join(dir, 'assets/cara.js'));
  copyFileSync(join(AQUI, 'personaje.js'), join(dir, 'assets/personaje.js'));
  writeFileSync(join(dir, 'assets/poses-data.js'), `window.MUNECO_POSES = ${JSON.stringify(datos)};\n`);
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id: 'hoja', name: 'hoja', width: W, height: H, fps: 30 }));
  writeFileSync(join(dir, 'hyperframes.json'), readFileSync(join(AQUI, 'demo/hyperframes.json')));
  const etiquetas = poses.map((p, i) => {
    const x = (i % cols) * (W / cols), y = Math.floor(i / cols) * (H / filas);
    return `<div class="et" style="left:${x}px;top:${y + H / filas - 58}px;width:${W / cols}px">${p} · ${EXPR[p] || 'neutro'}</div>`;
  }).join('\n');
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="assets/cara.js"></script><script src="assets/poses-data.js"></script><script src="assets/personaje.js"></script>
<script type="importmap">{ "imports": { "three": "./assets/vendor/three/three.module.min.js" } }</script>
<style>html,body{margin:0;background:#111318;width:${W}px;height:${H}px;overflow:hidden}#gl{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.et{position:absolute;text-align:center;font:500 24px Menlo,monospace;color:#9aa0aa}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="${W}" data-height="${H}">
<canvas id="gl" class="clip" data-start="0" data-duration="1" data-track-index="0" width="${W}" height="${H}"></canvas>
<div class="clip" data-start="0" data-duration="1" data-track-index="1">${etiquetas}</div></div>
<script>window.__timelines={};const tl=gsap.timeline({paused:true});tl.set({},{},1);window.__timelines["main"]=tl;</script>
<script type="module">
import * as THREE from "three";
const W=${W},H=${H},cols=${cols},filas=${filas},PPU=260;
const r=new THREE.WebGLRenderer({canvas:document.getElementById("gl"),antialias:true,alpha:true,preserveDrawingBuffer:true});
r.setPixelRatio(1);r.setSize(W,H,false);r.toneMapping=THREE.NeutralToneMapping;r.outputColorSpace=THREE.SRGBColorSpace;
const s=new THREE.Scene();s.add(Personaje.luces(THREE));
const cam=new THREE.OrthographicCamera(-W/2/PPU,W/2/PPU,H/2/PPU,-H/2/PPU,0.1,50);cam.position.set(0,0,10);
const poses=${JSON.stringify(poses)},expr=${JSON.stringify(EXPR)};
poses.forEach((p,i)=>{const m=Personaje.crear(THREE,{});m.posar({pose:p,expresion:expr[p]||"neutro",t:0.5});
const k=(H/filas-90)/PPU/m.alto;m.grupo.scale.setScalar(k);
m.grupo.position.set(((i%cols)+0.5)*(W/cols)/PPU-W/2/PPU,H/2/PPU-(Math.floor(i/cols)+1)*(H/filas)/PPU+70/PPU,0);s.add(m.grupo);});
r.render(s,cam);
</script></body></html>`);
  const out = join(dir, 'snap');
  const res = spawnSync('npx', ['hyperframes', 'snapshot', '--at', '0.5', '--no-end', '--output', out], { cwd: dir, encoding: 'utf8', env: { ...process.env, DO_NOT_TRACK: '1' } });
  const png = readdirSync(out).find((f) => f.endsWith('.png') && !f.includes('sheet') && !f.includes('contact'));
  if (res.status !== 0 || !png) { console.error(res.stdout + res.stderr); process.exit(1); }
  copyFileSync(join(out, png), salida);
  console.log(`hoja: ${salida}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
