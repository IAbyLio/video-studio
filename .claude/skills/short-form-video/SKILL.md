---
name: short-form-video
description: "Método para construir e iterar vídeos verticales cortos (9:16, 10-60 s) de una persona hablando a cámara o un avatar, con gráficos que entran sincronizados a la voz, captions palabra a palabra y cambios de modo de la cara (pantalla completa, mitad, ventana chica). Úsala cuando el vídeo es un reel, short o TikTok con cara a cámara, cuando hay que re-sincronizar uno tras recortar el audio, o cuando nuevo-video elige los estilos talking-head o texto-detras."
when_to_use: "Frases típicas: 'reel con mi cara y gráficos', 'short a partir de esta grabación', 'el gráfico entra tarde', 'retima el vídeo después de cortar el audio', 'la cara queda cortada abajo'. No usar para vídeo horizontal largo (long-form-video), para un panel muy alto que convive con la cara (split-screen-panels) ni para un anuncio con avatar generado desde un audio (audio-to-avatar-ad)."
---

# Vídeo vertical corto (9:16)

Vertical 1080x1920, de 10 a 60 s: tu cara (o tu avatar) hablando, gráficos que entran en la palabra justa y captions palabra a palabra. Esta skill va **encima** de las reglas del estudio: el Render Contract y los gates de la guía (`CLAUDE.md`) y las skills oficiales `hyperframes` y `gsap-core` siguen mandando. La entrada es la skill `nuevo-video` (selector de estilo y preguntas); esta skill aporta el método del formato.

Punto de partida en el repo: el ejemplo de `estilos/talking-head/` (modos de cara, cámara viva, captions *natural*) o el de `estilos/texto-detras/`. Lee su `FICHA.md` antes de componer.

## Gate de zona segura (antes de escribir HTML)
El `BRIEF.md` del proyecto lleva el bloque `## Zona segura` (lo escribe `nuevo-proyecto.mjs`). En reel: nada que no sea fondo por encima de y 220 ni por debajo de y 1470, 35 px de margen lateral, nada en x > 910 entre y 1160 y 1470 (botones), lo centrado en x = 540 con ancho máximo 710. Detalle y otros formatos: `modulos/zonas-seguras/README.md`. Cada fotograma que mires pasa por `node scripts/zonas-seguras.mjs <png...> --format reel`.

## El método en seis pasos
1. **El audio manda.** Primero se edita el audio (tomas repetidas, pausas largas, muletillas). Si es una grabación tuya, usa `modulos/editar-lo-que-grabas/` (propone cortes, tú confirmas lo dudoso, corta en una pasada y deja el clip en 9:16 con su `words.json` ya en tiempo del clip cortado). Mide la duración final con `ffprobe`: es el `data-duration` de la composición.
2. **Transcribe el audio FINAL** (`npx hyperframes transcribe assets/<clip>.mp4 --model small --language es --json`; los modelos `*.en` no sirven para español). Corrige nombres propios y cifras contra el guion.
3. **Todo en tiempo del clip editado.** Nunca mezcles tiempos del audio original con tiempos del editado en el mismo archivo (ver "Re-sincronizar").
4. **Andamio de capas** (abajo): fondo vivo, cara, escenas, captions.
5. **Cada escena con tiempos LOCALES** relativos a su `data-start`. Si una escena es compleja, va en su sub-composición `compositions/escena<N>-<nombre>.html`.
6. **Lint → fotogramas mirados → vista previa con OK → borrador → QA → final.** Son los gates de la guía; ninguno se salta.

## Andamio (las capas que están siempre)
```
index.html (raíz 1080x1920, data-composition-id="main")
├── fondo        pista 3  · degradado radial + textura + partículas o cuadrícula + viñeta
├── #cara        pista 0  · contenedor sin tiempos con el <video> dentro (ver modos)
├── costura      pista 5  · solo en escenas de mitad inferior: funde el borde de y 960
├── escenas      pista 1  · una tras otra, sin huecos
└── captions     pista 2  · palabra a palabra (modulos/captions/)
```
- El `data-duration` es el mismo en la raíz, el fondo, el vídeo, el audio y los captions; solo cambian las escenas.
- El audio de la cara va en un `<audio>` aparte, con `id` único. El `<video>` siempre `muted`.
- `class="clip"` en los elementos con tiempo, **nunca** en `<video>` ni `<audio>`. Un `<video>` no puede ir dentro de un elemento con `data-start`.

