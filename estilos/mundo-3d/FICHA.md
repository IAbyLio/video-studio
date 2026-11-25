# Mundo 3D / mundo-metáfora

**Estado: experimental.** La técnica de 3D determinista dentro de Hyperframes (Three.js conducido por el reloj de GSAP) se usó en piezas reales en el estudio del que sale este repo. El formato "un vídeo entero = un mundo que es la metáfora del tema" todavía no se validó en una pieza publicada: es una apuesta razonada. El ejemplo de esta carpeta es mínimo, se renderizó y se revisó fotograma a fotograma.

## Qué es

El vídeo entero sucede dentro de **un solo mundo 3D que representa la idea** (un camino, una cinta transportadora, un edificio que sube por pisos, una montaña rusa). La cámara lo recorre **parada por parada**, sincronizada con la voz: cada parada es un paso del guion, con su número y un objeto que lo simboliza. Sin cortes: un plano continuo que avanza.

El ejemplo: un camino con tres paradas numeradas; un marcador lo recorre, la parada a la que llega se enciende y el texto de arriba nombra el paso.

## Cuándo usarlo

- El guion explica **un proceso de N pasos** con una metáfora física clara ("primero… después… al final…").
- Quieres retención por movimiento, no por montaje: la cámara nunca para.
- Reels sin cara a cámara, o como fondo vivo detrás de otra capa (captions, tarjetas de vidrio, un personaje).

## Cuándo no

- Opinión pura o una sola idea sin pasos: el mundo no tiene qué recorrer.
- Datos finos que hay que leer (tablas, cifras largas): mejor una tarjeta o pantalla partida.
- Si no hay tiempo: es el estilo más caro de construir (sin créditos, pero con horas de código y ajuste de cámara).

## Qué necesita

- Nada de pago. Three.js va vendorizado en `ejemplo/assets/vendor/three/` (licencia MIT al lado).
- Idealmente, la voz definitiva antes de coreografiar: los tiempos de llegada a cada parada salen de la palabra que nombra cada paso (transcript palabra a palabra, módulo `captions`).
- Módulo relacionado: `modulos/mundo-3d/`.

## Cómo se construye

1. **Elige la metáfora en una frase** ("el proceso es un camino de tres paradas"). Si no se dice en una frase, no es el estilo.
2. **Un archivo `world3d.js` con una función pura `renderAt(t)`**: posición de cámara, objetos, luces y colores salen de `t`. Nada de `requestAnimationFrame`, `THREE.Clock`, `Date.now` ni `Math.random` sin semilla; nada acumulado entre fotogramas. Así el render es determinista y se puede mirar cualquier instante hacia delante o hacia atrás.
3. **GSAP es el único reloj**: el `index.html` anima `window.__P.time` de 0 a la duración y en cada actualización llama a `window.__r3d(t)`. Ese tween además fija la duración de la composición.
4. **Renderer**: `preserveDrawingBuffer: true`, pixel ratio 1, tamaño = `data-width`/`data-height` de la raíz.
5. **Recorrido de cámara como datos**: una lista `[tiempo, posición en el camino]` con pausas en cada parada (en el ejemplo, `RECORRIDO`). La cámara encuadra a la vez el marcador y la parada más cercana.
6. **Texto en DOM encima del canvas** (titular, paso actual, captions), no horneado en 3D: queda nítido y se edita fácil. Si horneas texto en una textura, espera `document.fonts.ready` antes.
7. **Colores desde la marca**: el ejemplo lee `--fondo`, `--acento`, etc. con `getComputedStyle`; si cambias `marca/marca.css`, cambia el mundo.

## Trampas

- **Encuadre vertical estrecho**: en 9:16 el campo horizontal es pequeño; con un campo de visión bajo las paradas laterales se salen de cuadro. En el ejemplo hizo falta subir el FOV a 52° y apuntar la cámara al punto medio entre el marcador y la parada.
- **Zonas seguras en todo el recorrido**: comprueba los extremos de cada movimiento de cámara, no solo el reposo. El suelo y el camino son "decorado" y pueden pasar bajo la interfaz; las paradas, números y textos no.
- **Objetos lejanos que asoman por detrás del titular**: niebla (`scene.fog`) y una viñeta arriba los apagan.
- **Texturas con números que salen giradas**: un número pintado en la tapa de un cilindro queda rotado; usa un disco plano que gire en Y para mirar a la cámara.
- Una preview lenta con WebGL no demuestra que el render falle: juzga sobre el MP4.

## Cómo adaptarlo

- Cambia `curva` (los puntos del camino) por la forma de tu metáfora y `PARADAS` por tus pasos.
- Ajusta `RECORRIDO` a los tiempos de tu voz y los `data-start` de los pasos del `index.html` a esos mismos tiempos.
- Para objetos-símbolo por parada (una bombilla, un engranaje, un trofeo), geometría simple low-poly con `MeshStandardMaterial` de rugosidad alta.

## Comprobado en este repo

`npx hyperframes lint` sin errores; render draft de 6 s; fotogramas revisados en 0,5 · 1,5 · 3,3 · 5,2 s; mismo fotograma a 3,3 s llegando directo o tras saltar a 5,5 y 1,0 s; zonas seguras de reel revisadas con `scripts/zonas-seguras.mjs`.
