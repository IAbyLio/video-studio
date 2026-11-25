---
name: split-screen-panels
description: "Patrón para vídeos verticales 9:16 donde un gráfico grande (panel de datos, tarjeta con una regla o un número enorme, tabla, tablero simulado) tiene que convivir con la cara sin taparla: la cara sube a la mitad de arriba y el panel ocupa la mitad de abajo. Úsala cuando el gráfico principal de una escena mide más de ~600 px de alto, o cuando nuevo-video elige el estilo split-screen. Se usa junto a short-form-video, que pone el andamio."
when_to_use: "Frases típicas: 'pon el panel abajo y mi cara arriba', 'el gráfico me tapa la cara', 'pantalla partida', 'tarjeta con el número grande', 'un tablero con mis datos'. No usar para un chip o etiqueta chica (flota encima), para un diagrama suelto en el centro (modo ventana chica de short-form-video) ni para el gancho o el cierre donde manda la cara."
---

# Pantalla partida con paneles (9:16)

Amplía `short-form-video` (mismo andamio: fondo, cara, escenas, captions) con el modo **mitad superior**: la cara centrada en los 1080x960 de arriba y un panel que llena los 1080x960 de abajo. Ejemplo que renderiza: `estilos/split-screen/` (lee su `FICHA.md`). **Usa primero `short-form-video`**; esta skill solo suma el modo y el panel.

## Cuándo sí y cuándo no
| Situación | Modo |
|---|---|
| Panel o tarjeta de más de ~600 px de alto (tablero, regla con número de 180 px o más, tabla de datos, aviso que es el protagonista) | **Mitad superior + panel** |
| Chip, etiqueta, sello, icono suelto | Cara completa con el elemento flotando |
| Diagrama central que no es tarjeta (círculos, tipografía cinética, flujo en SVG) | Ventana chica (la cara a una esquina) |
| Gancho o cierre donde la cara manda | Pantalla completa |
| Un gráfico dentro de un panel que ya mostraste partido | Sigue partido (continuidad) |

## El patrón en una frase
> Cara arriba, panel abajo, cambio de modo de 0,45 s con `expo.inOut` que empieza **0,20 s antes** del `data-start` de la escena, y el panel entra 0,10-0,15 s después de que la escena arranca.

## Modos (fuente vertical 1080x1920, `transform-origin: 0 0` en `#cara`)
```js
const COMPLETA = { x: 0,  y: 0,    scale: 1,    clipPath: 'inset(0px 0px 0px 0px)' };
const MITAD    = { x: 0,  y: -300, scale: 1,    clipPath: 'inset(0px 0px 660px 0px)' };   // la del ejemplo del repo
const VENTANA  = { x: 60, y: 915,  scale: 0.35, clipPath: 'inset(380px 0px 400px 0px round 96px)' };
const DUR_MODO = 0.45;
```
- `y` de `MITAD` depende de dónde está la cara en tu vídeo: más negativo la sube. El recorte deja fuera todo lo que caería por debajo de y 960: `inset(0 0 X 0)` con X = 1920 − (960 − y).
- Cara demasiado baja: sube a −340 / −380. Cortada arriba: baja a −260. **Mira un fotograma del modo con tu vídeo antes de fijar el número.**
- Fuente horizontal: usa los modos horizontales de `short-form-video`.

## Panel (mitad inferior)
```css
.panel {
  position: absolute; left: 0; right: 0; top: 960px; height: 960px;
  padding: 44px 80px 48px; box-sizing: border-box;
  background: var(--superficie);
  border-top: 4px solid var(--acento);          /* la costura */
  border-radius: var(--radio) var(--radio) 0 0; /* solo arriba: sube desde abajo, no flota */
  box-shadow: 0 -16px 40px rgb(0 0 0 / 0.5);    /* sombra hacia arriba, hacia la cara */
  opacity: 0; transform: translateY(120px);     /* estado de entrada */
  overflow: hidden;                             /* nada animado se escapa sobre la cara */
}
```
- El **fondo** del panel puede llegar al borde inferior (es fondo). El **contenido** queda dentro de x 80-880 y por encima de y 1440 (la descripción del post tapa lo de abajo; los botones, la columna x > 910 entre y 1160 y 1470).
- Entrada en el timeline de la escena, no en el de la raíz:
  ```js
  tl.fromTo('#panel', { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.10);
  ```
  `power3.out` y no `back.out`: un panel es una losa, el rebote lo abarata.
- Tres variantes con su HTML y CSS (tablero, tarjeta con regla, aviso): `references/coreografia-y-paneles.md`.

## Coreografía en el timeline de la raíz
```js
tl.set('#marco-ventana', { opacity: 0 }, 0);                                                       // el marco de la ventana empieza oculto
tl.to('#cara', { ...MITAD, duration: DUR_MODO, ease: 'expo.inOut' }, inicioEscenaPartida - 0.20);   // completa → mitad
tl.to('#cara', { ...VENTANA, duration: DUR_MODO, ease: 'expo.inOut' }, inicioEscenaVentana - 0.20); // mitad → ventana
tl.to('#marco-ventana', { opacity: 1, duration: 0.35, ease: 'power2.out' }, inicioEscenaVentana - 0.10);
tl.to('#marco-ventana', { opacity: 0, duration: 0.35, ease: 'power2.out' }, siguiente - 0.30);      // al salir: primero el marco
tl.to('#cara', { ...MITAD, duration: DUR_MODO, ease: 'expo.inOut' }, siguiente - 0.20);             // y después la cara
tl.to('#cara', { ...COMPLETA, duration: DUR_MODO, ease: 'expo.inOut' }, inicioCierre - 0.20);      // mitad → completa (cierre)
```
La raíz solo lleva los modos de la cara, el marco de la ventana, el zoom lento del vídeo y la deriva del fondo. Todo lo de dentro de cada escena (panel, barras, sellos, contadores) va en el timeline de la escena: así, re-sincronizar es mover un `data-start`.

## Trampas
- **Dos cambios de modo a menos de 0,6 s:** el segundo arranca desde la mitad del primero. Únelos o sepáralos.
- **Zoom lento sobre `#cara`:** rompe las cuentas de los modos. Va en el `<video>` interior o en un contenedor propio.
- **Panel que entra en el 0 de la escena** mientras la cara todavía se mueve: parece que la persigue. Empieza en 0,10-0,15.
- **Cifras inventadas:** en los ejemplos son de muestra y lo dicen; en el vídeo, solo datos de la persona.

## Verificación
La de `short-form-video`: fotogramas en las palabras clave (incluido uno a mitad de cada cambio de modo), pasados por `node scripts/zonas-seguras.mjs <png...> --format reel` y mirados uno a uno.

## Skills relacionadas
`short-form-video` (andamio, siempre primero) · `nuevo-video` (entrada) · `hyperframes`, `gsap-core`, `gsap-timeline` (oficiales).
