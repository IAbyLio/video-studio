/* =====================================================================
   world3d.js — mini mundo-metáfora de ejemplo: "el camino de tres pasos".
   Un camino que serpentea sobre un suelo con cuadrícula, con tres paradas numeradas. Un marcador recorre el camino
   y la cámara lo sigue parada por parada. Es el esqueleto del estilo: cambia el camino por la metáfora de tu tema
   (cinta transportadora, edificio por pisos, montaña rusa…) y las paradas por los pasos de tu guion.

   Contrato (determinismo de Hyperframes):
   - renderAt(t) es función PURA del tiempo: cámara, marcador, badges y luces salen de t. Sin requestAnimationFrame,
     sin THREE.Clock, sin Date.now ni Math.random, sin estado acumulado entre fotogramas (scrub hacia atrás sin drama).
   - GSAP conduce el tiempo: el index.html tween-ea window.__P.time y llama a window.__r3d(t) en onUpdate.
   - Renderer con preserveDrawingBuffer:true, pixel ratio 1 y tamaño = data-width/data-height del root.
   - Colores desde las variables CSS de marca (--fondo, --acento, …): si cambias la marca, cambia el mundo.
   - Three.js vendorizado en assets/vendor/three/ (MIT, LICENSE al lado). Nada de CDN en el render.
   ===================================================================== */
import * as THREE from "three";

const ROOT = document.querySelector("[data-composition-id]");
const W = Number(ROOT.dataset.width) || 1080;
const H = Number(ROOT.dataset.height) || 1920;
const DUR = Number(ROOT.dataset.duration) || 6;

const css = getComputedStyle(document.documentElement);
const v = (n, d) => (css.getPropertyValue(n).trim() || d);
const C = {
  fondo: v("--fondo", "#111318"), hondo: v("--fondo-hondo", "#0a0b0e"), sup: v("--superficie", "#1b1e25"),
  supAlta: v("--superficie-alta", "#252a33"), texto: v("--texto", "#f3f1ec"), suave: v("--texto-suave", "#9aa0aa"),
  acento: v("--acento", "#7aa2ff"), acento2: v("--acento-2", "#ffc857"), fuente: v("--fuente-titulos", "Arial, sans-serif"),
};

/* ---------------- helpers puros ---------------- */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const sm = (t, a, b) => eio(clamp01((t - a) / (b - a)));

/* ---------------- renderer y escena ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
document.getElementById("gl").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.hondo);
scene.fog = new THREE.Fog(C.hondo, 8, 21);
const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 80);

scene.add(new THREE.HemisphereLight(C.texto, C.hondo, 0.9));
const sol = new THREE.DirectionalLight(C.texto, 1.6);
sol.position.set(-5, 10, 6);
scene.add(sol);

/* ---------------- suelo con cuadrícula (textura procedural, una vez) ---------------- */
function texturaCuadricula() {
  const s = 512, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = C.fondo; g.fillRect(0, 0, s, s);
  g.strokeStyle = C.supAlta; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { const p = (i / 8) * s; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, s); g.moveTo(0, p); g.lineTo(s, p); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(12, 12);
  return tex;
}
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: texturaCuadricula(), roughness: 0.95 }));
suelo.rotation.x = -Math.PI / 2;
scene.add(suelo);

/* ---------------- el camino (la metáfora) ---------------- */
const curva = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 8), new THREE.Vector3(-1.6, 0, 4.5), new THREE.Vector3(1.4, 0, 1),
  new THREE.Vector3(-1.2, 0, -2.6), new THREE.Vector3(0.8, 0, -6), new THREE.Vector3(0, 0, -9),
]);
// cinta plana a lo largo de la curva
(function () {
  const N = 220, ancho = 0.9, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curva.getPointAt(u), tg = curva.getTangentAt(u);
    const lado = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(ancho / 2);
    pos.push(p.x + lado.x, 0.02, p.z + lado.z, p.x - lado.x, 0.02, p.z - lado.z);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: C.suave, transparent: true, opacity: 0.32, side: THREE.DoubleSide })));
})();

