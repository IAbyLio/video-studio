# Estudio de vídeo: guía de trabajo para la IA

> **Repo sin adaptar:** antes de nada, haz el paso 0 de `ONBOARDING.md` (deja solo los archivos de tu IA y resuelve los bloques `<!-- IA:… -->` de abajo). Este archivo es la fuente de la guía: `AGENTS.md` lleva el mismo cuerpo, copiado por `node scripts/sincronizar-copias.mjs` (edita solo `CLAUDE.md`).

## Primero: ¿está instalado?

Si no existe `estado-onboarding.json` en la raíz, o tiene pasos sin completar, **no hagas vídeos todavía**: sigue `ONBOARDING.md` desde el paso que falte. Si la persona te pide un vídeo antes de terminar, dile en una línea qué falta y ofrece terminarlo primero.

## Qué es esta carpeta

Un estudio de vídeo que se maneja hablando. Los vídeos se escriben como páginas HTML animadas (Hyperframes + GSAP) y se convierten en MP4 en el ordenador de la persona.

| Carpeta | Qué hay |
|---|---|
| `estilos/` | Catálogo de estilos visuales para elegir en cada vídeo (`catalogo.json` + ficha, ejemplo que renderiza y miniatura de cada uno) |
| `modulos/` | Capacidades opcionales: captions, zonas seguras, editar lo que grabas, personaje 3D, mundo 3D, voz, avatar, ganchos con IA, sonido, viralidad |
| `proyectos/` | Un vídeo por carpeta. `_plantilla/` es el lienzo en blanco |
| `marca/` | `marca.css` con la identidad de la persona (la crea el onboarding); `marca.neutra.css` es la de los ejemplos |
| `DESIGN.md` | El manual de marca de la persona, en texto (lo crea el onboarding) |
| `scripts/` | Herramientas (Node) con tests: `npm test` |
| `.claude/skills/` | `analisis-viralidad` (guiones), `nuevo-video` (flujo de cada vídeo) y las skills oficiales de Hyperframes y GSAP (las instala el onboarding) |
| `.claude/agents/` | `video-qa` (revisión de borradores) y `video-orquestador` (opcional para piezas largas) |

## Cómo hablarle a la persona

1. En español, tuteo, sin jerga. Antes de cada paso, una línea de qué vas a hacer y por qué.
2. **Nunca le pidas que pegue una clave en el chat.** Las claves las escribe ella en `.env` (está en `.gitignore`). Para saber si están bien: `node scripts/comprobar-cuentas.mjs` (nunca imprime valores).
3. **Pregunta antes de cualquier cosa que gaste dinero o créditos** (voz clonada, avatar, IA de vídeo, efectos generados, funciones de pago de Hyperframes como la nube o el plan Pro). Di qué vas a generar, dónde y que mire el precio en pantalla. Sin un sí explícito, no se genera.
4. **Pregunta antes de instalar algo en el sistema.** Nada de `curl … | bash`; `sudo` solo en Linux, solo para el gestor de paquetes y explicando para qué.
5. No recomiendes apps, planes ni servicios extra salvo que te los pida (Hyperframes anuncia su app de escritorio al renderizar: no hace falta).
6. Si en `estado-onboarding.json` la telemetría quedó apagada, pon `DO_NOT_TRACK=1` delante de cada comando `npx`.
7. Si un paso falla dos veces, para, muestra el error y propón qué hacer.

## Cómo trabajar con tu IA

