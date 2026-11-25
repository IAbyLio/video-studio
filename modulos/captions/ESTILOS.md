# Estilos de captions: `natural` o `premium` (se elige en cada vídeo)

Módulo: `scripts/captions/captions-estilos.js` (sin dependencias, sirve en el navegador y en node; todo es función del tiempo, determinista). Cada proyecto copia el módulo a su `assets/` (los proyectos son portables). Ejemplos que renderizan: `ejemplos/natural/` y `ejemplos/premium/` (misma frase, la persona de relleno).

**Estado:** `natural` está probado en piezas reales. `premium` es **experimental**: el método sale del análisis de un reel de referencia y de un primer uso en el estudio de origen, todavía sin validar en piezas publicadas. El ejemplo de esta carpeta está renderizado y revisado.

| | `natural` | `premium` |
|---|---|---|
| Qué es | 1-3 palabras centradas, la clave en color | Una frase compuesta: base sobria + línea de énfasis en otra tipografía/tamaño con brillo, con interlineado negativo |
| Cuándo | Por defecto. Ritmo rápido, mucho contenido en pantalla, el texto acompaña | El texto es parte del diseño: hay aire en el plano, frases con remate, cierres, piezas de marca |
| Coste | Cero: sale solo de las palabras con tiempo | Un plan por escena (zona libre, plantillas) y mirar fotogramas fijos antes de construir |

## Entrada común
```js
const GRUPOS = [   // de npx hyperframes transcribe, agrupado de 1 a 3 palabras
  { t0: 0.30, t1: 1.00, ws: [{ txt: "Tu", s: 0.35 }, { txt: "IA", s: 0.55, tono: "positivo" }] },
  { t0: 3.60, t1: 5.40, ws: [{ txt: "antes", s: 3.70 }, { txt: "de", s: 3.90 }, { txt: "terminar.", s: 4.10, tono: "problema", fin: true }] },
];
```
`tono` marca la palabra clave (`positivo` → `--acento`, `problema` → `--negativo`); `fin: true` = termina la frase.

## `natural`
```js
const api = CaptionsEstilos.montar({ estilo: "natural", tokens: CaptionsEstilos.tokensDesdeCSS(document),
  capaFrente: document.getElementById("capFrente"), grupos: GRUPOS, natural: { y: { S: 1180 } } });
// en la timeline: un proxy de tiempo que llama api.update(t) en cada actualización
```
Caja `left 185 · ancho 710` (centrada en x = 540), fuente de títulos de tu marca a 66 px, sombra difusa, palabra a palabra cuando se dice (escala 1,14 → 1 y sube 8 px en 0,14 s). `natural.y` fija la altura por escena (o `natural.yDe(escena, t)`).

## `premium`
```js
const bloques = CaptionsEstilos.componer(GRUPOS, { plan: PLAN, escenaDe: (t) => "S" });
const api = CaptionsEstilos.montar({ estilo: "premium", tokens: CaptionsEstilos.tokensDesdeCSS(document),
  capaFrente, capaDetras, bloques });
```

### Tipografía (sale de tu marca con `tokensDesdeCSS`)
| Rol | Tipografía | Uso |
|---|---|---|
| `base` | `--fuente-texto` 600, 54 px | La frase, palabra a palabra |
| `bloque` | `--fuente-titulos`, 104 px, degradado texto → color del tono + brillo | Remate contundente |
| `acento` | `--fuente-titulos` itálica, 120 px, color del tono + brillo | Remate con tono |
| `elegante` | `--fuente-titulos` 400, 116 px, texto con brillo suave | Palabra que se sostiene sola |
| `grito` | `--fuente-titulos` en mayúsculas, 116 px, brillo fuerte | La palabra de la llamada a la acción |
| `dato` | `--fuente-mono` en mayúsculas, 46 px | Cifras y etiquetas |

El color lo decide el tono, no el rol. El énfasis pisa la base un 20 % de su tamaño (interlineado negativo): eso hace que el bloque se lea como una pieza tipográfica. Si tu marca tiene una tercera tipografía expresiva (una serif itálica, por ejemplo), pásala con `tokensDesdeCSS(document, { roles: {...} })`.

### Cómo se arman los bloques
`componer()` junta las palabras en bloques y cierra uno tras su remate (la palabra con tono), en puntuación, al cambiar de escena, tras un hueco de voz o a las 9 palabras. Las bases largas se parten en líneas parejas (nunca una palabra colgando). El rol del énfasis rota sin repetirse; un override por texto lo fija.

