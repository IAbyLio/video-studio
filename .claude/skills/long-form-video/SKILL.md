---
name: long-form-video
description: "Método para construir e iterar vídeos horizontales largos (1920x1080, de 2 a 12 minutos): vídeos de ventas, explicaciones para YouTube, clases, tráileres de webinar. Cubre la estructura por tesis, la biblioteca de tipos de escena para no repetir, las tarjetas que crecen por estados, las tres capas de captions, la cara que se encoge y vuelve a crecer y la disciplina de retención. Úsala cuando el vídeo es horizontal y dura más de dos minutos, o cuando hay que revisar uno largo escena a escena."
when_to_use: "Frases típicas: 'vídeo largo para YouTube', 'vídeo de ventas de 8 minutos', 'una clase grabada con gráficos', 'el vídeo se hace pesado en el minuto 3', 'cambia la escena de la tarjeta que crece'. No usar para verticales cortos (short-form-video) ni para un anuncio con avatar desde un audio (audio-to-avatar-ad)."
---

# Vídeo horizontal largo (16:9)

1920x1080, de 2 a 12 minutos: tu cara (o tu avatar) a un lado, gráficos que cambian de forma y tres capas de captions, ordenado alrededor de una tesis y con mucha variedad para que nadie se vaya. Va **encima** de las reglas del estudio (Render Contract y gates de `CLAUDE.md`, `FILOSOFIA-MOTION.md`) y de las skills oficiales `hyperframes`, `gsap-core` y `gsap-timeline`. La entrada sigue siendo `nuevo-video`.

Proyecto: `node scripts/nuevo-proyecto.mjs <slug> --estilo libre --formato horizontal-16x9` (o el estilo más cercano y recolocar). Zona segura de YouTube y web: `modulos/zonas-seguras/README.md` (`--format horizontal-16x9`).

## El método
1. **El audio manda.** Primero la voz final (grabada y limpia con `modulos/editar-lo-que-grabas/`, o generada con `modulos/voz/`). Transcríbela (`npx hyperframes transcribe <audio> --model small --language es --json`) y guarda las palabras como **datos dentro del proyecto** (un `.js` que define una variable global, como hace el repo con las poses del muñeco): nada de `fetch` durante el render.
2. **Marca las tesis sobre la transcripción.** Entre 5 y 10 ideas fuertes en todo el guion: cada una es una zona de escenas. Es el ritmo grande.
3. **Elige un tipo de escena por zona** de la biblioteca (abajo), **sin repetir dos seguidos**.
4. **Construye cada escena de dentro afuera:** HTML → CSS → tweens → fotogramas mirados.
5. **Monta las tres capas de captions** sin que se pisen.
6. **Coreografía de la cara:** se encoge en un giro de tesis y vuelve a crecer en la prueba o el cierre (dos veces en todo el vídeo, no más).
7. **Renderiza la composición directa** (ver "Render directo").
8. **Mira los fotogramas** y pasa las dos vistas previas (Studio antes de renderizar, MP4 antes del final).

## Render directo (apréndelo primero)
Si la composición larga vive en `compositions/completo.html` y la raíz la incrusta con `<template data-composition-src>`, su script puede correr antes de que exista su DOM: busca un contenedor, encuentra `null`, falla, nunca registra su timeline y el render sale en blanco. Renderiza la composición como página propia:
```bash
npx hyperframes render --quality draft --composition compositions/completo.html --output renders/completo-borrador.mp4
```
La vista previa de esa composición sola (`npx hyperframes preview` y abrirla por su id) usa el mismo camino. Si de verdad necesitas unir varias por la raíz, cada script tiene que tolerar elementos que todavía no existen y registrar su timeline igual. Detalle: `references/render-directo.md`.

## Las tres capas de captions
| Capa | Qué es | Dónde |
|---|---|---|
| 1. Barra | Todo lo que se dice, literal, palabra a palabra | Franja baja (`top: 970px; height: 100px`), con un velo detrás |
| 2. Protagonista | La frase dicha casi literal (≥ 85 %), en grande, ocupando la escena | Dentro del contenedor de la escena |
| 3. Notas | Paráfrasis o puntos que se acumulan bajo un diagrama mientras habla | Flotando bajo el gráfico; las viejas bajan a `opacity: 0.3` |