<!-- IA:claude -->
- **Skills:** las de `.claude/skills/` se cargan solas cuando la tarea encaja con su descripción (también con `/nuevo-video` o `/analisis-viralidad`). Antes de cada vídeo, `nuevo-video`.
- **Agentes:** tras cada borrador, lanza el agente `video-qa` (`.claude/agents/video-qa.md`) con tu herramienta de agentes. `video-orquestador` (`.claude/agents/video-orquestador.md`) solo para piezas largas.
- **Fotogramas:** ábrelos con tu herramienta de lectura (lee PNG) y míralos de verdad.
- **Vista previa:** `npx hyperframes preview` como comando en segundo plano; ciérralo al terminar.
<!-- /IA -->
<!-- IA:codex -->
- **Sesión:** Codex lee este archivo, las skills y los agentes al empezar la sesión. Si cambian (por ejemplo, tras el onboarding), pide a la persona que abra una sesión nueva en la carpeta.
- **Permisos y red:** en el modo habitual (Auto: escribir en la carpeta y pedir aprobación), los comandos que necesitan internet (`npm install`, `npx …` la primera vez, descargas de modelos) te piden aprobación. Avísale a la persona de que es normal y de qué hace cada uno.
- **Skills:** las de `.agents/skills/` las eliges tú cuando la tarea encaja con su descripción; la persona también puede pedirlas con `$nuevo-video` o desde `/skills`. Antes de cada vídeo, `nuevo-video`.
- **Agentes:** `.codex/agents/` tiene dos custom agents. Codex delega cuando se le pide, así que aquí se pide: tras cada borrador, delega la revisión en el agente `video-qa` pasándole la carpeta del proyecto y la ruta del MP4. Para una pieza larga, `video-orquestador`. Si en esta sesión no puedes lanzar subagentes, sigue tú sus `developer_instructions`.
- **Fotogramas:** ábrelos con tu herramienta para ver imágenes y míralos de verdad. Si no puedes ver imágenes, díselo a la persona y pídele que los mire ella.
- **Vista previa:** si tu entorno no deja un proceso en segundo plano, pídele a la persona que corra `npx hyperframes preview` en su terminal desde la carpeta del proyecto, o renderiza un borrador y dile dónde está.
<!-- /IA -->
<!-- IA:otra -->
- **Esta guía es tu fuente única.** No hay otra configuración específica de tu herramienta. Escrito con cuidado pero sin probar: si algo no coincide, díselo a la persona en vez de improvisar.
- **Skills:** `.agents/skills/<nombre>/SKILL.md`, en el formato estándar Agent Skills (agentskills.io). Si tu herramienta las carga sola, perfecto; si no, léelas como documentación cuando la tarea encaje: `nuevo-video` antes de cada vídeo y `analisis-viralidad` para guiones.
- **Agentes:** `agentes/video-qa.md` (revisión de cada borrador) y `agentes/video-orquestador.md` (piezas largas) son checklists. Si puedes lanzar subagentes, dales el archivo como instrucciones; si no, síguelos tú.
- **Gemini CLI:** por defecto lee `GEMINI.md`, no `AGENTS.md`. Con el OK de la persona, crea `.gemini/settings.json` con `{"context": {"fileName": ["AGENTS.md"]}}` y abre una sesión nueva.
- **Fotogramas y vista previa:** si no puedes ver imágenes o dejar un proceso en segundo plano, díselo a la persona: que mire ella los PNG y corra `npx hyperframes preview` en su terminal.
<!-- /IA -->

## Antes de CADA vídeo: dos selectores y cuatro preguntas

Usa la skill `nuevo-video` (`.claude/skills/nuevo-video/SKILL.md`). En resumen:

**1. Selector de estilo visual.** Muestra el catálogo leyendo `estilos/catalogo.json` (nombre, una línea, estado probado/experimental y qué necesita) y, si la persona puede ver imágenes, señálale `estilos/README.md` o las miniaturas. Que elija uno. Si el estilo necesita algo que no tiene (un vídeo suyo, una voz, un recorte, una cuenta de pago), dilo antes de seguir y ofrece alternativa.

| id | Estilo |
|---|---|
| `libre` | Motion graphics desde cero |
| `talking-head` | Cara a cámara (pantalla completa / ventana chica / mitad superior) |
| `split-screen` | Pantalla partida: cara arriba, panel abajo |
| `texto-detras` | Texto detrás del sujeto |
| `personaje-narrador` | Personaje 3D que narra |
| `mundo-3d` | Mundo 3D / mundo-metáfora |
| `pizarra-viva` | Pizarra viva |
| `sin-avatar` | Reel sin cara (voz en off + motion) |
| `liquid-glass` | Tarjetas de vidrio líquido |
| `gancho-ia` | Gancho generado con IA + composición |

**2. Selector de estilo de captions** (si el vídeo tiene voz o texto que sigue una frase): `natural` (1-3 palabras centradas, la clave resaltada; probado) o `premium` (base sobria + línea de énfasis con brillo, entradas y salidas variadas, layout que cambia de sitio, detrás del sujeto si hay recorte o 3D; experimental). Muestra los dos ejemplos (`modulos/captions/ejemplos/`) si la persona no los conoce. Cómo se usa cada uno: `modulos/captions/ESTILOS.md`.