### Repertorio
- **Entradas de la base** (sobrias): `pop` (sube + desenfoque que se limpia), `arco` (la línea entra girada y se endereza), `corte`.
- **Entradas del énfasis** (rotan, nunca dos iguales seguidas): `letras`, `zoom`, `barrido`, `slide`, `sube`, `slam`, `cae`.
- **Salidas** (automáticas según lo que sigue): `estela` (se va a un lado con desenfoque, al cambiar de escena), `fundido` (cruzado con el bloque siguiente), `subida` (hacia arriba, tras un hueco de voz), `corte`.

### Layout que cambia de sitio
El plan da, por escena, la **zona libre** (rectángulo donde el texto puede vivir sin tapar caras ni lo que aporta, medido sobre fotogramas reales) y las plantillas que rotan:

| Plantilla | Composición | Plano típico |
|---|---|---|
| `apilado` | todo centrado | sujeto centrado con banda estrecha libre |
| `escalon` | base a la izquierda, énfasis a la derecha | sujeto centrado con algo de aire |
| `esparcido` | base arriba a la izquierda, énfasis grande abajo a la derecha, repartidos por la zona | plano con mucho aire |
| `escalera` | palabras de la base en escalones, énfasis a la derecha | aire lateral, llamada a la acción |
| `lateral` / `lateralDer` | todo a un lado, líneas cortas | panel u objeto grande al centro |

```js
const PLAN = {
  escenas: { S: { zonas: [[80, 1120, 1000, 1440], [80, 250, 1000, 560]], tpl: ["escalon", "esparcido", "apilado"] } },
  bloques: { "pone los subtitulos": { detras: true, zona: [80, 300, 1000, 700], tpl: "apilado", entrada: "zoom" } },
};
```
Opciones por escena: `zona`, `zonas`, `zonaT(t, b)`, `tpl`, `entradaBase`, `entradas`, `maxBaseLinea`, `escalaBase`, `escalaEnf`, `rotEnf`, `aireY`, `anchoEsparcido`, `salida`, `salidaCorte`. Override por bloque (clave = texto en minúsculas y sin tildes; `"texto#2"` o `"texto#fin"` si se repite): `tpl`, `rol`, `tono`, `enfasis: [palabras]`, `todoBase`, `entrada`, `entradaBase`, `salida`, `detras`, `zona`, `cx`, `cy`, `tamEnf`, `tamBase`, `escalaEnf`, `escalaBase`, `rotEnf`, `aireY`, `maxBaseLinea`, `tFin`.

### Texto detrás del sujeto
- **Con vídeo de una persona:** `capaDetras` entre la placa (el vídeo entero) y el recorte con transparencia (`npx hyperframes remove-background`); `capaFrente` encima de todo. La línea de énfasis de un bloque `detras: true` va en la capa de detrás y la persona la tapa de verdad. Así está hecho `ejemplos/premium/`.
- **Con personaje 3D:** la capa de detrás va entre el contenido DOM y el canvas del personaje.
- Reglas: la cabeza **muerde** la palabra, no la esconde (15-30 % del pie de las letras); máximo 2 por vídeo; nada del bloque que quede delante sobre la cara. Ojo con otros objetos del canvas de delante: pueden tapar la palabra en vez de la persona.

### Sonido
`CaptionsEstilos.eventos(bloques)` devuelve dónde poner efectos: solo las entradas por letras (brillo → `pop`), las letras que caen (un `tick` por letra, hasta 4) y los deslizamientos (`swipe`). La base no suena. Cada evento trae `t` y `sfx` (efecto sugerido de `modulos/sonido/sfx/`); ponlo como `<audio data-capa="sfx">` con `data-start = t − transient_offset`.

### Legibilidad y zonas seguras
- Base ≥ 50 px tras escalar; si una zona obliga a escalar por debajo de ~0,75, cambia de plantilla o de zona.
- El módulo encierra el bloque en la zona segura de reel (y 240–1460, 40 px de lado, fuera de la columna de botones); verificalo igual con `scripts/zonas-seguras.mjs` sobre el MP4.
- Sombra difusa siempre; sobre fondo claro, un degradado radial detrás.
- Verifica sobre el MP4 renderizado, no sobre la vista previa (degradados por letra y máscaras del barrido).

### Proceso para un vídeo con `premium`
1. En el BRIEF: `Captions: premium`.
2. Copia `scripts/captions/captions-estilos.js` a `assets/` y escribe el plan: zona libre por escena medida sobre fotogramas (`npx hyperframes snapshot`), plantillas, entradas y 1-2 momentos `detras`.
3. En el `index.html`: capas `capDetras`/`capFrente`, `montar(...)` y un proxy de tiempo que llame `api.update(t)`.
4. Fotogramas fijos con el overlay de zonas seguras antes de construir el resto.
5. Efectos con `eventos()`.
6. Verificación sobre el MP4: varias entradas y salidas fotograma a fotograma, la oclusión del momento "detrás", zonas seguras.
