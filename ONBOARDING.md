# ONBOARDING: instrucciones para tu IA

> **Para la persona:** abre esta carpeta con tu IA y dile: **"Sigue ONBOARDING.md"** (o pégale el prompt de instalación de tu IA). Te va a hacer preguntas cortas y te va a pedir permiso antes de instalar o gastar nada.
>
<!-- IA:fuente -->
> **Para la IA:** estas son tus instrucciones. Síguelas en orden, empezando por el paso 0, que deja el repo solo con los archivos de tu IA. Probado con Claude Code en macOS (Apple Silicon). Con Codex u otros agentes con terminal, en Windows o en Linux, está escrito con cuidado pero sin probar: si algo no coincide (un comando, una herramienta que no tienes), díselo a la persona en vez de improvisar.
<!-- /IA -->
<!-- IA:claude -->
> **Para la IA:** estas son tus instrucciones. Síguelas en orden. Probado con Claude Code en macOS (Apple Silicon). En Windows o en Linux está escrito con cuidado pero sin probar: si algo no coincide (un comando, una herramienta que no tienes), díselo a la persona en vez de improvisar.
<!-- /IA -->
<!-- IA:codex -->
> **Para la IA:** estas son tus instrucciones. Síguelas en orden. Con Codex, y en Windows o Linux, está escrito con cuidado pero sin probar de punta a punta: si algo no coincide (un comando, una herramienta que no tienes, un permiso del sandbox), díselo a la persona en vez de improvisar.
<!-- /IA -->
<!-- IA:otra -->
> **Para la IA:** estas son tus instrucciones. Síguelas en orden. Con tu herramienta está escrito con cuidado pero sin probar: si algo no coincide (un comando, una herramienta que no tienes), díselo a la persona en vez de improvisar.
<!-- /IA -->

## Reglas (no negociables)

1. **Español, tuteo, sin jerga.** Antes de cada paso, una línea de qué vas a hacer y por qué. Preguntas de una en una, con opciones cerradas cuando se pueda.
2. **Nunca pidas claves, contraseñas ni tokens en el chat.** Si hace falta una clave, la persona la escribe en `.env` (copia de `.env.example`, ignorada por git) con su editor. Tú solo compruebas con `node scripts/comprobar-cuentas.mjs`, que nunca muestra valores.
3. **Pide confirmación antes de instalar algo en el sistema** (Node, FFmpeg, whisper, Rosetta). Lo demás queda dentro de esta carpeta o en cachés de usuario (`~/.cache/hyperframes`).
4. **Nada de `curl … | bash` ni scripts bajados a ciegas.** Solo los comandos de este archivo, el gestor de paquetes oficial del sistema o los scripts de este repo (que puedes leer antes).
5. **`sudo` solo en Linux, solo para el gestor de paquetes, explicando antes para qué.** En macOS y Windows no hace falta.
6. **No gastes nada sin un sí explícito.** Hyperframes tiene funciones de pago (nube, plan Pro, plantillas Pro, `--describe` con Gemini): no hacen falta. ElevenLabs, HeyGen y las IAs de vídeo gastan créditos de la persona: en este onboarding solo se comprueban en seco.
7. **Idempotente:** si un paso ya está hecho, lo compruebas y sigues. Lleva el estado en `estado-onboarding.json` (raíz): lo crea el paso 0 (si no existe, cópialo de `plantillas/estado-onboarding.plantilla.json`) y lo actualizas al cerrar cada paso. Si existe, retoma desde el primer paso con `"hecho": false`.
8. Si un paso falla dos veces, para, muestra el error y propón qué hacer.
9. Tu agente te va a pedir permiso para correr comandos: avísale a la persona que es normal y que lea lo que aprueba.

## Paso 0: qué IA eres