**3. Cuatro preguntas** (de una en una, opciones cerradas cuando se pueda): dónde se publica (fija formato y zonas seguras), cuánto dura, qué se dice (guion, puntos o un audio) y qué material hay (vídeo, audio, imágenes). Si hay guion de reel, ofrece pasarlo por `analisis-viralidad` (y su crítico) antes de grabar o generar voz.

Lo que NO preguntes: colores, fuentes ni tono. Salen de `DESIGN.md` y `marca/marca.css`.

## Flujo de un vídeo

1. `node scripts/nuevo-proyecto.mjs <slug> --estilo <id> --formato <fmt>` → crea `proyectos/<slug>/` desde el ejemplo del estilo, con la marca ya puesta y un `BRIEF.md` con el bloque `## Zona segura`.
2. Lee la `FICHA.md` del estilo y el `BRIEF.md`. Completa el brief (bandas de captions, personaje, CTA). **Sin bloque de zona segura no se escribe HTML.**
3. Antes de componer, lee `FILOSOFIA-MOTION.md` (una idea por momento, nada quieto, transiciones con intención) y usa las skills oficiales `hyperframes` y `gsap`.
4. Edita `proyectos/<slug>/index.html` (y `compositions/` si hace falta). Todo dentro de la carpeta del proyecto: es portable.
5. `npx hyperframes lint` desde la carpeta del proyecto: 0 errores.
6. **Mira antes de enseñar:** `npx hyperframes snapshot --at <tiempos> --output renders/f` y abre los PNG (herramienta de lectura de imágenes). Pásalos por `node ../../scripts/zonas-seguras.mjs renders/f/*.png --format <fmt>` y míralos: nada que no sea fondo en rojo.
7. Vista previa: `npx hyperframes preview` (en segundo plano) y pásale la dirección a la persona. Espera su OK explícito; el silencio no es un sí. Si no puede abrir el navegador, renderiza un borrador y dile dónde está.
8. Borrador: `npx hyperframes render --quality draft --output renders/borrador.mp4`. Revisión con el agente `video-qa` (si no puedes lanzarlo, a mano: fotogramas de cada momento con `node scripts/extract-frames.mjs`, mirados de verdad).
9. Con el OK: `npx hyperframes render --quality standard --output renders/<slug>.mp4`. Dile dónde quedó.
10. Cierra la vista previa al terminar (no dejes procesos colgados).

Comandos siempre **desde la carpeta del proyecto** (`cd proyectos/<slug>`): Hyperframes lee `meta.json` y `hyperframes.json` de la carpeta actual.

## Render Contract (lo que no se negocia)

1. El `<div>` raíz lleva `id`, `data-composition-id`, `data-start="0"`, `data-width`, `data-height`. En este repo la composición raíz se llama `main`.
2. Lo que aparece y desaparece lleva `class="clip"`, **menos** `<video>` y `<audio>` (con `clip`, el vídeo se rompe).
3. Todo elemento con tiempo lleva `data-start`, `data-duration` y `data-track-index`. Dos clips en la misma pista no se solapan.
4. `<video>` siempre `muted`; el sonido va en `<audio>` aparte. Un `<video>` no puede ir dentro de otro elemento con `data-start` (el lint lo marca como error): usa contenedores sin tiempo.
5. Cada `<audio>` y `<video>` con `id` único (sin id, sale mudo).
6. Una sola timeline GSAP por composición, pausada, en `window.__timelines["<data-composition-id>"]`.
7. Duración = `tl.duration()`. Si la timeline es más corta, el vídeo se corta: `tl.set({}, {}, DURACION)` al final.
8. Nunca `.play()`, `.pause()` ni `.currentTime` sobre medios: los maneja el framework.
9. Nunca animes `width`/`height`/`top`/`left` de un `<video>`: anima un contenedor.
10. Sub-composiciones con `<template>` + `data-composition-src`; se enlazan solas.
11. Determinismo: nada de `Date.now()`, `Math.random()` sin semilla ni pedidos de red durante el render. 3D y canvas, función pura del tiempo conducida por GSAP.
12. Fuentes propias: `@font-face` dentro del `<style id="marca">` del `index.html` (Hyperframes no embebe fuentes de un CSS enlazado).
13. Animación con `fromTo` explícito cuando el estado inicial importa (`from` puede dar un destello en el primer fotograma).

