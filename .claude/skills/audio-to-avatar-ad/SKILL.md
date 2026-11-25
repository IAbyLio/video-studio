---
name: audio-to-avatar-ad
description: "Pipeline de un anuncio o pieza vertical 9:16 que parte de un audio de voz y termina en un MP4 publicable: audio limpio, avatar de HeyGen que lo habla (de pago, con la cuenta de la persona), escenas de apoyo con gráficos sobre fondo de cuadrícula, palabra protagonista detrás del sujeto, captions, CTA y efectos de sonido. Úsala cuando la persona pida un anuncio o vídeo con su avatar a partir de un audio o de un guion con su voz, o quiera iterar uno ya hecho."
when_to_use: "Frases típicas: 'anuncio con mi avatar', 'haz que mi avatar diga este audio', 'convierte esta nota de voz en un anuncio', 'vídeo de 45 segundos con mi avatar y gráficos'. Requiere el módulo avatar activado y una cuenta de HeyGen con un avatar propio. No usar para un reel con grabación real (short-form-video), para un vídeo largo (long-form-video) ni para generar solo la voz (modulos/voz)."
---

# Del audio al anuncio con avatar (9:16)

De un **audio de voz** a un **MP4 vertical publicable**: tu avatar de HeyGen hablando ese audio, escenas de apoyo con gráficos, la palabra protagonista detrás de ti, captions, CTA y efectos. Se apoya en lo que el repo ya trae: `modulos/voz/`, `modulos/avatar/`, el estilo `estilos/texto-detras/`, `modulos/captions/`, `modulos/sonido/` y `modulos/zonas-seguras/`. Antes de tocar composiciones, usa `short-form-video` (andamio y verificación) y las skills oficiales `hyperframes` y `gsap-core`.

**Gasta dinero en dos pasos:** la voz clonada (si se genera) y el render del avatar. Cada uno pide un sí explícito con el precio a la vista en el panel de la persona. Nada de pedir claves en el chat: van en `.env`.

## Pipeline
1. **Audio.** Ideal: la versión limpia. Si viene en bruto:
   - Corta la etiqueta de toma hablada del principio ("toma dos") y las pausas largas del gancho.
   - **Los tiempos de whisper fallan al principio** (pueden correrse segundos): confirma cada corte con la energía real del audio, por ventanas de 0,1 s: `ffmpeg -ss <t> -t 0.1 -i voz.wav -af volumedetect -f null -`. Al final suele colarse una frase inventada dentro del silencio ("Gracias", "Subtítulos por…"): córtala.
   - Opcional, con su OK: un poco más rápido (`atempo=1.08` a `1.10`), `highpass=f=80` y `loudnorm=I=-16:TP=-1.5:LRA=11`. Si hay ruido de fondo, una versión con reducción de ruido **de la misma duración exacta** se cambia sin tocar ningún tiempo.
   - Dile a la persona qué cortaste. Si no hay audio y hay guion: voz con `modulos/voz/` (gasta) o grabada por la persona.
2. **Transcribe el audio FINAL** (después de cortes y tempo): `npx hyperframes transcribe assets/voz.wav --model small --language es --json`. Los modelos `*.en` no sirven para español.
3. **Avatar** con el flujo de `modulos/avatar/README.md`: subir el audio como asset (gratis), comprobar que el look admite el motor `avatar_v` y orientación vertical (gratis), lanzar el render (**gasta**, con OK), esperar consultando cada 20-30 s y bajar `assets/avatar.mp4` (1080x1920). Solo avatares de la propia persona o con permiso escrito.
4. **Proyecto:** `node scripts/nuevo-proyecto.mjs <slug> --estilo talking-head --formato <reel|ad-vertical>` y cambia `assets/persona.mp4` por el avatar. Escribe en el `BRIEF.md` los beats con sus tiempos.
5. **Escenas** (abajo).
6. **Recorte del sujeto** para la palabra detrás (abajo).
7. **Efectos de sonido** (abajo).
8. **Gates:** lint → fotogramas mirados y zonas seguras → vista previa con OK → borrador → agente `video-qa` → final. Comprueba que cada efecto suena (`volumedetect` en su instante).

## Estructura del anuncio (~45-50 s, algo cambia cada 1,5-4 s)
Gancho (avatar + palabra protagonista) → 3 errores o mitos (escenas de apoyo) → giro (avatar + protagonista) → remate (escena de apoyo) → vuelta corta al avatar → CTA.