<!-- IA:claude -->
Hecho: este repo quedó adaptado para Claude Code (`pasos.0_ia` en `estado-onboarding.json`). Si `node scripts/adaptar-ia.mjs --ia claude --dry-run` dice "Nada que hacer", sigue con el paso 1.
<!-- /IA -->
<!-- IA:codex -->
Hecho: este repo quedó adaptado para Codex (`pasos.0_ia` en `estado-onboarding.json`). Si `node scripts/adaptar-ia.mjs --ia codex --dry-run` dice "Nada que hacer", sigue con el paso 1.
<!-- /IA -->
<!-- IA:otra -->
Hecho: este repo quedó adaptado con `AGENTS.md` como fuente única (`pasos.0_ia` en `estado-onboarding.json`). Si `node scripts/adaptar-ia.mjs --ia otra --dry-run` dice "Nada que hacer", sigue con el paso 1.
<!-- /IA -->
<!-- IA:fuente -->

El repo trae archivos para varias IA (`CLAUDE.md` y `.claude/` para Claude Code; `AGENTS.md` para Codex y el resto). Este paso deja solo los de la tuya, para que nadie lea instrucciones que no son para él. Si `estado-onboarding.json` ya tiene `pasos.0_ia.hecho: true`, sáltalo.

1. **La opción.** Si el prompt de instalación dice qué IA es, usa esa. Si no, identifícate: Claude Code → `claude`; Codex (app, extensión o CLI de OpenAI) → `codex`; cualquier otra IA agéntica con terminal (Cursor, Gemini CLI, Antigravity…) → `otra` ("Otra IA agéntica" en los prompts). Si dudas, pregúntaselo a la persona.
2. **Node.** El script es de Node. Si `node -v` no responde, haz antes el paso 1 (instalar Node, con su OK) y vuelve aquí.
3. **Plan en seco:** `node scripts/adaptar-ia.mjs --ia <opción> --dry-run`. Resúmele en dos líneas qué se queda y qué se quita.
4. **Aplicar:** `node scripts/adaptar-ia.mjs --ia <opción>`. Mueve y convierte skills y agentes, borra lo de las otras IA, resuelve los bloques `<!-- IA:… -->` de los documentos y anota `agente` y `pasos.0_ia` en `estado-onboarding.json`. Repetirlo no cambia nada; con otra IA se niega. Si avisa de cambios sin guardar en archivos que tocaría, para y pregunta.

   | Opción | Se queda | Se quita |
   |---|---|---|
   | `claude` | `CLAUDE.md`, `.claude/skills/`, `.claude/agents/` | `AGENTS.md` |
   | `codex` | `AGENTS.md` con cabecera de Codex; skills en `.agents/skills/` (formato Agent Skills, descripción para Codex); agentes como custom agents en `.codex/agents/*.toml` | `CLAUDE.md`, `.claude/` |
   | `otra` | `AGENTS.md` como fuente única; skills en `.agents/skills/` (formato estándar); agentes como checklists en `agentes/` | `CLAUDE.md`, `.claude/` |

   En las tres se borran los prompts de instalación (`PROMPT-INSTALACION.md`, `prompts/`): solo sirven antes de clonar.
5. **Lo que el script no hace (redacción fina).** Si el script lista algo en "Para revisar a mano", corrígelo en esos archivos (son menciones de otras IA que no supo resolver). Después lee una vez la guía que quedó (`CLAUDE.md` o `AGENTS.md`) y confirma que se entiende sola. No cambies las reglas ni el flujo: solo redacción.
6. **Sesión nueva al final.** Tu IA lee la guía, las skills y los agentes al empezar la sesión: los que acaba de dejar el script se cargan en la próxima. Para seguir con este onboarding no hacen falta (lee los archivos directamente). En el cierre, recuérdale a la persona que abra una sesión nueva en esta carpeta.

Para cambiar de IA más adelante, lo más simple es clonar el repo de nuevo en otra carpeta y copiar `DESIGN.md`, `marca/`, `.env` y `proyectos/`.
<!-- /IA -->

## Antes del paso 1: presentarte (una vez)

