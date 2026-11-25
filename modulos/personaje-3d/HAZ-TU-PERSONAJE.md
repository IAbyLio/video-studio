# Haz tu propio personaje

Guía para pasar de "quiero un personaje" a uno que hable con lip-sync en tus vídeos. Sirve para la persona y para su IA:
la IA puede hacer casi todo esto si le das las referencias y le dices qué te gusta y qué no.

## 0. Antes de dibujar nada: la biblia

Escribe una ficha corta (cópiala de abajo a `PERSONAJE.md` en la carpeta de tu personaje). La lee quien escribe guiones
y quien construye el vídeo. Lo que no tengas decidido, márcalo como pendiente.

```markdown
# <Nombre>
- Qué es (una frase):
- Por qué existe en tu marca (qué idea encarna):
- Vía técnica: 3D por código | raster (imágenes) | cara sobre un objeto
- Se reconoce a 120 px por: <silueta, color, un rasgo único>
- Paleta (de tu DESIGN.md) y rasgos que NUNCA cambian entre poses:
- Cómo habla: registro, largo de frase, muletillas propias, lo que nunca dice
- Qué hace siempre en pantalla / qué no hace nunca
- Poses canónicas (nombre → cuándo) y expresiones (nombre → cuándo)
- Voz: perfil en modulos/voz/perfiles.json (o "sin voz todavía")
```

Una regla que ahorra problemas: el personaje no puede parecerse a uno con derechos de otro (mascotas conocidas,
personajes de series, logos). Si se te parece, cambia la silueta, no solo el color.

## 1. Desde fotos de referencia

1. Junta 3 a 6 referencias: fotos tuyas o de lo que quieras convertir en personaje, y 2 o 3 personajes cuyo estilo
   te guste (solo como estilo, no para copiarlos).
2. Pídele a tu IA que saque de las fotos los **rasgos obligatorios**: lo mínimo que hace que se reconozca (una forma de
   cabeza, un accesorio, un color, una proporción). Medidos, no "a ojo": por ejemplo "ojos a 1/3 desde arriba, cabeza
   = 1/2 del alto total".
3. Elige la vía (punto 2) y pide una primera versión. Compara en una lámina: referencia / versión 1 / versión 2, al
   mismo tamaño. Cambia de a una cosa por vuelta ("la cabeza de la 1, la boca de la 2").
4. Pruébalo chico: a 120 px de alto sobre tu fondo de marca. Si a ese tamaño no se entiende, simplifica.

Si el personaje eres tú (una versión animada tuya), los rasgos obligatorios salen de tus fotos; si vas a usar tu cara o
tu voz real, la decisión es tuya y de nadie más.

## 2. Tres vías

| Vía | Cómo | Bueno para | Coste |
|---|---|---|---|
| **3D por código** (la del muñeco) | Cuerpo en Three.js como función del tiempo + cara 2D de `cara.js` pintada en un canvas que se usa como textura | Girar, caminar, entrar en mundos 3D, poses nuevas en minutos | Gratis por pose; lleva su tiempo armar el primero |
| **Raster** (imágenes) | Poses generadas con un modelo de imagen + bocas recortadas + párpados, montadas encima | Look ilustrado inmediato | Cada pose nueva = generar (de pago) + medir + preparar. Las herramientas de preparación de sprites no vienen en este repo; el método está abajo |
| **Cara sobre un objeto** | `Cara.mount(...)`: ojos, cejas y boca dibujados por código sobre cualquier forma (una taza, una pantalla, un objeto filmado) | Que un objeto cobre vida; muy expresivo y gratis | Si el objeto se mueve en el vídeo, hay que seguirlo (`seguir-objeto.mjs`) |

Las tres comparten lo mismo: bocas de Rhubarb, puerta de silencio, parpadeo con semilla y todo calculado desde el tiempo.

### 3D por código, paso a paso

1. Copia `muneco/` a una carpeta nueva (`modulos/personaje-3d/<tu-personaje>/`).
2. En `personaje.js` cambia la forma: la función `deformar()` define el cuerpo; los brazos, piernas y accesorios son
   mallas simples (cápsulas, esferas, cajas redondeadas). Mantén el contrato `crear → { grupo, render(t), setGuion,
   posar, estado, alto }` y la regla de oro: nada de `Math.random()`, `Date.now()` ni estado que se acumule entre
   fotogramas.
