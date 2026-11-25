# Sonido (método simple: efectos por capas)

Efectos de sonido sincronizados al fotograma, en capas, y render por etapas para afinar sin rehacer todo. Funciona sin cuentas: el repo trae una mini-librería de 8 efectos **sintetizados por código** (licencia MIT, como el resto).

## La librería
```bash
node scripts/sfx-manifest.mjs list        # qué hay, cuánto dura, cuándo suena
```
| Efecto | Para |
|---|---|
| `whoosh` | cambio de escena, entrada de tarjeta grande |
| `swipe` | deslizar un panel, cambio dentro de una tarjeta |
| `click` | clic en un botón, marcar una casilla |
| `pop` | aparece un elemento chico |
| `tick` | contador que sube, paso de una lista |
| `riser` | tensión antes de un golpe (el pico está al final) |
| `impacto-suave` | palabra clave, golpe de cámara, sello |
| `tecleo` | texto que se escribe letra a letra |

Cada uno tiene su ficha en `sfx/sfx-manifest.json`: duración, `transient_offset` (segundos de silencio antes del sonido, medido con ffmpeg), volumen por defecto, licencia y origen. `node scripts/sfx-sintetizar.mjs` los regenera idénticos.

## Cómo se ponen en un vídeo
1. Copia el WAV a `assets/sfx/` del proyecto (cada proyecto es portable).
2. Un `<audio>` por efecto, con `id` único (sin id sale mudo), su pista y la marca de capa:
   ```html
   <audio id="sfx-golpe" data-capa="sfx" src="assets/sfx/impacto-suave.wav"
          data-start="0.68" data-duration="0.92" data-track-index="40" data-volume="0.45"></audio>
   ```
   `data-start` = instante del evento − `transient_offset`. En el `riser`, el pico está al final: `data-start` = evento − `duration`.
3. Voz en su propia pista (p. ej. 10) **sin** `data-capa`; música con `data-capa="music"`.
4. Comprueba que suenan donde deben: `ffmpeg -ss <t> -t 0.2 -i renders/x.mp4 -af volumedetect -vn -f null -` (el golpe ronda −10 a −15 dB; el silencio real, −91).

Reglas de oído: efectos desde eventos visuales reales (no a ojo), no en cada cosa (más o menos la mitad de los eventos), nada de golpes después de frases tranquilas, la voz siempre por encima.

## Render por etapas
```bash
node scripts/stage-render.mjs proyectos/<slug> visual   # sin efectos ni música
node scripts/stage-render.mjs proyectos/<slug> sfx      # con efectos, sin música
node scripts/stage-render.mjs proyectos/<slug> music    # todo
```
Trabaja sobre una copia temporal y siempre deja tu `index.html` como estaba.

## Música
El repo no trae música. Pon tus temas (con licencia para usarlos) en `musica/` con un `music-manifest.json`:
```json
{ "tracks": { "tema-calma": { "file": "tema-calma.wav", "duration": 92.4 } } }
```
Y hornea una sola pista con fundidos:
```bash
node scripts/music-bed.mjs --plan plan.json --out proyectos/<slug>/assets/musica.wav
# plan.json: [{ "track": "tema-calma", "start": 0, "fade_in": 1, "fade_out": 2, "duration": 30 }]
```
Música baja, por debajo de la voz (unos 15 dB menos), y que se vaya antes del remate.

## Sumar efectos
- **Tuyos:** WAV mono 44,1 kHz en `sfx/`, mide el arranque (`node scripts/sfx-measure.mjs sfx/mi-efecto.wav`) y agrega la entrada al manifest (`node scripts/sfx-manifest.mjs validate` para comprobar). Solo sonidos con licencia que te permita usarlos (propios, CC0, comprados).
- **Generados con tu cuenta de ElevenLabs** (gasta créditos):
  ```bash
  node scripts/sfx-generate.mjs "soft paper swoosh, short" --name papel --dry-run       # qué haría
  node scripts/sfx-generate.mjs "soft paper swoosh, short" --name papel --confirmo-gasto
  ```
  Revisa los términos de ElevenLabs antes de publicar o compartir lo generado.
- **Sintetizados:** suma una receta a `scripts/sfx-sintetizar.mjs` (ruido y osciladores filtrados, con semilla).

> Un método de mezcla más completo (máster a volumen de plataforma, biblioteca grande, medición automática) queda fuera de este repo a propósito.