Dile en 3-4 líneas:
- Qué es esto: un estudio de vídeo que se maneja hablando. Tú escribes los vídeos como páginas animadas y los conviertes en MP4 en su ordenador.
- Qué vas a hacer: revisar el ordenador, instalar Hyperframes (el motor, gratis, de código abierto), preguntarle qué quiere hacer y qué cuentas tiene, armar su identidad visual desde sus archivos y hacer un primer vídeo juntos.
- Cuánto tarda: 10-20 minutos con descargas (unos 2 GB en total si activa todo).
- **Telemetría:** Hyperframes y el instalador de skills mandan estadísticas de uso anónimas. Recomienda apagarlas (`DO_NOT_TRACK=1` delante de cada `npx`; en PowerShell `$env:DO_NOT_TRACK="1"` una vez por sesión) y guarda la respuesta en `estado-onboarding.json` → `telemetria`.

## Paso 1: requisitos técnicos

```bash
node scripts/comprobar-entorno.mjs
```
(Si `node` no existe todavía, este comando falla: comprueba a mano con `node -v`, `ffmpeg -version`, `ffprobe -version`.)

Hace falta: **Node 22 o más nuevo**, **FFmpeg y FFprobe**, y **al menos 3 GB libres**. Si falta algo, di qué y propón **un** comando; espera el OK:

| Sistema | Node | FFmpeg | Notas |
|---|---|---|---|
| macOS con Homebrew (`brew --version` responde) | `brew install node` | `brew install ffmpeg` | Sin sudo. Probado |
| macOS sin Homebrew | Instalador oficial de nodejs.org (LTS) | Que la persona instale Homebrew desde brew.sh leyendo antes lo que hace; tú no lo instales | No probado |
| Windows 10/11 | `winget install OpenJS.NodeJS.LTS` | `winget install Gyan.FFmpeg` | Cerrar y abrir la terminal después. No probado |
| Linux (Debian/Ubuntu) | Instalador oficial de nodejs.org o nvm (leer antes su script) | `sudo apt install ffmpeg` | El `sudo` es del gestor de paquetes. No probado |

Vuelve a correr `node scripts/comprobar-entorno.mjs` hasta que diga "Lo imprescindible está". Anota `sistema` y `1_requisitos` en el estado.

## Paso 2: instalar Hyperframes (la base)

Hyperframes (github.com/heygen-com/hyperframes, licencia Apache-2.0) es el motor que convierte HTML animado en vídeo. Se instala desde npm, su fuente oficial, en la versión fijada en `package.json` (0.9.72: la probada con este repo), dentro de esta carpeta:

```bash
npm install
npx hyperframes --version          # 0.9.72
```

**Skills oficiales de HyperFrames y GSAP** (instrucciones para que sepas usar el motor y las animaciones), solo en esta carpeta. No vienen con `npm install`: se instalan aquí, desde su origen, el set completo de HyperFrames (9) y de GSAP (8). La lista esperada vive en `scripts/skills-oficiales.json`.