Reglas de convivencia: nunca la barra a la vez que un protagonista literal (repite el mensaje y parece un error). La barra se apaga con **ventanas de protagonista**:
```js
const VENTANAS_PROTAGONISTA = [[29.70, 35.85], [103.50, 118.90]];   // [inicio, fin] en segundos, cada una con su motivo en un comentario
const enVentana = (b) => VENTANAS_PROTAGONISTA.some(([s, e]) => Math.min(b.end, e) - Math.max(b.start, s) > 0.30);
```
Y se retira o vuelve con un barrido cuando una escena quiere el borde limpio:
```js
tl.to(['#barra-captions', '#velo-captions'], { y: 110, opacity: 0, duration: 0.35, ease: 'power2.in' }, T);   // fuera
tl.to(['#barra-captions', '#velo-captions'], { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }, T2);   // vuelve
```
- Texto protagonista con degradado: el `background-clip: text` va **por palabra o por línea**, nunca en un contenedor de varias líneas; deja `padding: 0.1em 0.06em 0.2em` para que no se corten la g, la p ni la y.
- **Desfase de whisper:** si en la revisión "el caption va adelantado" a partir de cierto minuto, suma un desfase por tramo (`+0,4 s` desde el segundo X) en el bucle de captions, documentado en un comentario.
- Estilos de caption del repo (`natural` / `premium`) para la barra y el protagonista: `modulos/captions/ESTILOS.md`.

## Biblioteca de tipos de escena (alterna, no repitas seguidos)
1. **Tipografía cinética:** palabras grandes que entran escalonadas (`opacity`, `y`, `scale`, desenfoque que se va; `expo.out`, 0,4 s, escalonado 0,06). Para tesis y giros.
2. **Cita a pantalla completa:** la cara se encoge, la cita entra frase a frase y cada una se funde en la siguiente. Para los giros que necesitan toda la atención.
3. **Puente:** una tarjeta pequeña con 2 frases para un tramo de 5-10 s que no encaja con la escena anterior ni con la siguiente.
4. **Cápsulas en cascada:** una por cada elemento de una enumeración, en la palabra exacta; al final, un latido conjunto (`yoyo`, `repeat: 1`).
5. **Tarjeta que crece por estados** (la más útil): nace compacta con solo el título y se expande a medida que llega el contenido. Receta completa y trampas: `references/tarjeta-por-estados.md`.
6. **Contador:** un número que sube o baja con `onUpdate` (formato `toLocaleString('es-ES')`).
7. **Diagrama de flujo:** nodos que entran en su palabra y flechas que entran **entre** dos menciones; el nodo nace en `--negativo` (problema) y pasa a `--acento` (resuelto) cuando se nombra la solución.
8. **Lupa que recorre nodos:** un SVG de lupa que va de nodo en nodo ("revisar", "entender el sistema"). Iguala la proporción del contenedor con la del `viewBox` para que las cuentas de centrado sean simples.
9. **Cuadrícula de personas o casos:** 3x2 círculos con su etiqueta; el "tú" con borde de acento; latido en cada mención.
10. **Trío de logos:** logos reales (con permiso de uso) entrando en la palabra que los nombra; caja de alto fijo y `width: auto` para que no queden huecos.
11. **Titular en dos líneas:** la de arriba pequeña y suave, la de abajo grande, con degradado y girada 2°.
12. **Iconos que orbitan:** 4 iconos en las esquinas alrededor del titular, con derivas de amplitudes distintas para que no se muevan a la vez (repeticiones finitas).
13. **Antetítulo y revelado:** una frase corta que se va justo antes de que aparezca el nombre grande.
14. **Testimonios:** miniaturas sacadas de los vídeos reales (`ffmpeg` en un plano limpio de la cara), `aspect-ratio: 16/9`, `object-fit: cover` y `object-position` afinado por tarjeta. Solo con permiso de quien sale.
15. **Precio tachado y "incluido":** el precio entra, una línea en `--negativo` lo tacha (`scaleX` de 0 a 1 desde la izquierda) y aparece "incluido" con un latido.
16. **Caos:** 5 etiquetas temblando desfasadas (temblor de amplitud fija con `repeat` finito; nada de `random()` sin semilla).
17. **Rotador de fases:** un mismo texto cambia de etiqueta con `tl.call()` en un tramo largo, para que algo cambie sin meter elementos nuevos.
18. **Comparativa lado a lado:** dos tarjetas iguales (antes/después, no es para ti / sí es para ti) con icono de cruz y de visto.