/* ---------------- paradas numeradas ---------------- */
function texturaNumero(n, fondo, tinta) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = fondo; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.fillStyle = tinta; g.font = `800 150px ${C.fuente}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(String(n), 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const PARADAS = [0.22, 0.52, 0.82].map((u, i) => {
  const p = curva.getPointAt(u), tg = curva.getTangentAt(u);
  const lado = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(i % 2 ? -0.95 : 0.95);   // al costado del camino
  const grupo = new THREE.Group(); grupo.position.set(p.x + lado.x, 0, p.z + lado.z);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 12), new THREE.MeshStandardMaterial({ color: C.suave }));
  poste.position.y = 0.65; grupo.add(poste);
  const disco = new THREE.Group(); disco.position.y = 1.55; grupo.add(disco);
  const canto = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 48), new THREE.MeshStandardMaterial({ color: C.supAlta }));
  canto.rotation.x = Math.PI / 2; disco.add(canto);
  const normal = new THREE.MeshBasicMaterial({ map: texturaNumero(i + 1, C.sup, C.texto) });
  const activo = new THREE.MeshBasicMaterial({ map: texturaNumero(i + 1, C.acento, C.fondo) });
  const cara = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), normal); cara.position.z = 0.065; disco.add(cara);
  scene.add(grupo);
  return { u, grupo, disco, cara, normal, activo };
});

/* ---------------- marcador que recorre el camino ---------------- */
const marcador = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 20), new THREE.MeshStandardMaterial({ color: C.acento2, emissive: C.acento2, emissiveIntensity: 0.35, roughness: 0.4 }));
scene.add(marcador);

// Guion de cámara: [t, u del camino]. Tres llegadas (una por parada), con pausa en cada una.
// En un vídeo real estos tiempos salen de la palabra que nombra cada paso (transcript de la voz).
const RECORRIDO = [[0, 0.04], [0.9, 0.22], [1.8, 0.22], [2.7, 0.52], [3.6, 0.52], [4.5, 0.82], [6, 0.86]];
function uEn(t) {
  for (let i = 0; i < RECORRIDO.length - 1; i++) {
    const [t0, u0] = RECORRIDO[i], [t1, u1] = RECORRIDO[i + 1];
    if (t <= t1) return lerp(u0, u1, eio(clamp01((t - t0) / (t1 - t0))));
  }
  return RECORRIDO[RECORRIDO.length - 1][1];
}

/* ---------------- renderAt(t) ---------------- */
function renderAt(t) {
  const tt = Math.max(0, Math.min(DUR, Number(t) || 0));
  const u = uEn(tt), p = curva.getPointAt(u), tg = curva.getTangentAt(u);
  marcador.position.set(p.x, 0.28 + 0.04 * Math.abs(Math.sin(tt * 9)), p.z);
  // cámara: encuadra a la vez el marcador y la parada más cercana (foco = punto medio), desde atrás y arriba
  let cerca = PARADAS[0];
  for (const s of PARADAS) if (Math.abs(u - s.u) < Math.abs(u - cerca.u)) cerca = s;
  const peso = 0.8 * clamp01(1 - Math.abs(u - cerca.u) / 0.22);
  const fx = lerp(p.x, cerca.grupo.position.x, peso), fz = lerp(p.z, cerca.grupo.position.z, peso);
  const atras = tg.clone().multiplyScalar(-7.2);
  camera.position.set(fx + atras.x, 5.2, fz + atras.z);
  camera.lookAt(fx, 1.1, fz - 0.6);
  // la parada a la que se llega se enciende (acento) y crece un poco
  for (const s of PARADAS) {
    const k = clamp01(1 - Math.abs(u - s.u) / 0.05);
    s.cara.material = k > 0.5 ? s.activo : s.normal;
    s.grupo.scale.setScalar(1 + 0.3 * eio(k));
    // el disco gira sobre su poste para mirar a la cámara (solo en Y: el número queda derecho)
    s.disco.rotation.y = Math.atan2(camera.position.x - s.grupo.position.x, camera.position.z - s.grupo.position.z);
  }
  renderer.render(scene, camera);
}

window.__r3d = renderAt;
renderAt(window.__P ? window.__P.time : 0);
document.fonts.ready.then(() => renderAt(window.__P ? window.__P.time : 0));
