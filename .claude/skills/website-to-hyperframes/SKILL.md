---
name: website-to-hyperframes
description: "Captura una web y hace un vídeo a partir de ella en 7 pasos con un entregable cada uno: captura, ficha de marca del sitio, guion, storyboard, voz con tiempos, composiciones y validación. Úsala cuando la persona pasa una URL y quiere un vídeo (anuncio, recorrido de producto, presentación de una función, reel de marca), o dice 'captura esta web', 'convierte mi web en un vídeo', 'haz una promo de mi página'."
when_to_use: "Basta con que pegue una URL y pida cualquier vídeo sobre esa web. Sin URL ni sitio de origen, la entrada es nuevo-video. Es de HyperFrames (Apache-2.0), adaptada a este repo; las referencias de cada paso están en inglés."
---

# De una web a un vídeo

Capturas una web y produces un vídeo con ella. Siete pasos; cada uno deja un archivo que abre el siguiente. Por defecto es colaborativo: en los puntos marcados con OK te paras y preguntas. Si la persona dice "decide tú", decides tú las preferencias (voz, colores de énfasis, número de escenas, música sí o no), **pero nunca te saltas las verificaciones** (revisión de recursos, lectura del HTML de cada escena, lint, fotogramas mirados).

Antes de empezar: proyecto con `node scripts/nuevo-proyecto.mjs <slug> --estilo libre --formato <formato>` (pregunta el destino: `horizontal-16x9` por defecto para web y YouTube, `reel` para Instagram o TikTok, `square-1x1` para feed). Todo lo que generen los pasos va dentro de `proyectos/<slug>/`. Las reglas del estudio siguen mandando: Render Contract y gates de `CLAUDE.md`, y las skills oficiales `hyperframes`, `hyperframes-cli`, `hyperframes-registry` y `gsap-core`.

**Marca:** si la web es de la propia persona, su `DESIGN.md` de la raíz y `marca/marca.css` mandan; la captura sirve para recursos (logos, capturas, iconos) y para confirmar colores. Si la web es de otra marca (un cliente, por ejemplo), sus colores y fuentes van en `proyectos/<slug>/DESIGN-sitio.md` (paso 2) y solo se usan en ese proyecto. Las referencias dicen "use EXACT hex": en este repo, dentro del proyecto, traduce esa paleta a las variables (`--fondo`, `--acento`…) en el bloque de marca del `index.html`.

## Paso 1: capturar y entender
Lee `references/step-1-capture.md`. `npx hyperframes capture <URL> -o captures` desde la carpeta del proyecto (sin claves; `--skip-vision` evita el servicio externo de descripciones). Lee lo extraído y resume con el método de "escribir y olvidar".
**Gate:** resumen del sitio impreso (nombre, colores principales, fuentes, recursos clave, una frase de ambiente).

## Paso 2: ficha de marca del sitio
Lee `references/step-2-design.md`. Escribe `DESIGN-sitio.md` (6 secciones, ~90 líneas): una chuleta, no el plan creativo. Si la web es de la persona, compárala con su `DESIGN.md` y señala diferencias en vez de duplicar.
**Gate:** `DESIGN-sitio.md` existe (o diferencias anotadas en el `BRIEF.md`).

## Paso 3: guion
Lee `references/step-3-script.md`. La narración es el esqueleto: las duraciones salen de ella. Si es para redes y la persona quiere, pásalo por `analisis-viralidad`. Solo afirmaciones y cifras que estén en la web o que confirme la persona.
**Gate:** `SCRIPT.md` existe y la persona lo aprobó (OK).

## Paso 4: storyboard
Lee `references/step-4-storyboard.md` y `references/techniques.md`. Dirección creativa por beat: ambiente, cámara, animaciones, transiciones, recursos, capas de profundidad y sonido, con una tabla de qué recurso va en qué beat.
**Gate:** `STORYBOARD.md` con el plan beat a beat y la tabla de recursos. Bloque `## Zona segura` del `BRIEF.md` respetado.

## Paso 5: voz y tiempos
Lee `references/step-5-vo.md`. Opciones: voz local gratis (`npx hyperframes tts`, si está instalada), su clon de voz (`modulos/voz/`, **de pago**, con OK) o su grabación. Transcribe (`--language es` si es en español) y pasa los tiempos reales al storyboard.
**Gate:** `narration.wav` (o `.mp3`) + `transcript.json`, y tiempos actualizados en `STORYBOARD.md`.

## Paso 6: construir
Usa la skill `hyperframes` y lee `references/step-6-build.md`. Una composición por beat; tras cada una, auto-revisión de layout, recursos y animación. Si tu IA puede lanzar subagentes, uno por beat, pasándoles **rutas**, no contenidos. Donde las referencias dicen `gsap.from`, usa `fromTo` explícito.
**Gate:** cada composición revisada: sin solapes, sin recursos fuera de sitio, sin imágenes quietas.

## Paso 7: validar y entregar
Lee `references/step-7-validate.md`. `npx hyperframes lint` y `npx hyperframes validate` sin errores, `npx hyperframes snapshot` en el punto medio de cada beat (mirar cada PNG y pasarlos por `node ../../scripts/zonas-seguras.mjs`), vista previa con OK, borrador, agente `video-qa` y final. Deja un `HANDOFF.md` para retomar en otra sesión.
**Gate:** lint y validate con 0 errores, fotogramas mirados y OK de la persona.

## Referencia rápida
| Tipo | Duración | Beats | Narración |
|---|---|---|---|
| Anuncio para redes | 10-15 s | 3-4 | Opcional, una frase de gancho |
| Demo de producto | 30-60 s | 5-8 | Completa |
| Anuncio de una función | 15-30 s | 3-5 | Completa |
| Reel de marca | 20-45 s | 4-6 | Opcional, manda la música |
| Teaser de lanzamiento | 10-20 s | 2-4 | Mínima, mucha energía |

| Archivo | Cuándo |
|---|---|
| `references/step-1-capture.md` | Paso 1: leer lo capturado |
| `references/step-2-design.md` | Paso 2: ficha de marca del sitio |
| `references/step-3-script.md` | Paso 3: guion |
| `references/step-4-storyboard.md` | Paso 4: dirección por beat |
| `references/step-5-vo.md` | Paso 5: voz, transcripción y tiempos |
| `references/step-6-build.md` | Paso 6: construir con auto-revisión |
| `references/step-7-validate.md` | Paso 7: lint, validate, vista previa y entrega |
| `references/techniques.md` | Pasos 4 y 6: 10 técnicas visuales con código (trazos SVG, Canvas 2D, 3D, tipografía, Lottie, vídeo, escritura, fuentes variables, MotionPath, transiciones) |

> Procedencia: skill `website-to-hyperframes` del proyecto HyperFrames (HeyGen, Apache-2.0), tal como la distribuía hyperframes-student-kit; HyperFrames ya no la publica entre sus skills. Este `SKILL.md` está traducido y adaptado; las referencias siguen en inglés con cambios de rutas y herramientas. Ver `LICENCIAS.md`.