## La cara que se encoge y vuelve
```js
gsap.set('#cara-larga', { transformOrigin: 'left bottom' });
tl.set('#cara-larga', { zIndex: 200 }, T_ENCOGE);
tl.to('#cara-larga', { scale: 0.42, duration: 0.8, ease: 'power3.inOut' }, T_ENCOGE);   // giro de tesis
tl.to('#cara-larga', { scale: 1, duration: 0.8, ease: 'power3.inOut' }, T_CRECE);        // prueba o cierre
tl.set('#cara-larga', { zIndex: 1 }, T_CRECE + 0.85);
```
Con la cara grande, el contenido vive en el panel derecho (`left: 606px`); con la cara encogida, ocupa todo el ancho (`left: 60px`). Una escena que cruza el momento anima su `left` a la vez.

Medidas de referencia en 1920x1080: cara grande `left: 60; top: 60; width: 580; height: 960`; panel derecho `left: 606; right: 60; top: 60; height: 920`; barra de captions `left: 50; right: 50; top: 970; height: 100`.

## Retención (nada quieto)
1. Ningún protagonista solo más de 5 s sin movimiento secundario (latido cada ~3 s, deriva del fondo, una nota que entra).
2. Algo cambia cada 5-8 s: entra un elemento, cambia el layout, un latido en una palabra fuerte.
3. Nunca dos escenas seguidas del mismo tipo.
4. Si un tramo de voz se alarga, divide el contenido en incrementos y que entre uno por cada sub-frase.
5. Tarjetas que se quedan más de 10 s: latidos en los golpes de voz.
6. Después de la entrada escalonada, al menos un evento a mitad de escena.

## Tiempos y suavidad
- **Tiempos literales de la transcripción**, con la palabra en un comentario: `// 410,94 "factura" → entra el icono a los 410,90`.
- **Al saltar hacia atrás en la vista previa** un elemento que salió puede quedarse invisible: fija su estado inicial con `tl.set` al principio de su escena antes de animarlo (el lint avisa con `gsap_exit_missing_hard_kill`).
- **Salto al final de un movimiento:** `power3.inOut` tiene una cola muy lenta y el último píxel "salta". Para anchos y posiciones de más de 0,5 s usa `sine.out` o `power2.inOut` un poco más largos.

## Marca
Solo las variables de `marca/marca.css` (`--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--acento`, `--acento-2`, `--negativo`, fuentes y `--radio`). Problema / antes / tachado → `--negativo`; resuelto / después → `--acento`. Degradados de protagonista de `--texto` a `--acento` (o a `--negativo` para problemas).

## Revisión escena a escena con la persona
1. Nombra cada escena por su primer y último elemento visible ("la de la lupa hasta las cápsulas"), no por segundos.
2. Aplica todos los cambios de una escena antes de pasar a la siguiente.
3. Tras cada cambio: `npx hyperframes snapshot --at <instantes> --output renders/f` desde la carpeta del proyecto y mira los PNG; `npx hyperframes lint` a 0 errores.
4. Una tarjeta con varios estados suele pedir 5-10 vueltas: es normal.
5. Renderiza solo cuando la persona terminó la revisión: un render de 9 minutos tarda.

## Verificación y render
- Vista previa en Studio con OK → borrador con `--composition` → 8-12 fotogramas repartidos por todo el vídeo con `node ../../scripts/extract-frames.mjs renders/completo-borrador.mp4 <t1> <t2> … --out renders/f-borrador`, pasados por `zonas-seguras.mjs --format horizontal-16x9` y mirados uno a uno → agente `video-qa` → OK de la persona sobre el MP4 → final con `--quality standard --composition …`.

## Lo que no se hace
Protagonista quieto más de 5 s · dos escenas iguales seguidas · barra de captions durante un protagonista literal · iconos de relleno donde hay material real · contenedor de logo más ancho que el logo · quitar una clase que cambia el layout sin compensar con un transform · `power3.inOut` en anchos largos · mezclar `display: none` y `flex` en elementos que deben mantener su sitio · renderizar la raíz con sub-composiciones que dependen de su DOM · decir que está listo sin mirar los fotogramas.

## Skills relacionadas
`nuevo-video` (entrada) · `short-form-video` (formato vertical) · `split-screen-panels` (paneles grandes) · `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `gsap-core`, `gsap-timeline` (oficiales).