## Modos de la cara (la jugada que define el formato)
La cara vive en un contenedor (`#cara`) del tamaño nativo del vídeo. GSAP anima el **contenedor** (posición, escala, `clip-path`), nunca el `<video>`: animar sus medidas congela fotogramas.

Fuente vertical 1080x1920 (lo habitual con móvil o avatar), como en `estilos/talking-head/`:
```js
const COMPLETA = { x: 0,  y: 0,    scale: 1    };   // gancho, cierre, momentos de cara
const MITAD    = { x: 0,  y: -300, scale: 1    };   // cara arriba, tarjeta abajo (recorta con clip-path a y 960)
const VENTANA  = { x: 60, y: 915,  scale: 0.35 };   // ventana chica: un gráfico central manda
```
Fuente horizontal 1920x1080: el contenedor mide 1920x1080; pantalla completa recorta los lados (`scale: 1.7778`, `x: -1166.5`) y mitad inferior la muestra entera (`scale: 0.5625`, `y: 1136`). Si la persona ocupa menos del 70 % del encuadre, sube a `scale: 0.75` con `x: -180` para que no queden franjas vacías a los lados. **Mira un fotograma de cada modo con tu vídeo real antes de fijar las constantes.**

Cambios de modo: 0,45-0,55 s con `expo.inOut`, empezando 0,2-0,3 s **antes** de que entre el contenido nuevo, y a la vez la escena que sale se funde (`opacity: 0`, `filter: blur(6px)` en 0,2 s). Cara que salta de modo sin interpolar = el fotograma más brusco de un vertical.
```js
[{ t: 2.06, modo: COMPLETA, dur: 0.50 }, { t: 3.71, modo: MITAD, dur: 0.45 }]
  .forEach(({ t, modo, dur }) => tl.to('#cara', { ...modo, duration: dur, ease: 'expo.inOut' }, t - 0.25));
```
Si dos cambios quedan a menos de 0,6 s, únelos en uno: el segundo arrancaría desde la mitad del primero.

**La cara es un personaje:** un toque de contraste y saturación (`filter: contrast(1.06) saturate(1.06)`), un zoom lento de 1,00 a 1,025 en toda la duración (sobre el `<video>` interior o un contenedor propio, no sobre `#cara`, que es el de los modos) y una viñeta lateral para que no choque contra un borde recto.

**Costura (escenas de mitad inferior):** banda de 60-100 px que funde el borde de y 960 hacia el fondo, más una línea fina de `--acento` con brillo suave. Un corte recto en y 960 se nota mucho.

## Re-sincronizar (cuando el audio cambia)
Si el audio se vuelve a editar, los tiempos de la transcripción original dejan de valer.
1. Mide las dos duraciones con `ffprobe`; la diferencia es lo cortado. Ubica de dónde se cortó.
2. Escribe el plan antes de tocar nada:

| Escena | Inicio actual | Duración actual | Inicio nuevo | Duración nueva | Motivo |
|---|---|---|---|---|---|

3. Los tiempos internos de una escena son locales: si su `data-start` queda bien, no se tocan, **salvo** que la escena cruce un corte (ahí cambian su duración y sus tiempos internos).
4. Los cambios de modo de la cara están en el timeline de la raíz: hay que moverlos a mano.
5. Lint → fotogramas → vista previa → borrador. Sin atajos.

