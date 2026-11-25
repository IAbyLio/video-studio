# Captions palabra a palabra

Subtítulos donde cada palabra aparece justo cuando se dice. Funcionan con cualquier voz: tu grabación, una voz local o tu clon.

## Estilo de captions (se elige en cada vídeo)

Antes de cada vídeo con voz, la IA te pregunta qué estilo de captions quieres:

| Estilo | Cómo se ve | Estado |
|---|---|---|
| `natural` | 1 a 3 palabras centradas (x = 540), la palabra clave en otro color, cada palabra entra cuando se dice. Es el de los ejemplos de `estilos/` | Probado |
| `premium` | Base sobria + línea de énfasis en otra tipografía y tamaño con brillo, entradas y salidas variadas con desenfoque, el texto cambia de sitio y se reparte por la pantalla, y va detrás del sujeto cuando hay recorte o 3D | Experimental (ejemplo renderizado; método sin validar todavía en piezas publicadas) |

Guía completa y API: [`ESTILOS.md`](ESTILOS.md). Módulo: `scripts/captions/captions-estilos.js`. Ejemplos que renderizan: `ejemplos/natural/` y `ejemplos/premium/`.

## De la voz a los captions (tres pasos)

```bash
# 1. Transcribir en tu ordenador (gratis; la primera vez baja el modelo, ~490 MB el "small")
cd proyectos/<slug>
npx hyperframes transcribe assets/voz.wav --model small --language es --json     # → transcript.json

# 2. Agrupar en bloques cortos y generar el HTML + las líneas de animación
node ../../scripts/generate-captions.mjs transcript.json captions.html captions.json --palabras-clave ../../modulos/captions/palabras-clave.ejemplo.json

# 3. Pegar los bloques de captions.html en el index.html y las líneas de captions.json → "timeline" en el <script>
```

`generate-captions.mjs` entiende tres formatos: el `transcript.json` de Hyperframes, el `words.json` del módulo *editar lo que grabas* y el formato de whisper-cli.

## Reglas que funcionan
- **Corrige el texto contra el guion:** la transcripción automática se equivoca en nombres propios, cifras y palabras raras. La IA no puede oír el audio: si duda de una palabra, te pregunta.
- **Captions cerca del centro**, nunca pegados abajo (ahí está la interfaz de la app). Lo centrado se centra en x = 540, con ancho máximo 710 px.
- **Una idea por bloque**, sin líneas que terminen en preposición o artículo.
- **No dupliques**: si la frase ya está en pantalla como titular, el caption calla en ese tramo.
- **Contorno con `text-shadow`**, no con `-webkit-text-stroke` (se ve distinto en el render).
- Transcribe por tramos si el audio tiene silencios largos: whisper sobre el archivo entero puede correrse hasta medio segundo.

## Archivos
- `scripts/generate-captions.mjs`: transcript → bloques + timeline.
- `scripts/captions/captions-estilos.js`: los dos estilos (`montar`, `componer`, `eventos`, `tokensDesdeCSS`).
- `palabras-clave.ejemplo.json`: palabras que se resaltan (positivas en `--acento-2`, negativas en `--negativo`). Cópialo y pon las tuyas.
