# Texto detrás del sujeto

**Estado:** probado (método usado en piezas reales aprobadas). Ejemplo mínimo con persona de relleno y su recorte.

## Qué es
Una palabra gigante colocada entre el fondo y la persona: la persona la tapa en parte, y parece que el texto está en la habitación, detrás de ella.

## Cuándo usarlo
- Para la palabra protagonista de una frase (una o dos veces por vídeo, no más). Funciona muy bien en ganchos.
- No: si la grabación tiene mucho movimiento de cámara o la persona sale y entra de cuadro (el recorte se nota).

## Qué necesita
- Tu vídeo.
- El **recorte** de la persona con fondo transparente. Se saca en tu ordenador, gratis:
  ```bash
  npx hyperframes remove-background assets/tu-video.mp4 -o assets/tu-video-recorte.webm
  ```
  La primera vez baja un modelo local (unos cientos de MB). En la prueba de este repo procesó 6 s de vídeo en unos 40 s en un Mac con chip M.

## Cómo está hecho
Tres capas, el mismo vídeo dos veces:
1. `#placa`: la grabación entera (un poco oscurecida para que la palabra resalte).
2. `#heroe`: la palabra, con degradado, inclinada 2°, entrada de máquina de escribir (`clip-path` con `steps(número de letras)`).
3. `#recorte`: el vídeo recortado con transparencia. Donde está el cuerpo, tapa la palabra.

Encima de todo, la línea de apoyo ("Tu IA ya") y los captions. Los dos `<video>` van en la raíz, con el mismo `data-start` y `data-duration`.

## Adaptarlo
- Cambia los dos `src` y la palabra. Palabra completa ("TRES", no "3"), tamaño para que entre centrada con margen.
- Súbela sobre la frente, no sobre los ojos.

## Trampas
- Usar `from()` en la entrada produce un destello de un fotograma: `fromTo()` con los dos estados.
- Un `<video>` con transparencia dentro de una sub-composición sale negro: va en el `index.html` raíz.
- Si el borde del recorte sale sucio en pelo u hombros, se nota más cuanto más contraste tenga la palabra: prueba otra toma o pon la palabra delante.
- Si la palabra pasa de x 1045 o de x 35 se corta en algunos móviles.