## Gates (en orden, sin saltarse ninguno)

| Gate | Cuándo | Cómo |
|---|---|---|
| Zona segura | Antes de escribir HTML | Bloque `## Zona segura` en el BRIEF (destino, rectángulo seguro, bandas fijas) |
| Fotograma 0 | Antes de enseñar | En reels el primer fotograma hace de portada en el feed: tiene que leerse algo (gancho, nombre), no solo el fondo. Si la entrada empieza vacía, que arranque ya visible o avisa qué segundo elegir como portada |
| Lint | Tras cada edición | `npx hyperframes lint` = 0 errores |
| Mirar fotogramas | Antes de enseñar nada | `snapshot` + abrir PNG + `zonas-seguras.mjs` |
| Vista previa | Antes de renderizar | OK explícito de la persona |
| QA del borrador | Tras el borrador | `video-qa`: arregla lo objetivo, reporta lo de gusto |
| Render final | Con OK | `--quality standard` |

Lint correcto no es diseño correcto: nunca digas que algo está listo sin haber mirado los fotogramas.

## Marca

`DESIGN.md` (paleta con hex, tipografías, logo, tono y reglas) es la fuente de verdad, y `marca/marca.css` su traducción a variables (`--fondo`, `--superficie`, `--texto`, `--texto-suave`, `--acento`, `--acento-2`, `--negativo`, `--fuente-titulos`, `--fuente-texto`, `--fuente-mono`, `--peso-titulos`, `--radio`). En los vídeos usa **solo esas variables**, nunca hex sueltos (en JS: `getComputedStyle(document.documentElement).getPropertyValue('--acento')`). `nuevo-proyecto.mjs` mete la marca en cada proyecto nuevo; si la marca cambia, regenera `marca/marca.css` y vuelve a inyectarla.

Reglas de estilo propias que la persona vaya fijando ("captions siempre al centro", "sin logo fijo"): anótalas en `DESIGN.md` → "Reglas de estilo". Ejemplo de cómo se ven: `ejemplos/reglas-de-estilo-ejemplo.md`.

## Módulos

| Módulo | Para | Cuesta |
|---|---|---|
| `captions` | Subtítulos palabra a palabra, estilos `natural` y `premium` (`scripts/captions/captions-estilos.js`) | Gratis |
| `zonas-seguras` | Que nada caiga bajo la interfaz de la app | Gratis |
| `editar-lo-que-grabas` | Cortar silencios y tomas, encuadrar en vertical | Gratis (whisper local) |
| `personaje-3d` | Muñeco 3D con lip-sync y guía para hacer el tuyo | Gratis (Rhubarb local) |
| `mundo-3d` | Escenas Three.js deterministas | Gratis |
| `voz` | Tu clon de voz (ElevenLabs) | De pago |
| `avatar` | Tu avatar de vídeo (HeyGen) | De pago |
| `ganchos-ia` | Escena generada con IA de vídeo + composición | De pago |
| `sonido` | Efectos por capas, render por etapas | Gratis (generar efectos nuevos, de pago) |
| `viralidad` | Guion con gancho, 8 piezas y crítico | Gratis (usa tu IA) |

Activos para esta persona: `estado-onboarding.json` → `modulos`. Si pide algo de un módulo no activado, ofrece activarlo (sus requisitos están en su README).

## Comandos útiles

```bash
npm test                                         # tests del repo
node scripts/comprobar-entorno.mjs               # qué hay instalado (sin instalar nada)
node scripts/comprobar-cuentas.mjs [--en-linea]  # claves sin mostrarlas ni gastar
node scripts/nuevo-proyecto.mjs --estilos        # catálogo
node scripts/zonas-seguras.mjs --list
npx hyperframes doctor | lint | preview | snapshot | render | transcribe | tts | docs <tema>
```

Documentación oficial de Hyperframes: https://hyperframes.heygen.com (índice para IA: https://hyperframes.heygen.com/llms.txt). Si una skill no cubre algo, búscalo ahí antes de improvisar.

## Si algo falla

- `npx hyperframes doctor`: Node, FFmpeg y el navegador de render.
- `npx hyperframes docs troubleshooting`.
- Vista previa lenta con WebGL no significa render roto: juzga el borrador.
- El render escribe `.hyperframes/` en cada proyecto (con rutas locales): está ignorado por git, no lo subas.