<!-- IA:fuente -->
(El paso 0 deja aquí solo el comando de tu IA: `--agent claude-code` para Claude Code, `--agent codex` para Codex y `--agent universal` para otras, que instala en `.agents/skills/`.)
<!-- /IA -->
<!-- IA:claude -->
```bash
npx --yes skills@1.5.18 add heygen-com/hyperframes --skill hyperframes hyperframes-cli hyperframes-registry media-use figma remotion-to-hyperframes reverse-any-video slideshow style-sampling --agent claude-code --copy -y
npx --yes skills@1.5.18 add greensock/gsap-skills --skill gsap-core gsap-timeline gsap-performance gsap-plugins gsap-utils gsap-scrolltrigger gsap-react gsap-frameworks --agent claude-code --copy -y
```
- Quedan en `.claude/skills/`, junto a las 7 de este repo. Repetir no duplica.
<!-- /IA -->
<!-- IA:codex -->
```bash
npx --yes skills@1.5.18 add heygen-com/hyperframes --skill hyperframes hyperframes-cli hyperframes-registry media-use figma remotion-to-hyperframes reverse-any-video slideshow style-sampling --agent codex --copy -y
npx --yes skills@1.5.18 add greensock/gsap-skills --skill gsap-core gsap-timeline gsap-performance gsap-plugins gsap-utils gsap-scrolltrigger gsap-react gsap-frameworks --agent codex --copy -y
```
- Quedan en `.agents/skills/`, junto a las 7 de este repo. Repetir no duplica. Necesitan internet: Codex te pedirá aprobación.
<!-- /IA -->
<!-- IA:otra -->
```bash
npx --yes skills@1.5.18 add heygen-com/hyperframes --skill hyperframes hyperframes-cli hyperframes-registry media-use figma remotion-to-hyperframes reverse-any-video slideshow style-sampling --agent universal --copy -y
npx --yes skills@1.5.18 add greensock/gsap-skills --skill gsap-core gsap-timeline gsap-performance gsap-plugins gsap-utils gsap-scrolltrigger gsap-react gsap-frameworks --agent universal --copy -y
```
- Quedan en `.agents/skills/` (formato estándar), junto a las 7 de este repo. Repetir no duplica. Si tu herramienta no carga skills sola, léelas como documentación cuando haga falta.
<!-- /IA -->
- **Verifica** que están todas: `node scripts/comprobar-skills.mjs`. Compara la lista esperada con la instalada; si falta alguna, imprime el comando para reinstalar solo esas: córrelo (con su OK si pide red) y vuelve a comprobar hasta que diga "todas". Anota el resultado en `2_hyperframes`.
- `reverse-any-video` y `style-sampling` usan funciones de pago (plan Pro de HyperFrames o la nube de HeyGen): quedan instaladas, pero no las uses sin un sí explícito de la persona y el precio a la vista.
- Las skills nuevas se cargan en la próxima sesión; para terminar este onboarding no hacen falta.
- Hyperframes puede avisar "N HyperFrames skills out of date or missing" y sugerir `npx hyperframes skills update`: es esperable (las skills se bajan de su rama principal y la CLI está fijada en 0.9.72). No lo corras: mantén lo de este paso.

**Comprobación:**
```bash
npx hyperframes doctor
```
Tienen que estar en verde Node, FFmpeg, FFprobe y Chrome. Docker, Kokoro y MusicGen son opcionales (si salen en rojo, el resumen dirá "Some checks failed": está bien). Si Chrome sale en rojo: `npx hyperframes browser ensure` (baja el navegador de render, unos 600 MB; avisa antes).

**Render de prueba** con la plantilla en blanco:
```bash
cd proyectos/_plantilla
npx hyperframes lint
npx hyperframes render --quality draft --output renders/prueba.mp4
ffprobe -v error -show_entries stream=width,height -show_entries format=duration -of compact renders/prueba.mp4
npx hyperframes snapshot --at 0.5,2,3.5 --output renders/fotogramas
cd ../..
```
Está bien si: `lint` da 0 errores, `prueba.mp4` mide **1080x1920** y dura **4 s**, y en los fotogramas (ábrelos y míralos) se ve "Hecho hablando con tu IA" centrado. La primera vez el render puede bajar una fuente de Google Fonts (necesita internet). Anota `2_hyperframes` con la versión y el resultado.

Comprueba también los tests del repo: `npm test` (todos en verde).

## Paso 3: qué quiere hacer

Pregunta (elección múltiple) qué quiere poder hacer. Explica cada opción en una línea:

