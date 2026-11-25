# video-studio

Un estudio de vídeo que se maneja hablando con tu IA. Le pides "hazme un reel de 20 segundos con estos tres puntos" y tu IA escribe el vídeo como una página animada (textos, animaciones, captions palabra a palabra, 3D) y lo convierte en un archivo de vídeo **en tu ordenador**.

Antes de cada vídeo te pregunta qué **estilo visual** quieres (cara a cámara, pantalla partida, texto detrás de ti, personaje 3D, mundo 3D, pizarra viva, reel sin cara, tarjetas de vidrio, gancho generado con IA) y lo arma con **tu marca**, que saca de tus propios archivos (manual, logos, web).

<p>
<img src="estilos/talking-head/miniatura.png" width="110"> <img src="estilos/split-screen/miniatura.png" width="110"> <img src="estilos/texto-detras/miniatura.png" width="110"> <img src="estilos/personaje-narrador/miniatura.png" width="110"> <img src="estilos/mundo-3d/miniatura.png" width="110">
<img src="estilos/pizarra-viva/miniatura.png" width="110"> <img src="estilos/sin-avatar/miniatura.png" width="110"> <img src="estilos/liquid-glass/miniatura.png" width="110"> <img src="estilos/gancho-ia/miniatura.png" width="110">
</p>

Catálogo completo: [`estilos/README.md`](estilos/README.md).

## Para quién
Para quien hace contenido (reels, shorts, stories, vídeos para su web) y quiere hacerlo pidiéndolo en palabras normales, sin aprender un editor. No hace falta saber programar: la IA instala, pregunta y te muestra todo antes de renderizar.

## Qué necesitas
- **Una IA que trabaje en tu ordenador con acceso a la terminal.** Probado con **Claude Code** (app de escritorio, extensión de VS Code o terminal). Con Codex y otros agentes debería funcionar, pero no está probado. El chat de una IA en el navegador no sirve: no puede instalar ni renderizar.
- Un ordenador con macOS, Windows o Linux (probado en macOS con chip Apple).
- Unos 2-3 GB libres para todo lo que se descarga.

## Qué cuesta (de verdad)
| Pieza | Cuesta |
|---|---|
| Este repo | Gratis (licencia MIT) |
| Hyperframes, GSAP, Three.js, FFmpeg, Node.js, whisper, Rhubarb | Gratis (código abierto o licencia gratuita) |
| Renderizar, transcribir, recortar a la persona, lip-sync | Gratis: corre en tu ordenador |
| **La IA que lo maneja** (Claude Code u otra) | **De pago**, aparte: un plan que la incluya o su API. Instalar y hacer cada vídeo gasta uso de tu plan |
| Clon de voz (ElevenLabs), avatar (HeyGen), IA de vídeo para ganchos | **De pago y opcionales**, con tu cuenta. Tu IA te pregunta antes de cada gasto |

## Cómo empezar
1. Clona el repo: `git clone https://github.com/IAbyLio/video-studio` (o descarga la carpeta).
2. Ábrela con tu IA y dile: **"Sigue ONBOARDING.md"**.
3. Responde sus preguntas: qué quieres hacer, qué cuentas tienes, dónde están tus archivos de marca y dónde publicas. Al final hacen juntos un primer vídeo de unos segundos.
4. Desde ahí, en cualquier sesión dentro de la carpeta: *"Hazme un vídeo de…"*.

Siempre te deja una **vista previa** en el navegador y te pregunta antes de hacer el vídeo final. El resultado queda en `proyectos/<nombre>/renders/`; lo subes tú.

### Claude Code en la app de escritorio
Abre la app, elige "abrir carpeta" (o arrastra la carpeta) y escribe "Sigue ONBOARDING.md". Cuando te pida permiso para correr un comando, lee qué es y acepta si estás de acuerdo.

### Claude Code en VS Code
Instala la extensión de Claude Code, abre la carpeta en VS Code (Archivo → Abrir carpeta), abre el panel de Claude y escribe "Sigue ONBOARDING.md". Vas a ver los archivos que crea en el explorador de la izquierda.

### Claude Code en la terminal
```bash
cd ruta/a/video-studio
claude
```
y escribe "Sigue ONBOARDING.md". Para ver los vídeos, abre la carpeta `proyectos/` con el Finder o el explorador.

## Instalación con tu IA
Si prefieres que tu IA lo instale sola, pega este prompt en Claude Code (o en tu agente con terminal) y déjala seguir los pasos. Es el mismo texto que está en [`PROMPT-INSTALACION.md`](PROMPT-INSTALACION.md):

```text
Quiero instalar el estudio de vídeo "video-studio" en mi ordenador. Hazlo así:

1. Clona https://github.com/IAbyLio/video-studio en una carpeta nueva (si no te digo otra, en mi carpeta de Documentos) y ábrela como carpeta de trabajo.
2. Dentro de esa carpeta, abre ONBOARDING.md y sigue sus pasos en orden.
3. Antes de instalar cualquier cosa en el sistema (Node, FFmpeg, whisper, etc.) explícame qué es y para qué, y espera mi OK.
4. Nunca me pidas claves, contraseñas ni tokens por el chat: si hace falta alguna, dime que la escriba yo en el archivo .env.
5. Pregúntame las cosas de una en una, con opciones cerradas cuando se pueda.
```

## Qué trae
| | |
|---|---|
| `estilos/` | 9 estilos visuales + lienzo en blanco, cada uno con ficha, ejemplo que renderiza y miniatura |
| `modulos/captions` | Captions palabra a palabra en dos estilos a elegir por vídeo: `natural` (centradas, sobrias) o `premium` (tipografía compuesta que se reparte por la pantalla y puede ir detrás tuyo) |
| `modulos/zonas-seguras` | Para que nada quede tapado por los botones de Instagram, TikTok o YouTube |
| `modulos/editar-lo-que-grabas` | Corta silencios, tomas repetidas y muletillas de tu grabación, y la encuadra en vertical (tú confirmas lo dudoso) |
| `modulos/personaje-3d` | Un muñeco 3D neutro que habla con lip-sync, y una guía para hacer tu propio personaje |
| `modulos/mundo-3d` | Escenas 3D deterministas (Three.js) |
| `modulos/voz` · `avatar` · `ganchos-ia` | Tu clon de voz, tu avatar y escenas de IA de vídeo, con tus cuentas |
| `modulos/sonido` | 8 efectos de sonido hechos por código, capas y render por etapas |
| `modulos/viralidad` | Guiones con gancho, estructura de 8 piezas y un crítico que los puntúa |

## Lo que no hace
- No publica en redes: el vídeo queda en tu ordenador.
- No trae voces, avatares, personajes, música ni marca de nadie: cada cosa es tuya.
- No gasta nada de tus cuentas sin preguntarte.

## Créditos y licencias
Hecho por IAbyLio. Por debajo: [Hyperframes](https://hyperframes.heygen.com) (HeyGen, Apache-2.0), GSAP, Three.js y otras piezas de código abierto: detalle en [`LICENCIAS.md`](LICENCIAS.md).
