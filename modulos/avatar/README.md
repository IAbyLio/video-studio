# Avatar de vídeo (HeyGen)

Un vídeo tuyo hablando sin grabarte: tu avatar de HeyGen con tu voz (tu clon de ElevenLabs o tu grabación). Después se usa como base de los estilos *cara a cámara*, *pantalla partida* o *texto detrás del sujeto*, igual que si te hubieras grabado. **De pago:** gasta créditos de tu cuenta de HeyGen. Nada se genera sin tu OK.

> Este repo no trae avatares ni IDs de nadie. El flujo de abajo se usó en piezas reales en el estudio de origen (mayo-julio 2026); las APIs cambian: si un paso no coincide, la IA lo revisa en la documentación oficial (developers.heygen.com) antes de improvisar.

## Qué necesita
- Cuenta de HeyGen con un avatar **tuyo** (hecho con tu vídeo y tu consentimiento) y su API key en `.env` (`HEYGEN_API_KEY=...`, escrita por ti).
- La voz: `voz.mp3` hecho con el módulo `modulos/voz/` o tu grabación limpia.
- Comprobación gratis: `node scripts/comprobar-cuentas.mjs --en-linea` (consulta tu cuota restante, no genera nada).

## El flujo por API (tres llamadas y una espera)

1. **Subir el audio como asset** (gratis):
   ```bash
   curl -s -X POST "https://upload.heygen.com/v1/asset" \
     -H "X-Api-Key: $HEYGEN_API_KEY" -H "Content-Type: audio/mpeg" --data-binary "@proyectos/<slug>/assets/voz.mp3"
   # → data.id = audio_asset_id
   ```
2. **Elegir el look y comprobar que admite el motor nuevo** (gratis):
   ```bash
   curl -s -H "X-Api-Key: $HEYGEN_API_KEY" "https://api.heygen.com/v2/avatar_group/<tu-grupo>/avatars"   # tus looks, con preview_image_url
   curl -s -H "X-Api-Key: $HEYGEN_API_KEY" "https://api.heygen.com/v3/avatars/looks/<avatar_id>"      # supported_api_engines incluye "avatar_v"
   ```
   Mira el fondo del look: si es oscuro o neutro compone directo; si es claro y tu marca es oscura, vas a querer recortarlo (`npx hyperframes remove-background`).
3. **Lanzar el render** (GASTA: pide OK y mira el precio en tu panel antes):
   ```bash
   curl -s -X POST "https://api.heygen.com/v3/videos" -H "X-Api-Key: $HEYGEN_API_KEY" -H "Content-Type: application/json" -d '{
     "type": "avatar", "avatar_id": "<avatar_id>", "audio_asset_id": "<del paso 1>",
     "engine": { "type": "avatar_v" }, "resolution": "1080p", "aspect_ratio": "9:16", "title": "<slug>"
   }'
   # → data.video_id
   ```
   `audio_asset_id` y `script` son excluyentes: con tu audio, HeyGen no pone su voz.
4. **Esperar y bajar** (tarda unos minutos):
   ```bash
   curl -s -H "X-Api-Key: $HEYGEN_API_KEY" "https://api.heygen.com/v1/video_status.get?video_id=<video_id>"
   # status "completed" → bajar data.video_url a proyectos/<slug>/assets/avatar.mp4
   ```
   Consulta cada 20-30 s; no hagas decenas de consultas seguidas.

## Después
- Transcribe la voz FINAL para los captions (`modulos/captions/`).
- Clona el estilo con `node scripts/nuevo-proyecto.mjs <slug> --estilo talking-head` y reemplaza `assets/persona.mp4` por `assets/avatar.mp4`.

## Trampas conocidas
- **Dos bolsillos de créditos:** en HeyGen la API puede descontar de un saldo distinto al de la web, o del mismo a otra tarifa. Si la API dice "sin créditos" y en la web ves saldo, revisa los dos en el panel antes de concluir nada.
- **Cada `<audio>` y `<video>` con `id` único** en la composición.
- **El avatar es tu identidad:** solo avatares tuyos o con permiso escrito de la persona.