| Opción | Módulo | Qué instala o pide |
|---|---|---|
| Motion graphics desde cero | (base) | Nada más |
| Editar lo que grabo (cortar silencios y tomas, vertical) | `editar-lo-que-grabas` | `whisper-cli` + un modelo (~490 MB el `small`) |
| Personaje 3D que habla | `personaje-3d` | Rhubarb (lip-sync, ~87 MB; en Mac con chip M necesita Rosetta) |
| Mundo 3D | `mundo-3d` | Nada (Three.js ya viene) |
| Clon de voz | `voz` | Cuenta de ElevenLabs (de pago) |
| Avatar de vídeo | `avatar` | Cuenta de HeyGen (de pago) |
| Ganchos generados con IA de vídeo | `ganchos-ia` | Cuenta en una plataforma de vídeo IA (de pago) |
| Guiones con análisis de viralidad | `viralidad` | Nada (usa la IA que ya tiene) |

Captions palabra a palabra, zonas seguras y sonido simple vienen siempre.

Por cada módulo elegido, instala **solo** lo suyo (con OK para lo del sistema) y compruébalo:
- **Editar lo que grabo:** `whisper-cli` → macOS `brew install whisper-cpp`; otros sistemas, whisper.cpp desde github.com/ggml-org/whisper.cpp (sin probar). Modelo: `npx hyperframes transcribe <un-audio-corto> --model small --language es` lo baja la primera vez (si no hay audio, genera uno de 2 s con `say` en macOS o pídele uno). Comprobación: `node scripts/comprobar-entorno.mjs` → `whisper_cli: sí` y el modelo en la lista.
- **Personaje 3D:** `bash scripts/personaje/instalar-rhubarb.sh` (baja el zip oficial de GitHub a `.cache/rhubarb/`, sin sudo). Si dice que falta Rosetta, explica qué es (traductor de Apple para programas Intel) y pide OK para `softwareupdate --install-rosetta --agree-to-license`. Comprobación: el script imprime la versión de Rhubarb.
- **Mundo 3D, viralidad, motion graphics:** nada que instalar; di dónde está cada uno (`estilos/mundo-3d/`, `modulos/viralidad/`).
- **Voz, avatar, ganchos IA:** se configuran en el paso 4.

Guarda la lista en `estado-onboarding.json` → `modulos`.

## Paso 4: cuentas y claves (solo las que tenga)

Pregunta qué cuentas tiene de verdad: ElevenLabs, HeyGen, alguna IA de vídeo (Higgsfield, Seedance a través de la plataforma que use, otra). Si no tiene ninguna, perfecto: el estudio funciona igual y saltas este paso.

Para cada cuenta que tenga:
1. Si no existe `.env`: `cp .env.example .env` (en Windows: `copy .env.example .env`).
2. Dile dónde está la clave en su cuenta (lo dice `.env.example`) y que **la escriba ella** en `.env`, en su editor, y te avise. No la pegue en el chat.
3. Comprueba en seco: `node scripts/comprobar-cuentas.mjs` (formato). Con su OK, `node scripts/comprobar-cuentas.mjs --en-linea`: una consulta gratuita por cuenta (plan o saldo), sin generar nada.
4. **Voz:** el registro `modulos/voz/perfiles.json` viene vacío. Si quiere su clon, que te diga el **Voice ID** (no es secreto) y el nombre exacto de la voz en ElevenLabs; agrega su perfil siguiendo `modulos/voz/README.md` (con la nota de autorización) y comprueba con `node scripts/voz.mjs --dry-run --perfil <nombre>` (sin gasto).
5. **Avatar:** que te diga si ya tiene un avatar propio en HeyGen; el flujo está en `modulos/avatar/README.md`. No generes nada ahora.
6. **IA de vídeo:** explica el método y sus gates de coste (`modulos/ganchos-ia/README.md`). No generes nada ahora.

Anota en el estado qué cuentas quedaron configuradas (sí/no, nunca las claves).

## Paso 5: su marca (desde sus archivos o desde su negocio)

**No le pidas que describa su marca de cero si ya la tiene en algún sitio.** Dale a elegir entre tres caminos, con esta pregunta:

