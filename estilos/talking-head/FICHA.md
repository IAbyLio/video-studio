# Cara a cámara (talking head)

**Estado:** probado (el método se usó en piezas reales aprobadas). El ejemplo de esta carpeta es una versión mínima con una persona de relleno hecha por código.

## Qué es
Tu vídeo hablando a cámara (o el de tu avatar) como base, con captions palabra a palabra, una cámara que nunca se queda quieta y gráficos que entran cuando hacen falta. La cara cambia de modo según lo que pase en pantalla:

| Modo | Cuándo | En el ejemplo |
|---|---|---|
| Pantalla completa | Gancho, cierre, momentos donde importa tu cara | 0–2 s |
| Ventana chica (abajo a la izquierda) | Un gráfico central es el protagonista (un número, un diagrama) | 2–4 s |
| Mitad superior | Una tarjeta o panel abajo; para paneles muy altos, ver el estilo *pantalla partida* | 4–6 s |

## Cuándo usarlo
- Hablas tú (o tu avatar) y el gráfico acompaña. Es el formato más versátil para reels de opinión, consejos y tutoriales cortos.
- No: si no quieres salir a cámara (usa *reel sin cara*, *personaje 3D* o *pizarra viva*).

## Qué necesita
- Un vídeo tuyo a cámara, **vertical 1080x1920** idealmente (si es horizontal, ver "Adaptarlo"), ya cortado: el módulo `modulos/editar-lo-que-grabas/` saca silencios y tomas falsas y deja el clip encuadrado.
- O un avatar de vídeo (módulo `modulos/avatar/`).
- Las palabras con sus tiempos: `npx hyperframes transcribe assets/tu-video.mp4 --model small --language es --json` y después `node scripts/generate-captions.mjs`.

## Cómo está hecho (ejemplo)
- La cara vive en un contenedor `#cara`; se anima el contenedor (posición, escala, `clip-path`), **nunca** el `<video>` (se congela).
- Los cambios de modo duran ~0,5 s con `expo.inOut` y arrancan 0,2 s antes de que entre el contenido nuevo.
- `clip-path: inset(... round R)` recorta en coordenadas del vídeo: en ventana deja cabeza y hombros, en mitad superior nada por debajo de y 960.
- Captions estilo *natural*: 1 a 3 palabras, centradas en x = 540, la clave en otro color, cada palabra aparece cuando se dice (pop con desenfoque) y el bloque sale hacia arriba.
- Cámara viva: un contenedor `#cam` con deriva lenta, golpe en las palabras clave y vuelta al reposo entre partes. La viñeta queda fuera de `#cam` (es la lente).
- El `<video>` no puede ir dentro de un elemento con `data-start` (el lint lo marca como error): `#cam` y `#cara` son contenedores sin tiempos.

## Adaptarlo
- Reemplaza `assets/persona.mp4` (mismo nombre o cambia el `src`) y ajusta `data-duration` a la duración real.
- Fuente horizontal (1920x1080): el contenedor mide 1920x1080 y los modos cambian (pantalla completa = `scale 1.78` recortando a los lados; mitad inferior = `scale 0.5625`). Mira un fotograma de cada modo antes de seguir.
- Si la cara queda alta o baja en un modo, mueve su `y` y mira de nuevo el fotograma.

## Trampas
- Cara, manos y gestos dentro de la zona segura; el torso sí puede salir por abajo.
- Una tarjeta ancha en la mitad de abajo pisa la columna de botones (x > 910 entre y 1160 y 1470): máximo x 185–895 si va centrada.
- Un caption encima de la cara: súbelo o bájalo según el modo.
