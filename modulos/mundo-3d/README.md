# Mundo 3D (Three.js dentro de Hyperframes)

Escenas 3D de verdad (geometría, luz, sombras, cámara) renderizadas dentro del vídeo, deterministas: el mismo fotograma siempre, vayas hacia adelante o hacia atrás. Gratis, sin créditos. Ejemplo listo para clonar: `estilos/mundo-3d/` (y el narrador de `estilos/personaje-narrador/` vive en el mismo motor).

## El contrato (lo que hace que funcione en un render)
- **Three.js vendorizado** en el proyecto (`assets/vendor/three/`, con su licencia MIT). Nada de CDN durante el render. La copia maestra está en `vendor/three/` (r185); `scripts/sincronizar-copias.mjs` la copia a los ejemplos.
- **GSAP es el único reloj:** el `index.html` anima un valor de tiempo (`window.__P.time`) y en cada actualización llama a `window.__r3d(t)`. Tu `world3d.js` solo expone `renderAt(t)`.
- `renderAt(t)` es **función pura de t**: cámara, luces y objetos salen de `t`. Sin `requestAnimationFrame`, sin `THREE.Clock`, sin `Date.now`, sin `Math.random` (PRNG con semilla), sin estado que se acumule entre fotogramas.
- Renderer con `preserveDrawingBuffer: true`, pixel ratio 1 y tamaño = `data-width`/`data-height` del root.
- Si hornéas texto en un canvas, espera `document.fonts.ready` y redibuja.
- Colores desde la marca: `getComputedStyle(document.documentElement).getPropertyValue('--acento')`.

```html
<script type="importmap">{ "imports": { "three": "./assets/vendor/three/three.module.min.js" } }</script>
<div id="gl" class="clip" data-start="0" data-duration="5" data-track-index="0"></div>
<script>
  window.__P = { time: 0 };
  tl.to(window.__P, { time: 5, duration: 5, ease: "none", onUpdate: () => window.__r3d && window.__r3d(window.__P.time) }, 0);
</script>
<script type="module" src="./assets/world3d.js"></script>
```

## Mundo-metáfora
Un solo mundo 3D que **es** la metáfora del tema (un camino con paradas, una línea de montaje, una casa que se construye por pisos) y la cámara lo recorre parada por parada al ritmo de la voz. Cada parada = una pieza del guion (ver `analisis-viralidad`, estructura de 8 piezas). Es el estilo más caro de construir (sin créditos, pero lleva tiempo): úsalo con un proceso de N pasos que tenga metáfora física clara.

## Comprobaciones
- Mismo fotograma en `t` llegando directo y tras saltar adelante y atrás (`npx hyperframes snapshot --at 3,1,3`).
- Objetos dentro de la zona segura en **todo** el recorrido de cámara (los acercamientos son el caso de riesgo); el piso y el cielo son fondo y pueden llegar a los bordes.
- Una vista previa lenta con WebGL no significa que el render falle: juzga el borrador renderizado.
- Tarjetas de vidrio sobre el 3D: el vidrio refracta lo que hay debajo, incluido el canvas (ver `estilos/liquid-glass/`).