3. La cara: elige estilo de ojo (`caricatura`, `bloque`, `pixel`, `ranura`) y de boca (`organica`, `geometrica`) en
   `poses.json → cara.rasgos`, y ajusta `cara.geometria` (separación y tamaño de ojos, altura y escala de la boca).
4. Paleta por opciones, y si quieres que tome tu marca, leela de las variables CSS como hace `paletaDesdeCSS()`.
5. Hoja de poses para revisar (`hacer-hoja.mjs`) y un demo de 10 s hablando antes de usarlo en un vídeo de verdad.

Estilos que salen bien por código: vinilo (formas lisas y brillo suave), plano recortable (capas planas con borde),
low-poly facetado (`flatShading: true`), plastilina (rugosidad alta, colores saturados). Todos con la misma estructura.

### Raster: el método (sin herramientas incluidas)

- Una **pose principal** (cuerpo entero, boca cerrada, ojos abiertos, fondo liso) y el resto **generadas con esa pose
  como referencia**, pidiendo explícitamente: mismo encuadre, misma escala, cabeza y cara exactamente en el mismo
  sitio, cambiar SOLO <lo que cambia>, "los dos ojos abiertos, sin guiño" (los modelos copian un guiño si lo ven).
- Hoja de bocas aparte: A cerrada, B entreabierta, C abierta, D muy abierta, E redonda, F redonda pequeña.
- Para montarlas: anclar las bocas a la base de la nariz de cada pose, borrar la boca original rellenando con la piel de
  alrededor (difusión, nunca un color plano: deja costura), recortar el fondo sin halo y verificar cada pose con cada
  boca a tamaño real.

## 3. Poses y expresiones como datos

Todo lo que cambia va en un JSON, no en el código (ver `muneco/poses.json`):

- **Poses**: por articulación, rotación `r` en grados, desplazamiento `p` y escala `s`, que se suman a la postura de
  base. `mira` mueve las pupilas. `ciclo` suma un movimiento repetido (caminar, saludar).
- **Transición**: duración y curva al pasar de una pose a otra, más un squash & stretch corto que disimula el cambio.
- **Expresiones** (formato de `cara.js`):

```json
{ "nombre": {
    "L": { "lidTop": 0.1, "lidBot": 0.02, "lidTilt": 0, "lidBulge": 1, "pupil": [0, 0], "browY": 0, "browTilt": 0, "browCurve": 4 },
    "R": { "...": "lo mismo para el otro ojo" },
    "pupilScale": 1, "eyeScale": 1, "mouth": { "scale": 1, "frown": 0, "skew": 0, "dy": 0 },
    "idleMouth": "X", "mouthMap": null, "noBlink": false, "jitter": 0 } }
```

L/R = ojo izquierdo/derecho EN PANTALLA. `lidTop`/`lidBot` de 0 (abierto) a 1 (cerrado). `lidTilt` en grados (+ =
ceño). `pupil` de -1 a 1. `browY` en px (negativo = sube), `browTilt` (+ = enfado, − = preocupación), `browCurve` =
arco. `mouth.frown` (+ comisuras abajo, − sonrisa). `idleMouth` = boca cuando no habla. `mouthMap` cambia unas bocas
por otras mientras dura la expresión (un grito no cierra la boca). `jitter` = temblor de pupilas (nervios).
`ojoForma: "feliz"` dibuja el ojo como ^ en los estilos bloque/pixel/ranura. Siempre existen además `neutral`, `alegre`,
`sorpresa` y `duda`.

- **Guion del personaje** en el vídeo: `setGuion({ poses: [[t, "pose"], ...], expresiones: [[t, "expresion"], ...],
  boca, inicioAudio, offset })`. Los tiempos salen de las palabras de la voz (`npx hyperframes transcribe`), con la
  palabra en un comentario al lado de cada número.

## 4. La boca: Rhubarb + puerta de silencio

```bash
bash scripts/personaje/instalar-rhubarb.sh            # una vez: release oficial a .cache/rhubarb/ (macOS con Rosetta, Linux)
node scripts/personaje/build-mouth-data.mjs --audio voz-final.wav --guion guion.txt --out bocas.json --js assets/boca-data.js --var MOUTH
```

- Va con el guion (`--guion`): sin texto, Rhubarb reconoce a ciegas y acierta menos. Usa el modo fonético porque su
  reconocedor de palabras es solo para inglés.
