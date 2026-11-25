# Licencias: qué viene en este repo y qué se instala desde su origen

> Revisado el 2026-11-25. Licencias de los repositorios comprobadas con la API pública de GitHub y con el `package.json` de los paquetes; la de GSAP, en gsap.com/standard-license. **Criterio:** este repo solo incluye código y material escrito para él, más las piezas de terceros cuya licencia permite redistribuirlas, con su aviso al lado. El resto se instala desde su fuente oficial.

## Incluido en el repo

| Pieza | Dónde | Fuente | Licencia |
|---|---|---|---|
| Scripts, docs, estilos, módulos, plantillas, personaje neutro, SFX sintetizados por código, persona de relleno | todo el repo salvo lo de abajo | Este repo (IAbyLio) | MIT (`LICENSE`) |
| Three.js r185 (`three.module.min.js`, `three.core.min.js`) | `vendor/three/` (+ copias en los ejemplos 3D) | github.com/mrdoob/three.js | MIT, aviso en `vendor/three/LICENSE` |
| liqui-glass (port en JavaScript de la técnica de liqui-design) | `vendor/liqui-glass/` (+ copia en el ejemplo) | github.com/leefanv/liqui-design @ 50f3871 | MIT © 2026 Fan Li, aviso en `vendor/liqui-glass/LICENSE` y origen en `NOTICE.md` |
| Base del espacio de trabajo (contrato de render, ciclo de trabajo, estructura de proyectos) | `CLAUDE.md`, `AGENTS.md`, `proyectos/` | Deriva de hyperframes-student-kit (github.com/nateherkai/hyperframes-student-kit), a través del estudio de origen | MIT © 2026 Nate Herk (aviso abajo). No se incluye ningún asset de marca de ese kit |
| `cara.js` (cara 2D por código), `build-mouth-data.mjs`, carril `scripts/bruto/` | `scripts/` | Estudio de origen (IAbyLio) | MIT (este repo) |

### Aviso MIT de hyperframes-student-kit
```
MIT License

Copyright (c) 2026 Nate Herk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
(El kit original aclara que los materiales de marca de terceros que traía como ejemplo no se licencian para reutilizar; este repo no incluye ninguno.)

## Se instala desde su origen (no viene en el repo)

| Pieza | Cómo llega | Fuente | Licencia |
|---|---|---|---|
| Hyperframes CLI 0.9.72 | `npm install` (devDependency fijada) | npm `hyperframes` · github.com/heygen-com/hyperframes | Apache-2.0 |
| Skills `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use` | `npx skills add heygen-com/hyperframes …` | github.com/heygen-com/hyperframes | Apache-2.0 |
| Skills `gsap-core`, `gsap-timeline`, `gsap-performance`, `gsap-plugins`, `gsap-utils` | `npx skills add greensock/gsap-skills …` | github.com/greensock/gsap-skills | MIT |
| Instalador de skills (`skills` 1.5.18) | `npx` | npm `skills` | MIT |
| GSAP 3.14.2 | CDN jsDelivr en cada `index.html` (como hace `hyperframes init`) | npm `gsap` | Licencia estándar de GreenSock/Webflow: gratis, también comercial; no es open source clásica. Prohíbe usarlo en herramientas sin código que compitan con Webflow: este repo no es eso (la IA escribe código) |
| Navegador de render (chrome-headless-shell) | lo baja Hyperframes | Google | Términos de Google/Chromium |
| Fuentes de los ejemplos (Inter, si no está instalada) | las baja el compilador de Hyperframes de Google Fonts al renderizar | Google Fonts | OFL |
| Modelos de recorte de fondo | los baja `npx hyperframes remove-background` la primera vez | vía Hyperframes | Según Hyperframes (no verificado en esta revisión) |
| FFmpeg | gestor de paquetes | ffmpeg.org | LGPL o GPL según la compilación |
| Node.js | gestor de paquetes o nodejs.org | nodejs.org | MIT |
| whisper.cpp + modelos | `brew install whisper-cpp` y Hyperframes | github.com/ggml-org/whisper.cpp; modelos de OpenAI | MIT |
| Rhubarb Lip-Sync 1.14.0 | `bash scripts/personaje/instalar-rhubarb.sh` (zip oficial de GitHub) | github.com/DanielSWolf/rhubarb-lip-sync | MIT (según su LICENSE.md; dependencias MIT/BSD). Los datos de lip-sync que genera son tuyos |
| Voz local Kokoro (opcional) | `npx hyperframes tts` | Kokoro-82M | Apache-2.0 según su repo (no verificado en esta revisión) |

## Servicios de pago opcionales
ElevenLabs, HeyGen y las plataformas de IA de vídeo se usan con la cuenta y la clave de cada persona, bajo sus términos. Lo que generes con ellas (voces, avatares, clips, efectos) se rige por esos términos: revísalos antes de publicar o redistribuir. Este repo no incluye nada generado con esas cuentas.