> "Vamos con tu marca. ¿Cómo prefieres hacerlo?
> 1. **Ya la tengo en mi ordenador:** dime en qué carpeta están tu manual de marca, tus logos, tus tipografías o capturas de tu web y de tus redes, y los analizo yo desde ahí.
> 2. **Te los paso aquí:** adjunta o arrastra los archivos a esta conversación (PDF, imágenes, SVG). Si tienes web, pásame la dirección.
> 3. **Empezamos de cero:** cuéntame a qué se dedica tu negocio y te propongo yo una identidad (colores y tipografías) para que elijas."

Puede combinar caminos (por ejemplo, tiene logo pero no colores definidos): analiza lo que haya y propón lo que falte.

**Si adjunta los archivos (camino 2):** guárdalos en `marca/originales/` (créala si no existe) y trabaja desde ahí igual que con una carpeta suya. Si tu herramienta no te deja guardar un adjunto en disco, analízalo desde la conversación y dile qué archivos necesitas que copie él a esa carpeta (como mínimo, el logo).

**Si tiene archivos**, analízalos directamente desde ahí (sin moverlos):
1. Lista la carpeta y cuéntale qué encontraste.
2. **PDF:** ábrelo y lee sus páginas (colores con hex/RGB/CMYK, tipografías, usos del logo, tono). Si es largo, empieza por el índice y las páginas de color y tipografía.
3. **Colores de archivos:** `node scripts/extraer-colores.mjs <carpeta>` saca los hex de SVG/CSS y los dominantes de imágenes. Mira también las imágenes (logos, capturas) para entender qué color es fondo, cuál es acento y cuál texto. Prioriza lo que diga el manual sobre lo que se deduzca de una imagen.
4. **Tipografías:** si hay archivos de fuente (.woff2, .ttf, .otf), cópialos a `marca/fuentes/` **solo si su licencia permite incrustarlos** (si no sabes, pregunta; las de Google Fonts son OFL y sí se puede). Si no hay archivo, anota la familia y una alternativa parecida.
5. **Logo:** copia la mejor versión (SVG mejor que PNG) a `marca/` (`logo.svg` / `logo.png`).
6. **Web:** si puedes leer páginas web, mira colores y fuentes de su CSS; si no, pídele una captura.
7. **Tono:** de los textos del manual, de su web o de sus publicaciones (trato, cómo suena, palabras que usa y que no).

**Si empieza de cero (camino 3), o no tiene nada**, parte de su negocio, con preguntas de una en una:
1. Pídele que te describa su negocio con sus palabras: a qué se dedica, qué vende y a quién le habla. Si tiene web o perfil en redes, míralos también.
2. Pregúntale tres adjetivos de cómo quiere que se sienta su marca, un color que le guste y uno que no quiera ver, y dos o tres cuentas o marcas cuya estética le atraiga (solo como referencia de sensación, no para copiar).
3. Con eso, **propón tú dos o tres direcciones de diseño distintas entre sí**, pensadas para su sector y su público y para que se vean bien en vídeo vertical. Cada dirección lleva: un nombre corto, una frase de por qué encaja con su negocio, la paleta completa (fondo, superficie, texto, texto suave, acento, acento 2 y negativo, con sus hex y buen contraste) y una pareja de tipografías libres (Google Fonts, OFL): una para títulos y otra para texto. Evita las combinaciones genéricas: que cada propuesta tenga carácter.
4. Enséñaselas de forma que las pueda comparar: como mínimo la tabla de colores y fuentes de cada una; mejor, un fotograma de prueba por dirección (mismo texto, distinta identidad) con `node scripts/nuevo-proyecto.mjs prueba-marca-a --estilo libre` y un snapshot de cada una. Borra esas pruebas al terminar.
5. Que elija una, o que mezcle ("los colores de la primera con la letra de la segunda"). Ajusta hasta su OK.