- **Puerta de silencio** (automática): si queda una boca abierta sobre ≥ 0,10 s de silencio, pasa a cerrada.
- **Siempre sobre la voz final.** Si después le cambias el tono o la velocidad, se desincroniza.
- Sin Rhubarb, `--envolvente` (o automático): boca por volumen. A tamaño narrador casi no se nota; en primer plano sí.
- Las bocas se embeben como `window.MOUTH = [...]` en un `.js`: nada se descarga durante el render.

| Rhubarb | Sonido | Boca |
|---|---|---|
| A | M B P | cerrada |
| B | K S T y casi todas las consonantes | dientes juntos |
| C | E, A abierta | abierta |
| D | A muy abierta | muy abierta |
| E | O | redondeada |
| F | U, W | "u" chica |
| G | F V | dientes sobre el labio |
| H | L | lengua arriba |
| X | silencio | la de reposo de la expresión |

## 5. Vida (que no parezca una foto)

Todo dentro de `render(t)`: respiración (escala vertical ±1–1,5 % cada ~3 s), balanceo leve, un pequeño bote y una
inclinación ligados a lo abierta que esté la boca (acompaña al habla), parpadeo cada ~3 s con variación sembrada,
micro-movimientos de pupila, y squash & stretch amortiguado de ~0,3 s en cada cambio de pose.

## 6. Dónde ponerlo en un reel (zonas seguras)

- Narrador a un lado: abajo a la izquierda, pies en y ≈ 1455 (nunca por debajo de 1470: lo tapa el texto del post),
  alto 400–450 px, y captions en un bocadillo a su derecha (x ≤ 895, que a la derecha están los botones).
- Contenido (tarjetas, 3D, llamada a la acción) por encima, entre y 240 y ≈ 1000.
- Si es más ancho que alto (brazos abiertos), córrelo hacia el centro hasta que las manos no salgan del margen de 35 px.
- Cuenta todo el recorrido: al saludar o celebrar las manos suben y se abren. Verifica esos fotogramas con
  `node scripts/zonas-seguras.mjs <png> --format reel`.

## 7. La voz del personaje

- Opciones: tu voz grabada, la voz local de Hyperframes (`npx hyperframes tts`), tu clon, o una voz diseñada por
  descripción en ElevenLabs. Una voz nueva es una **identidad nueva**: se declara como perfil en
  `modulos/voz/perfiles.json` con su nota de autorización, o `scripts/voz.mjs` no la usa.
- Para "más dibujo animado", subir 3–4 semitonos (`postproceso.semitonos` del perfil; gratis, con ffmpeg, no cambia la
  duración).
- Un personaje admite etiquetas de emoción del modelo v4 (`[playful]`, `[whispers]`…). Guía: `modulos/voz/`.
- Un tramo de voz por párrafo: si una frase sale mal, se rehace solo esa. `unir-tramos.py` une los tramos con pausas
  elegidas y `check-voz.sh` transcribe cada tramo para ver que no falte ni sobre texto. Escuchar entero sigue siendo
  la prueba que vale.

## 8. Trampas conocidas

| Pasa esto | Por esto | Se arregla así |
|---|---|---|
| Boca abierta sobre un silencio | Rhubarb a veces deja la última boca | Puerta de silencio (viene puesta), no tocar el audio |
| La boca va adelantada o atrasada | Las bocas se sacaron antes de cambiar tono/velocidad de la voz | Volver a sacarlas sobre la voz final |
| El personaje salta al hacer scrub hacia atrás | Algo se acumula entre fotogramas (física, contadores) | Calcular todo desde `t` |
| Costura de color alrededor de la boca o los párpados (raster) | Se tapó con un color plano | Rellenar por difusión con la piel de alrededor |
| Guiño que aparece en todas las poses (raster) | El modelo lo copió de la referencia | Pedir "los dos ojos abiertos, sin guiño" |
| Las bocas no cargan en el render | Se pidieron por `fetch` | Embeberlas en un `.js` (`window.MOUTH`) |
| Narrador cortado o tapado | Pies por debajo de y 1470 o mano en la columna de botones | Subirlo / achicarlo y repasar con el overlay |
| La cara se ve estirada en 3D | El parche de la cara no tiene la proporción del canvas | Ajustar `cara.zoom` y `cara.geometria`, o el tamaño del parche |
