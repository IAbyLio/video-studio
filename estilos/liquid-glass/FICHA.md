# Tarjetas de vidrio líquido

**Estado: probado.** El método (la librería y los ajustes de abajo) se usó en piezas reales aprobadas en el estudio del que sale este repo. El ejemplo de esta carpeta es una versión mínima nueva, renderizada y revisada aquí.

## Qué es

Tarjetas que **refractan lo que tienen detrás como un vidrio de verdad**: en el bisel, el fondo se curva (las líneas de la cuadrícula se doblan, una luz que pasa por debajo se estira) y el canto tiene brillo especular. No es el "glassmorphism" de siempre (desenfoque + borde blanco): es refracción real con un mapa de desplazamiento.

El ejemplo: titular, una lista de tres puntos en tarjetas de vidrio que entran escalonadas y una llamada a la acción en una píldora de vidrio, sobre una cuadrícula con ondas y tres luces que cruzan por las juntas.

## Cuándo usarlo

- Listas cortas ("antes de empezar, ten esto"), checks, preguntas, la llamada a la acción final.
- Encima de un fondo con vida: cuadrícula con ondas, un mundo 3D, un vídeo.
- Cuando quieres jerarquía de capas sin tapar del todo lo de atrás.

## Cuándo no

- Sobre un fondo liso: no hay nada que refractar y el vidrio se ve plano. Es la trampa número uno.
- Mucho texto pequeño: el vidrio deja ver el fondo y baja el contraste.
- Muchas tarjetas apiladas con el preset de lista: lo de abajo se mezcla con el texto (usa el preset de pila).

## Qué necesita

- Algo detrás que refractar (cuadrícula, 3D, vídeo, luces).
- Nada de pago. La librería `liqui-glass.js` va en `ejemplo/assets/vendor/liqui-glass/` con su licencia MIT y su aviso de origen (`NOTICE.md`): es un port sin dependencias de la técnica de liqui-design.

## Cómo se construye

1. **Monta cada tarjeta con tamaño fijo en px, a t = 0, aunque esté oculta**: `LiquiGlass.mount(nodo, { w, h, radius, bezel, refraction, blur, saturation, tint, tintDeep, specular })`. Así el mapa de refracción ya está decodificado cuando la tarjeta aparece (la librería lo genera de forma síncrona y lo precarga como imagen).
2. **CSS mínimo de capas** (está en el `index.html` del ejemplo): `.lq` con `isolation: isolate` y radio; las capas de efecto (`.lq-backdrop`, `.lq-refract`, `.lq-tint`, `.lq-specular`, `.lq-shine`) absolutas con `inset: 0`; el contenido en `.lqc` con `z-index: 3`. El texto va encima y no se deforma.
3. **Anima solo opacidad, transform y contenido.** Nunca la refracción en el tiempo: regenerar el filtro por fotograma es caro y no determinista.
4. **Fondo vivo como función pura de una fase**: la cuadrícula con ondas desplaza cada línea con una senoidal de su posición ortogonal más una fase global (paso 92 px, amplitud 16, longitud de onda 690); la timeline solo anima la fase y el canvas se redibuja en cada actualización. Mismo fotograma en la vista previa y en el render.

### Ajustes de partida (calibrados sobre fondo oscuro con cuadrícula)

| Uso | refraction | blur | tinte (claro → hondo) | specular |
|---|---|---|---|---|
| Lista / llamada a la acción (se lee el fondo a través) | 70 | 2 | 0,13-0,15 → 0,03-0,05 | 0,9 |
| Tarjetas apiladas (lo de abajo no debe mezclarse) | 60 | 14 | 0,15 → 0,05 | 0,85 |

La calibración original llegó en tres vueltas: primero "no se ve dónde empieza y termina" (demasiado transparente), después "completamente sólido" (demasiado tinte); el punto medio es esta tabla. Ajusta los tintes a tu marca y comprueba la legibilidad en el MP4.

## Trampas

- **Luces u objetos de colores pasando justo detrás del texto**: con blur 2 se leen nítidos a través del vidrio y tapan la lectura. En el ejemplo, las luces van por las juntas entre tarjetas: pasan bajo los biseles (donde se luce la refracción) sin cruzar el texto.
- Lo que se mueve detrás también cuenta para las zonas seguras: acota su recorrido para que no entre en los márgenes ni en la columna de botones.
- Los colores de marca pueden venir en cualquier formato: el ejemplo los normaliza con el canvas antes de aplicarles transparencia.
- En Three.js, el vidrio necesita objetos opacos detrás; un halo transparente puede desaparecer.
- Para una tarjeta con pose 3D sobre un mundo Three.js, el 3D calcula la pose y el DOM se proyecta con una homografía (`matrix3d`); un simple `rotateY` CSS no queda pegado al mundo.

## Cómo adaptarlo

- Cambia los textos de `#i1`-`#i3` y `#cta`; el tamaño de cada tarjeta se pasa en `mount` y en el CSS (tienen que coincidir).
- Detrás, cualquier fondo con contraste: el mundo 3D de `estilos/mundo-3d`, tu vídeo, o esta cuadrícula.

## Comprobado en este repo

`npx hyperframes lint` sin errores; render draft de 5 s; fotogramas revisados en 0,9 · 1,0 · 2,2 · 3,0 · 4,2 · 4,8 s (refracción visible en los biseles con un recorte a tamaño real); zonas seguras de reel revisadas con `scripts/zonas-seguras.mjs` en tres instantes.
