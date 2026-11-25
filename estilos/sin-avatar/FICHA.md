# Reel sin cara (voz en off + motion graphics)

**Estado:** probado (método usado en piezas reales aprobadas). Ejemplo mínimo, sin voz, con efectos de la librería del repo.

## Qué es
Nadie sale a cámara. La voz (tuya grabada, una voz local o tu clon) va en off y la imagen la sostienen la tipografía cinética, tarjetas, el fondo vivo y la cámara.

## Cuándo usarlo
- No quieres o no puedes grabarte; el tema se cuenta bien con listas, cifras y frases cortas.
- No: si la gracia está en tu cara o en tu tono (mejor *cara a cámara*).

## Qué necesita
- Una voz definitiva **antes** de animar: el ritmo lo manda la voz. Puede ser tu grabación, `npx hyperframes tts` (voz local gratis) o tu clon (módulo `modulos/voz/`).
- Las palabras con tiempos (`npx hyperframes transcribe`), corregidas contra el guion.

## Cómo está hecho
- **Fondo:** cuadrícula que ondula, dibujada en un `<canvas>` por una función pura de la fase (`drawGrid(fase)`); la timeline solo mueve la fase. Mismo fotograma al ir adelante o atrás.
- **Slam** en la palabra pico (escala 1,85 + desenfoque → 1 en 0,26 s) y **golpe de cámara** en el mismo instante: un solo impacto, dos capas.
- Entradas distintas para cada tarjeta (desde la izquierda, desde la derecha, escala con rebote): nunca la misma dos veces seguidas.
- **Salida = transición:** todo sale hacia arriba con desenfoque.
- **Sonido por capas:** cada efecto es un `<audio data-capa="sfx">` con `id` único y `data-start = evento − transient_offset` (dato del manifest). Probado en el render: el golpe suena a −10 dB y fuera de los efectos hay silencio.

## Adaptarlo
- Pon tu voz como `<audio id="voz" src="assets/voz.wav" data-start="0" data-duration="…" data-track-index="10">` (sin `data-capa`: la voz suena en todas las etapas).
- Escribe cada entrada contra el instante de su palabra, con la palabra en un comentario.
- Render por etapas para afinar el sonido: `node scripts/stage-render.mjs <carpeta> visual`, después `sfx`, después `music`.

## Trampas
- Un `<audio>` sin `id` sale mudo.
- `data-layer` (marca antigua) hace fallar el lint de Hyperframes 0.9: usar `data-capa`.
- Duplicar en caption una frase que ya está en pantalla como titular: o una cosa o la otra.
