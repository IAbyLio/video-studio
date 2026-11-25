# Pizarra viva

**Estado: probado.** El método se usó en piezas reales aprobadas en el estudio del que sale este repo (tras varias rondas de corrección, de donde salen las reglas de abajo). El ejemplo de esta carpeta es una versión mínima nueva (dos notas, un conector y un círculo), renderizada y revisada aquí.

## Qué es

Una **pizarra en perspectiva que se construye delante del espectador**: notas adhesivas que aterrizan con su sombra, un lápiz que dibuja conectores, círculos y subrayados, y una cámara que viaja de grupo en grupo siguiendo al lápiz. Al final, zoom-out: se ve todo el razonamiento conectado. Sin cara a cámara.

## Cuándo usarlo

- Explicar un razonamiento o una comparación ("le pides esto → pasa esto", "lo desordenado ≠ lo ordenado").
- Reels sin cara, con voz en off (tuya, local o clonada) o con un personaje narrador a un lado.
- Cuando quieres que se sienta hecho a mano y pensado, no "plantilla".

## Cuándo no

- Si no tienes la voz definitiva: **el ritmo lo manda la voz**. Animar antes y encajar la voz después da una pizarra que "va demasiado rápido".
- Mucho texto: cada nota lleva 1-3 palabras. Si necesitas párrafos, no es este estilo.
- Datos densos (tablas, gráficos de muchas series): mejor pantalla partida o una tarjeta.

## Qué necesita

- La voz definitiva y su transcript palabra a palabra (`npx hyperframes transcribe voz.wav --model small --language es --json`, módulo `captions`).
- Nada de pago. Todo es HTML/CSS 3D + GSAP; sin Three.js.

## Cómo se construye

1. **Primero la voz.** Cada aterrizaje, cada trazo y cada movimiento de cámara se escribe contra el tiempo de una palabra, con la palabra al lado en un comentario (en el ejemplo, la lista `VOZ`).
2. **Tablero = plano 3D**: `#stage { perspective }` y el tablero con `translate(540px, FOCO_Y) rotateX(inclinación) rotateZ(giro) scale(s) translate(-cx, -cy)`, `transform-origin: 0 0`. Inclinación 8-10° de cerca, 12-13° viajando, 16-17° en el zoom-out.
3. **Cámara por fotogramas clave** `[t, cx, cy, s, inclinación]`, interpolados con `power2.inOut`, más una deriva suave con senos: nunca se queda muerta.
4. **Notas que aterrizan**: caen en `translateZ` real (de ~400 px a 0), el giro se asienta, aletean en `rotateX` y rebotan corto. **La sombra es un elemento aparte** en el plano que se aleja y se difumina con la altura: es lo que vende el 3D.
5. **Lápiz en pantalla, proyectado sobre el plano** con la misma matemática que la cámara: `x1,y1 = girar((p − c)·s)`, `y2 = y1·cos θ`, `z2 = y1·sin θ`, `f = P/(P − z2)`, pantalla = `(540 + x1·f, FOCO_Y + y2·f)`.
6. **Trazos a mano alzada con semilla** (curvas con un temblor sembrado + eco fino desplazado) revelados con `stroke-dashoffset`. **El trazo y la punta del lápiz usan el mismo progreso**: ninguna línea aparece antes de que pase el lápiz.
7. **Todo es función pura de `t`** (`render(t)` llamado desde un proxy GSAP): la vista previa puede ir hacia atrás y el render es determinista. Ruido con PRNG sembrado, nunca `Math.random`.

## Reglas que salieron de corregir piezas reales

- Poco texto; lo que se pueda contar con imagen, en imagen. Comparaciones = dos pegatinas con un "≠", no dos notas de texto.
- **Los objetos actúan**: si se nombra algo, ese algo hace algo en ese instante.
- El gancho lleva un movimiento potente, no solo una nota.
- Flechas visibles enteras: salen del borde de la nota, nunca de dentro.
- Al terminar su última acción, el lápiz sale de cuadro; nada de un círculo "decorativo" de más.
- Nada protagonista cortado por el borde ni tapado, también en los zoom-outs. Deja al menos 80 px entre grupos de notas.
- Un evento solo vale si se ve: si pasa mientras la cámara está en otro sitio, mueve la animación o la cámara.
- Captions en una banda central (o en un bocadillo junto al narrador). Cuando la frase ya vive en una nota, la banda se calla: no duplicar texto.

## Trampas técnicas

- **Orden de capas en 3D**: separa con z mínimo (cuadrícula 0, sombras 0,5, tinta 1, anotaciones 2, notas 4+). En el ejemplo, con las notas en z 0 la sombra quedaba POR ENCIMA de la nota y la oscurecía.
- **El tablero tiene que ser más grande que lo que ve el zoom-out**: si no, aparece el borde. El ejemplo desplaza el contenido 1000 px dentro de un tablero de 4000 px.
- **Foco de cámara por encima de las captions** (`FOCO_Y = 760` en el ejemplo) para que las notas no pisen la banda de texto.
- Los extremos redondeados de un trazo pintan un punto aunque no haya empezado: ocúltalo con `visibility` hasta que el progreso sea > 0.
- Nada de `will-change: transform` en el tablero: Chromium lo rasteriza a la escala inicial y el texto sale borroso al hacer zoom.
- Mide los anclajes (palabras a rodear, subrayados) después de `document.fonts.ready`.
- El lápiz cuenta como objeto para las zonas seguras: inclínalo hacia dentro del cuadro.

## Cómo adaptarlo

- Cambia `VOZ` por los tiempos de tu transcript y `NOTAS`, `conector`, `circ` y `CAM` por tu razonamiento (un grupo = una idea = 1-3 notas).
- Colores por significado, desde tu marca: `--acento` para lo bueno o la solución, `--negativo` o `--acento-2` para el problema (uno por encuadre), `--superficie-alta` para lo neutro.

## Comprobado en este repo

`npx hyperframes lint` sin errores; render draft de 5,5 s; fotogramas revisados en 0,6 · 2,1 · 3,3 · 4,4 · 5,4 s; zonas seguras de reel revisadas con `scripts/zonas-seguras.mjs` (lápiz y notas dentro).