## Escenas
- Cada escena llena su hueco exacto (`data-duration` igual al de la raíz) y alarga su timeline con `tl.set({}, {}, DURACION)`.
- **Nada quieto:** cada 100 ms algo se mueve. La primera entrada a los 0,1-0,3 s, no en 0.
- **El remate se queda ≥ 1 s** en pantalla (mejor 1,5). Presupuesta la escena por el remate, no por la duración total.
- **Movimiento hasta el final:** si todo entra en los primeros 2 s de una escena de 4, suma movimiento secundario (subrayado que barre, marca que aparece, deriva lenta de tarjetas).
- **Al menos tres curvas distintas** por escena.
- **Un golpe fuerte cada ~5 s** (tipografía que golpea, barrido, golpe de cámara en la palabra clave). Sin eso, es "una cabeza con rótulos".
- **Sellos y golpes llegan DESPUÉS de que su objetivo se ve entero:** `t_sello ≥ t_objetivo_visible + 0,10-0,25 s` (el "visible" es el final de su entrada). Si el sello llega antes, el chiste se cae.
- **En el tramo del medio, datos antes que decoración:** barras que crecen, un número que sube, una cuadrícula que se enciende en secuencia, una línea que se dibuja. Tipografía con icono parece diapositiva; un dato que se mueve parece prueba. Cifras siempre de la persona y comprobables.

## Captions
Elige el estilo con la persona: `natural` o `premium` (`modulos/captions/ESTILOS.md`, ejemplos en `modulos/captions/ejemplos/`). Bloques desde la transcripción con `node scripts/generate-captions.mjs <transcript.json> <bloques.html> <meta.json>`. Colores y fuentes desde `marca/marca.css`; la palabra activa con un pequeño salto de escala y color de acento. Contorno con `text-shadow` en capas, nunca `-webkit-text-stroke` (se ve distinto en el render). Sin `<br>` dentro de un caption. Si re-sincronizas, una función `desplazar(t)` dentro de los captions mapea tiempos originales a editados y deja la transcripción intacta.

## Fondo
Nunca un color plano: degradado radial (centro un 15-20 % más claro), textura o grano al 8-12 %, 4-8 partículas o líneas que derivan y viñeta. Todo con variables de `marca/marca.css`.

## Transiciones y sonido
- **Varía el tipo.** Nunca dos transiciones iguales seguidas; seis cortes secos seguidos delatan una edición automática. Los cambios de modo de la cara ya funcionan como transición. Más tipos: `npx hyperframes catalog` y la skill `hyperframes-registry`.
- Efectos de sonido: `modulos/sonido/` (`data-start` = evento − `transient_offset`, cada `<audio>` con `id`).
- Reacción al audio (si la quieres): pre-calcula la curva de volumen en un archivo y léela en función del tiempo. Nada de `AnalyserNode` ni `Math.random()` en el render. Texto 3-6 %, fondo 10-30 %.

## Verificación (sin esto no está listo)
1. `npx hyperframes lint` desde la carpeta del proyecto: 0 errores.
2. Elige 8-15 instantes que coincidan con **palabras dichas** donde un gráfico concreto tiene que estar (no números redondos).
3. Antes del borrador: `npx hyperframes snapshot --at <t1,t2,…> --output renders/f`. Después del borrador: `node ../../scripts/extract-frames.mjs renders/borrador.mp4 <t1> <t2> … --out renders/f-borrador`.
4. **Abre y mira cada PNG** y pásalos por `zonas-seguras.mjs`. Comprueba: lo esperado está en su palabra (ni antes ni tarde), la cara no se corta, el modo es el correcto, los captions se leen y no se salen, no hay fotogramas vacíos ni solapes sin querer.
5. Vista previa con OK de la persona, borrador, revisión con el agente `video-qa` (`.claude/agents/video-qa.md`) y, con su OK, el final (`--quality standard`). Repite 3-4 fotogramas en el final.

## Lo que no se hace
- Animar medidas del `<video>` · `repeat: -1` · `Math.random()` o `Date.now()` sin semilla · `<br>` en captions · tiempos del audio original con audio editado · fondo plano · cortes secos seguidos · captions que solo rotulan · cara quieta y sin tratar.

## Skills relacionadas
`nuevo-video` (entrada y selectores) · `split-screen-panels` (panel alto con la cara arriba) · `audio-to-avatar-ad` (anuncio con avatar desde un audio) · `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `gsap-core`, `gsap-timeline` (oficiales).

> Procedencia: deriva de la skill `short-form-video` de hyperframes-student-kit (MIT © 2026 Nate Herk), reescrita y ampliada con método propio. Ver `LICENCIAS.md`.
