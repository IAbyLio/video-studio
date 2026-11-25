# Voz (clon con ElevenLabs)

Genera la voz de tus guiones con tu clon de voz (o una voz de tu cuenta). **De pago:** gasta caracteres de tu plan de ElevenLabs. Alternativas gratis: tu propia grabación, o la voz local de Hyperframes (`npx hyperframes tts --list`; necesita Python y un paquete extra que te indica `npx hyperframes doctor`).

## Antes de nada: tu voz declarada
El registro `perfiles.json` viene **vacío**. `voz.mjs` no genera con ninguna voz que no esté ahí, habilitada y con una nota de autorización (de quién es la voz y quién lo permitió). Así nunca se usa una voz por error.

1. En ElevenLabs, clona tu voz (Voices → Add voice) o elige una de tu biblioteca, y copia su **Voice ID**.
2. Agrega tu perfil a `perfiles.json` (la IA lo hace contigo; nunca le pegues tu clave, solo el Voice ID):
   ```json
   "perfiles": {
     "mi_voz": {
       "nombre": "Mi voz", "nombre_remoto": "<nombre exacto de la voz en ElevenLabs>", "voice_id": "<Voice ID>",
       "habilitado": true, "modelo": "v2", "language_code": "es",
       "settings": { "v2": { "stability": 0.6, "similarity": 0.9, "style": 0, "speed": 1 }, "v4": { "stability": 0.65, "similarity": 1 } },
       "postproceso": { "semitonos": 0 },
       "autorizacion": "Mi propia voz, clonada por mí el AAAA-MM-DD para mis vídeos."
     }
   }
   ```
3. Tu clave va en `.env` (`ELEVENLABS_API_KEY=...`), escrita por ti en tu editor.
4. Comprueba sin gastar:
   ```bash
   node scripts/voz.mjs --dry-run                         # con el registro vacío te explica esto mismo
   node scripts/voz.mjs --perfiles
   node scripts/comprobar-cuentas.mjs --en-linea          # consulta gratuita: plan y caracteres usados
   ```

## Generar (gasta)
```bash
node scripts/voz.mjs proyectos/<slug>/guion-audio.txt --output proyectos/<slug>/assets/voz.mp3
node scripts/voz.mjs proyectos/<slug>/guion-audio.txt --output ... --only 3     # rehace solo el párrafo 3
node scripts/voz.mjs ... --model v4                                            # con etiquetas [calm] etc.
```
Antes de generar, `voz.mjs` comprueba que ElevenLabs devuelve ese mismo Voice ID con el mismo nombre; si no coincide, cancela.

`postproceso.semitonos` (entero −12..12) sube o baja el tono con ffmpeg, sin créditos y sin cambiar la duración: útil para la voz de un personaje (+3 / +4 la vuelve más "de dibujo").

## Archivos
- `perfiles.json`: tus voces (vacío al empezar).
- `guion-para-voz.md`: cómo escribir el texto para que entone bien (v2 y v4).
- `scripts/voz.mjs`, `scripts/voice-profile.mjs`: generación y registro.
- `scripts/personaje/unir-tramos.py`, `check-voz.sh`: unir tramos con pausas elegidas y revisar cada tramo transcribiéndolo.

**Regla:** solo voces tuyas o con permiso explícito de su dueño.
