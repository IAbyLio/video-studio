---
name: nuevo-video
description: "Flujo de cada vídeo nuevo en este estudio: selector de estilo visual (catálogo de estilos/), selector de estilo de captions, cuatro preguntas, proyecto creado con la marca de la persona, construcción con los gates (zona segura, lint, fotogramas mirados, vista previa con OK, QA del borrador) y render final. Usar SIEMPRE que la persona pida 'hazme un vídeo/reel/short/story', 'quiero un vídeo de…', 'armame un vídeo con este audio/vídeo', o cuando quiera cambiar un vídeo existente de proyectos/. No usar para instalar (eso es ONBOARDING.md) ni para escribir solo el guion (skill analisis-viralidad)."
---

# Nuevo vídeo

## 0. ¿Vídeo nuevo o cambio?
- Si nombra un vídeo que ya existe en `proyectos/`, es un cambio: lee su `BRIEF.md`, aplica lo pedido y vuelve a los gates (paso 5). Si cambia el layout, re-verifica zonas seguras.
- Si es nuevo, sigue.
- Si `estado-onboarding.json` no existe o tiene pasos pendientes, dilo y ofrece terminar el onboarding primero.

## 1. Selector de estilo visual
Lee `estilos/catalogo.json` y muestra una lista corta, numerada, con: nombre, una línea, estado (probado / experimental) y qué necesita. Ejemplo de cómo presentarlo:

```
¿Qué estilo quieres para este vídeo?
1. Motion graphics desde cero: lienzo en blanco con tu marca.
2. Cara a cámara: tu vídeo con captions palabra a palabra (necesita un vídeo tuyo o un avatar).
3. Pantalla partida: tu cara arriba, un panel con datos abajo.
…
Puedes ver cómo es cada uno en estilos/README.md (tiene una miniatura de cada estilo).
```

- Si la persona no sabe, recomienda según lo que quiere contar: opinión con su cara → cara a cámara; datos → pantalla partida; sin salir a cámara → sin cara, pizarra viva o personaje; un proceso de pasos → mundo 3D o pizarra; una escena que obliga a quedarse → gancho IA (de pago).
- Si el estilo necesita algo que no tiene, dilo y ofrece alternativa ("no tienes vídeo tuyo: ¿lo hacemos sin cara?").
- Estado *experimental*: avisa en una línea que es el menos probado.

## 2. Selector de estilo de captions (si hay voz)
- `natural`: 1-3 palabras centradas, la clave resaltada (el de los ejemplos). Listo.
- `premium`: base sobria + línea de énfasis en otra tipografía con brillo, entradas variadas con desenfoque, layout que cambia de sitio, detrás del sujeto si hay recorte o 3D. Experimental: avísalo en una línea. Se arma con `scripts/captions/captions-estilos.js` siguiendo `modulos/captions/ESTILOS.md` (plan por escena + fotogramas fijos antes de construir).
- Si no los conoce, muéstrale los ejemplos: `modulos/captions/ejemplos/natural` y `…/premium` (renderizan tal cual).
- Sin voz: no preguntes.

## 3. Cuatro preguntas (de a una)
1. **Dónde se publica** → formato (`reel`, `story`, `ad-vertical`, `post-3x4`, `feed-4x5`, `square-1x1`, `horizontal-16x9`). Si va a dos sitios, la zona más restrictiva.
2. **Duración** (10-20 s, 20-45 s, 45-90 s).
3. **Qué se dice**: guion escrito, puntos sueltos, un audio suyo, o sin voz. Si es un reel con guion y la persona quiere, pasa antes por `analisis-viralidad` (guion + crítico ≥ 8).
4. **Qué material hay**: vídeo suyo (→ ¿lo limpiamos con `editar-lo-que-grabas`?), audio, imágenes, logos.

No preguntes colores, fuentes ni tono: están en `DESIGN.md` y `marca/marca.css`. Si no existen, el onboarding no terminó el paso de marca: ofrece hacerlo (5 minutos) o seguir con la marca neutra avisando.

## 4. Crear el proyecto
```bash
node scripts/nuevo-proyecto.mjs <slug> --estilo <id> --formato <fmt> --titulo "<nombre>"
```
Lee `estilos/<id>/FICHA.md` y `proyectos/<slug>/BRIEF.md`. Completa el BRIEF con lo que dijo la persona y las bandas fijas (dónde van captions, personaje, CTA) **antes** de escribir HTML. Copia al proyecto el material que te dio (a `assets/`).

## 5. Construir con los gates
1. Lee `FILOSOFIA-MOTION.md` si no lo hiciste en esta sesión, y carga las skills `hyperframes` y `gsap`.
2. Reemplaza el contenido del ejemplo por el de la persona (textos, tiempos, material). Respeta el Render Contract de `CLAUDE.md`.
3. Si hay voz: transcribe (`npx hyperframes transcribe … --language es --json`), corrige contra el guion y ancla cada cosa a su palabra. Si dudas de una palabra, pregunta (no puedes oír el audio).
4. `npx hyperframes lint` → 0 errores.
5. `npx hyperframes snapshot --at <3-6 instantes clave> --output renders/f` → abre cada PNG y míralo. Pásalos por `node ../../scripts/zonas-seguras.mjs renders/f/*.png --format <fmt>` y abre los `-zs-` (nada que no sea fondo en rojo). Arregla antes de enseñar.
6. `npx hyperframes preview` en segundo plano; pásale la dirección y dile qué mirar. Espera su OK explícito. Si no puede abrir el navegador, renderiza un borrador y dile dónde está.
7. Borrador: `npx hyperframes render --quality draft --output renders/borrador.mp4`. Lanza el agente `video-qa` (en Claude Code) o haz su checklist a mano.
8. Con el OK final: `npx hyperframes render --quality standard --output renders/<slug>.mp4`. Dile la ruta, la duración y el tamaño.
9. Cierra la vista previa.

## 6. Cerrar
- Anota en `BRIEF.md` → "Decisiones y cambios" lo que la persona corrigió.
- Si una corrección es una preferencia que va a repetir ("captions más grandes siempre"), propón anotarla en `DESIGN.md` → "Reglas de estilo".
- Nada de publicar: el vídeo queda en `renders/` y lo sube la persona.