- **Fondo de las escenas de apoyo:** `var(--fondo)` + cuadrícula en perspectiva muy sutil que deriva despacio + halo radial tenue de `--acento` + grano al 3-4 % + viñeta. Aquí el avatar no está en plano.
- **Escena de apoyo = panel opaco** que cubre al avatar, con una pestaña grande "Error 1" (palabra y número, no "01"), un título y un gráfico que parezca un dato (tarjeta con sello, tablero, contador, embudo, lista que se marca). **Que se note el cambio dentro de la tarjeta** (colores distintos, icono, etiqueta). El remate, en segunda persona ("SIGUES SIN VENDER").
- **Palabra protagonista detrás del sujeto:** palabra completa ("TRES", no "3"), escalada para entrar centrada sin cortarse, sobre la frente y no sobre los ojos, una o dos veces en todo el vídeo. Entrada de máquina de escribir: `clip-path` de `inset(0 100% 0 0)` a `inset(0 0% 0 0)` con `ease: 'steps(número de letras)'` + el efecto `tecleo`. Degradado de `--texto` a `--acento` (positivo) o a `--negativo` (alerta).
- **Variante con apoyo:** la palabra grande detrás y el resto de la frase en `--texto-suave` encima del sujeto, pegada a la grande.
- **Fondo del avatar:** si el look tiene un fondo claro que choca con la marca oscura, recorta al sujeto y compónlo sobre la cuadrícula. En el gancho y en la vuelta antes del CTA suele funcionar mejor el fondo natural del look (más cercano), con viñeta de borde.
- **Captions:** cerca de la cara (hacia y 1110), sin solaparse, sin repetir la palabra protagonista, solo en las partes con avatar (en las de apoyo hablan los gráficos). Estilo `natural` o `premium` (`modulos/captions/`).
- **CTA:** botón con `--acento` y `--radio`, microcopia y flecha, sobre el avatar con viñeta para que se lea, dentro de la zona segura.
- **Fuentes:** las de `marca/marca.css`, con `@font-face` dentro del `<style id="marca">` del `index.html`.

## Recorte y palabra detrás
1. **Recorte gratis y en local:** `npx hyperframes remove-background assets/avatar.mp4 -o assets/avatar-recorte.webm` (la primera vez baja un modelo). Si el vídeo es largo, recorta solo los tramos donde se ve el avatar.
2. **Capas sobre el mismo vídeo** (como `estilos/texto-detras/`): placa con el vídeo entero (z0) < palabra (z1) < recorte (z2). Los mismos píxeles tapan la palabra donde está el cuerpo: los bordes no se ven.
3. **Sobre fondo oscuro** (look con fondo claro): cuadrícula (z0) < palabra (z1) < recorte (z2) < etiquetas (z3). Si el borde del recorte deja halo, suavízalo o vuelve al fondo natural en ese tramo.
4. **Destello de un fotograma:** usa `fromTo` explícito, no `from`. Una placa de contraste detrás de la palabra se anima después de que entra el recorte, no desde el fotograma 0.
5. Los dos `<video>` en la raíz, con el mismo `data-start` y `data-duration`, nunca dentro de una sub-composición ni de un elemento con tiempo. Si el recorte sale sucio en cabeza y hombros, díselo a la persona y pon la palabra delante.

## Efectos de sonido (librería del repo, `modulos/sonido/`)
`data-start` = instante del evento − `transient_offset` del manifest; cada `<audio>` con `id` único (sin id sale mudo) y `data-capa="sfx"`, pistas desde la 40; la voz en la pista 10, sin `data-capa`. Punto de partida (confírmalo con la persona: cambia por pieza):

| Momento | Efecto |
|---|---|
| Cambio avatar ↔ escena de apoyo | `whoosh` |
| Sello o golpe fuerte, palabra protagonista | `impacto-suave` |
| Tensión antes del giro | `riser` (su pico está al final: `data-start` = evento − duración) |
| Entrada de tarjeta y cada cambio dentro de ella | `swipe` |
| Algo positivo que aparece | `pop` a volumen bajo |
| Lista que se marca, contador | `tick` |
| Máquina de escribir | `tecleo`, cortado con `data-duration` al largo del revelado |
| CTA | `click` |

Comprueba que suenan: `ffmpeg -ss <t> -t 0.2 -i renders/borrador.mp4 -af volumedetect -vn -f null -` (un golpe ronda −10 a −15 dB; el silencio, −91).

## Trampas
- `<audio>` o `<video>` sin `id` → mudo o ignorado.
- Cada render lee el vídeo del avatar: un borrador tarda más que en otros estilos. Normal.
- HeyGen puede cobrar la API de un saldo distinto al de su web: si dice "sin créditos" y ves saldo, revisa los dos antes de concluir nada.
- Las APIs cambian: si un paso de HeyGen no coincide, revisa su documentación oficial antes de improvisar.

## Skills relacionadas
`nuevo-video` (entrada) · `short-form-video` (andamio y verificación) · `analisis-viralidad` (guion antes de la voz) · `hyperframes`, `media-use`, `gsap-core` (oficiales).
