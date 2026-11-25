# Editar lo que grabas

De una grabación tuya a cámara (móvil, webcam, cámara) a un clip limpio y encuadrado en vertical, listo para ponerle captions, gráficos y efectos. Corta silencios, tomas repetidas, arranques en falso y muletillas. **Tú confirmas lo dudoso antes de cortar.** Todo corre en tu ordenador, sin cuentas.

## Qué necesita
- Node, FFmpeg (ya los tienes si instalaste el estudio).
- `whisper-cli` (motor de transcripción) y un modelo whisper:
  - macOS: `brew install whisper-cpp`. Linux/Windows: whisper.cpp desde su página oficial (github.com/ggml-org/whisper.cpp). La IA te lo propone y espera tu OK.
  - Modelo: se baja la primera vez con `npx hyperframes transcribe <un-audio> --model small --language es` (~490 MB). El carril usa el mejor que tengas (`large-v3` > `medium` > `small`).
- Detección de cara para encuadrar: solo en macOS (usa Vision, se compila sola la primera vez si tienes las herramientas de línea de comandos de Xcode). En otros sistemas, o si no detecta bien, se encuadra centrado o con `--cara x`.

## El método
1. **El audio manda.** Se corta pensando en lo que se oye; el vídeo acompaña en el mismo instante.
2. **Transcribir bien antes de decidir:** un whisper por **tramo de voz** (cada tramo empieza y termina en silencio medido). Sobre audio con silencios largos, whisper inventa y se corre.
3. **Los tiempos de whisper fallan; la energía del audio no.** Cada palabra se ancla a los bordes de voz reales y a las micro-pausas de las comas.
4. **La IA propone, tú confirmas lo dudoso.** `cortes.json` lista cada descarte con su motivo; lo dudoso nace `pendiente` y no se corta hasta que lo decides.
5. **Cortar en una pasada:** cada tramo con número exacto de fotogramas y de muestras, micro-fundido de audio en cada junta. Unir trozos sueltos con `-c copy` desincroniza (en una prueba real, casi un segundo al final de un reel).
6. **Verificar midiendo:** re-transcribe el resultado (una junta que se come una palabra aparece en el texto), busca clics en las juntas y compara vídeo con audio.
7. **Encuadrar después,** sobre el clip ya cortado: 9:16 centrado en la cara y zooms suaves en las juntas (disimulan el salto).
8. **Todo lo que viene después vive en tiempo del clip cortado** (captions, gráficos, efectos).

| Motivo de corte | Qué detecta | Decide |
|---|---|---|
| `silencio` | Pausas de 0,6 s o más (deja un poco de aire) | IA (puedes conservar una pausa dramática) |
| `toma-repetida` | Frases casi iguales seguidas: se queda la última completa | IA |
| `arranque-en-falso` | Frase corta que es el principio de la siguiente | IA |
| `entre-tomas` | Lo que queda entre una toma descartada y la buena | **Tú** |
| `repeticion-inmediata` | "vamos a, vamos a ver" (2-4 palabras); 1 palabra ("el el") queda pendiente | IA / tú |
| `muletilla` segura | eh, ehm, mmm | IA |
| `muletilla` dudosa | o sea, bueno, vale, pues, en plan... (también son palabras con contenido) | **Tú** |
| `manual` | Lo que agregues | Tú |

**Nunca automático:** decidir qué se dice. El carril limpia la grabación; no reescribe tu mensaje.

## Comandos

```bash
# Fase 1: analiza y PARA (no corta nada)
node scripts/bruto/editar.mjs ruta/a/tu-grabacion.mov --proyecto proyectos/<slug>
#   → proyectos/<slug>/bruto/cortes.md   ← la IA te lo resume; decides los "pendiente"

# (si cambiaste decisiones en cortes.json)
node scripts/bruto/analizar.mjs --replanificar proyectos/<slug>/bruto/cortes.json

# Fase 2: corta, verifica (para si algo no pasa), encuadra y copia al proyecto
node scripts/bruto/editar.mjs --continuar proyectos/<slug> --cara auto --zooms cortes
```

Opciones útiles de `analizar.mjs`: `--modelo small|medium|large-v3`, `--ruido -40` (si hay ruido de fondo y no detecta silencios), `--silencio-max 0.8`, `--muletillas "eh,mmm"`, `--dudosas "bueno,o sea"`.

Queda en `proyectos/<slug>/assets/`: `bruto-9x16.mp4` (el clip cortado y encuadrado), `voz-cortada.wav`, `words.json` (palabras con tiempos del clip), `transcript-cortado.json`, `mapa-tiempos.json` y `bruto-encuadre.json`.

## Enchufarlo en un vídeo
```html
<!-- el <video> va muted, sin class="clip", y nunca dentro de un elemento con data-start -->
<div id="cara"><video id="clip" src="assets/bruto-9x16.mp4" muted playsinline data-start="0" data-duration="15.87" data-track-index="0"></video></div>
<audio id="voz" src="assets/voz-cortada.wav" data-start="0" data-duration="15.87" data-track-index="10"></audio>
```
- Captions: `node scripts/generate-captions.mjs proyectos/<slug>/assets/words.json …` (ver `modulos/captions/`).
- Gráficos: anclados al inicio de la palabra que los dispara (`words.json`). `bruto-encuadre.json → intervalos[].caraSalida` dice dónde está la cara para no taparla.
- Estilos que lo usan: *cara a cámara*, *pantalla partida*, *texto detrás del sujeto*.

## Trampas
- **Móviles graban con frame rate variable:** el corte lo normaliza a 30/60 fps en la misma pasada.
- **Respiraciones** contadas como voz adelantan el caption: los bordes se miden contra el nivel de habla.
- **Frases fantasma de whisper** en tramos de ruido ("Subtítulos realizados por…"): se filtran.
- **Encuadre de fuente horizontal:** si la cara está baja, la barbilla cae bajo y 1470; un zoom anclado a la cara la sube. 1080p horizontal a vertical amplía ×1,78: mejor grabar en vertical o en 4K.
- **El bruto no se toca:** todo sale a carpetas nuevas.

Probado en el estudio de origen con grabaciones de prueba (voz sintética y voz humana de dominio público con silencios insertados); en este repo, con un bruto sintético (ver INFORME de la prueba).
