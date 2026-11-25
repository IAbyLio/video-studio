# Prompts de instalación

Elige el de la IA que usas, cópialo entero y pégaselo. Tu IA clona el repo, lo deja solo con los archivos que ella lee (paso 0 de `ONBOARDING.md`) y te guía por la instalación.

<!-- Generado por scripts/prompts-instalacion.mjs desde prompts/prompts.json: edita el JSON, no este archivo. -->

## Claude Code

```text
Uso Claude Code. Quiero instalar el estudio de vídeo "video-studio" en mi ordenador. Hazlo así:

1. Clona https://github.com/IAbyLio/video-studio en una carpeta nueva (si no te digo otra, en mi carpeta de Documentos) y ábrela como carpeta de trabajo.
2. Dentro de esa carpeta, abre ONBOARDING.md y sigue sus pasos en orden, empezando por el paso 0 con la opción "claude" (node scripts/adaptar-ia.mjs --ia claude): se quedan CLAUDE.md y la carpeta .claude/, y se quita lo que es de otras IA.
3. Antes de instalar cualquier cosa en el sistema (Node, FFmpeg, whisper, etc.) explícame qué es y para qué, y espera mi OK.
4. Nunca me pidas claves, contraseñas ni tokens por el chat: si hace falta alguna, dime que la escriba yo en el archivo .env.
5. Pregúntame las cosas de una en una, con opciones cerradas cuando se pueda.
```

## Codex (sin probar)

```text
Uso Codex (de OpenAI). Quiero instalar el estudio de vídeo "video-studio" en mi ordenador. Hazlo así:

1. Clona https://github.com/IAbyLio/video-studio en una carpeta nueva (si no te digo otra, en mi carpeta de Documentos) y ábrela como carpeta de trabajo.
2. Dentro de esa carpeta, abre ONBOARDING.md y sigue sus pasos en orden, empezando por el paso 0 con la opción "codex" (node scripts/adaptar-ia.mjs --ia codex): se queda AGENTS.md preparado para Codex, las skills pasan a .agents/skills/ y los agentes a .codex/agents/, y se quitan CLAUDE.md y la carpeta .claude/.
3. Antes de instalar cualquier cosa en el sistema (Node, FFmpeg, whisper, etc.) explícame qué es y para qué, y espera mi OK.
4. Nunca me pidas claves, contraseñas ni tokens por el chat: si hace falta alguna, dime que la escriba yo en el archivo .env.
5. Pregúntame las cosas de una en una, con opciones cerradas cuando se pueda.
```

## Otra IA agéntica (sin probar)

```text
Uso otra IA agéntica que trabaja en mi ordenador con acceso a la terminal (no es Claude Code ni Codex). Quiero instalar el estudio de vídeo "video-studio" en mi ordenador. Hazlo así:

1. Clona https://github.com/IAbyLio/video-studio en una carpeta nueva (si no te digo otra, en mi carpeta de Documentos) y ábrela como carpeta de trabajo.
2. Dentro de esa carpeta, abre ONBOARDING.md y sigue sus pasos en orden, empezando por el paso 0 con la opción "otra" (node scripts/adaptar-ia.mjs --ia otra): AGENTS.md queda como fuente única de instrucciones, las skills en formato estándar en .agents/skills/ y los agentes como documentos en agentes/; se quitan CLAUDE.md y la carpeta .claude/. Esta opción no está probada: si algo no encaja con tus herramientas, dímelo en vez de improvisar.
3. Antes de instalar cualquier cosa en el sistema (Node, FFmpeg, whisper, etc.) explícame qué es y para qué, y espera mi OK.
4. Nunca me pidas claves, contraseñas ni tokens por el chat: si hace falta alguna, dime que la escriba yo en el archivo .env.
5. Pregúntame las cosas de una en una, con opciones cerradas cuando se pueda.
```