**En todos los casos:**
1. Escribe `DESIGN.md` en la raíz con la plantilla `plantillas/DESIGN.plantilla.md` (paleta con hex y su variable, tipografías, logo, tono, reglas, dónde publica, fuentes analizadas). Comprueba contraste (texto/fondo ≥ 4,5:1).
2. **Muéstraselo** resumido (paleta, fuentes, tono) y pídele que lo corrija. Itera hasta su OK.
3. `node scripts/marca-desde-design.mjs` → escribe `marca/marca.css` (las variables que usan todos los vídeos) y avisa de contrastes bajos o fuentes que faltan.
4. Prueba visual: `node scripts/nuevo-proyecto.mjs prueba-marca --estilo libre`, render de un fotograma (`npx hyperframes snapshot --at 2 --output renders/f` dentro del proyecto), míralo y muéstraselo. Si le gusta, borra `proyectos/prueba-marca` (es una prueba).

Anota `5_marca` con las fuentes analizadas.

## Paso 6: dónde publica

Pregunta dónde publica (elección múltiple): Instagram (reels, stories, posts), TikTok, YouTube (Shorts / vídeo horizontal), LinkedIn, anuncios. Eso fija el **formato por defecto** y las **zonas seguras** (`modulos/zonas-seguras/README.md`): reels/TikTok/Shorts → `reel`; stories → `story`; posts → `feed-4x5` o `post-3x4`; YouTube horizontal → `horizontal-16x9`. Si publica el mismo vídeo en dos sitios, vale la zona más restrictiva. Si tiene usuario público para badges de "seguir", anótalo en `DESIGN.md` → "Dónde publico". Guarda `destinos` y `formato_por_defecto` en el estado.

## Paso 7: primer vídeo guiado

Propón un primer vídeo corto (6-10 s) pedido en sus palabras, por ejemplo: *"Un reel de 8 segundos que presente mi marca: mi nombre grande, una frase de lo que hago y un cierre con mi usuario."* Que lo diga ella con sus palabras.

Sigue la skill `nuevo-video` (`.claude/skills/nuevo-video/SKILL.md`): **selector de estilo** (muéstrale el catálogo de `estilos/catalogo.json` y que elija; si no tiene vídeo propio ni voz, recomienda `libre`, `sin-avatar`, `liquid-glass`, `mundo-3d` o `personaje-narrador`), selector de captions (`natural` / `premium`, con sus ejemplos en `modulos/captions/ejemplos/`) si el vídeo tiene voz o frases, las preguntas que falten, `nuevo-proyecto.mjs`, construcción, **fotogramas mirados y zonas seguras**, vista previa (`npx hyperframes preview`, en segundo plano) con su OK y render final. Cierra la vista previa al terminar.

Anota `7_primer_video` con el proyecto y la ruta del MP4.

## Cierre

Dile, corto:
1. Qué quedó instalado y activado (módulos, cuentas configuradas, marca en `DESIGN.md`).
2. Cómo pedir el próximo vídeo: "Hazme un vídeo de…" en una sesión en esta carpeta; le vas a preguntar el estilo cada vez.
3. Qué gasta dinero (solo los módulos de voz, avatar e IA de vídeo, siempre con su OK) y qué no.
4. Que abra una **sesión nueva** de su IA en esta carpeta para pedir vídeos: así se cargan la guía, las skills y los agentes que dejó el paso 0.
5. Cómo desinstalar: borrar esta carpeta. Las cachés de usuario (`~/.cache/hyperframes`: navegador de render y modelos) se borran con `npx hyperframes clean`; Node, FFmpeg y whisper, con el mismo gestor con el que se instalaron.

Antes de cerrar, vuelve a correr `node scripts/comprobar-skills.mjs`: tiene que decir "todas" en las del repo, HyperFrames y GSAP (si falta alguna, reinstálala con el comando que imprime). Marca todos los pasos como hechos en `estado-onboarding.json` y anota en `pendientes` lo que haya quedado para más adelante.
