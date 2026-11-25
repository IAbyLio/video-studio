# Modo crítico: rúbrica numérica para un segundo agente

Un agente que **NO escribió el guion** lo puntúa y obliga a rehacer. El guion sale a voz solo con **8 o más**. Máximo **3 rondas**; si no llega, decide la persona con las tres versiones delante.

## Cómo se orquesta (lo hace la sesión principal, no el crítico)
1. El **escritor** entrega: guion vN con las piezas etiquetadas [1]-[8], la **hoja de hechos** y el brief (tema, formato, duración, quién narra).
2. Se lanza un **subagente nuevo** (contexto limpio, nunca el que escribió) con el prompt de abajo, pegando guion, hoja de hechos, brief y, desde la ronda 2, la crítica anterior.
<!-- IA:claude -->
   Con la herramienta de agentes (Agent). Si no la tienes en esta sesión: que la persona abra una sesión nueva y le pegue el prompt; díselo.
<!-- /IA -->
<!-- IA:codex -->
   Pide explícitamente un subagente para la crítica (Codex delega cuando se le pide). Si no puedes lanzarlo en esta sesión: que la persona abra una sesión nueva y le pegue el prompt; díselo.
<!-- /IA -->
<!-- IA:otra,fuente -->
   Si tu IA puede lanzar subagentes, usa uno. Si no: que la persona abra una sesión nueva y le pegue el prompt; díselo.
<!-- /IA -->
3. `SALE` → modo producción sin más cambios.
4. `REHACER` → el escritor aplica **todos** los obligatorios y entrega la versión siguiente.
5. Tras la **ronda 3** sin `SALE`: no hay ronda 4. Paquete para la persona: v1, v2, v3, las tres críticas y una recomendación de una línea.

**Hoja de hechos:** afirmaciones verificables que el guion puede usar, cada una con fuente y fecha (ej.: "hice 12 vídeos en noviembre: carpeta proyectos/, contado el 2026-11-30"). Lo que el guion afirme y no esté en la hoja es, por definición, no verificado. Sin hoja, el crítico devuelve `REHACER` con un único obligatorio: "falta la hoja de hechos".

## Prompt del crítico (copiar tal cual al subagente)
```
Eres el crítico de guiones de vídeos cortos de esta persona (ver BRIEF). No escribiste este
guion y no lo vas a reescribir: lo puntúas con la rúbrica, listas los cambios obligatorios y
das un veredicto. Sé exigente: un 8 tiene que ganarse.

Antes de puntuar, lee:
- .claude/skills/analisis-viralidad/references/critico.md (esta rúbrica, anclas incluidas)
- .claude/skills/analisis-viralidad/references/estructura-8-piezas.md
- .claude/skills/analisis-viralidad/references/ganchos-virales.md
- .claude/skills/analisis-viralidad/references/correcciones-guiones.md
- .claude/skills/analisis-viralidad/references/referentes.md
- DESIGN.md (sección "Tono y voz")

Te paso: BRIEF, HOJA DE HECHOS, GUION (vN) y, si es ronda 2 o 3, la CRÍTICA ANTERIOR.

1. Vetos (antes de las notas), cada uno es cambio obligatorio BLOQUEANTE:
   V1 Honestidad: afirma algo de la persona o su negocio que no está en la HOJA DE HECHOS.
   V2 Copia: frase, personaje o cifra tomada de un referente u otra cuenta.
   V3 Bucle sin cerrar dentro de la pieza, o cerrado "en el próximo vídeo".
   V4 Voz: algo que DESIGN.md dice que la persona no usa, o emojis en lo hablado.
   V5 Muletilla prohibida de correcciones-guiones.md.
2. Puntúa las 6 dimensiones de 0 a 10 (enteros) con las anclas. Nota + una línea citando
   la frase. Si dudas entre dos anclas, la de abajo.
3. Global = (2 x gancho + claridad + cifras + bucles + ritmo + CTA) / 7, un decimal.
4. SALE solo si global >= 8.0, ninguna dimensión < 6 y cero vetos. Si no, REHACER.
5. Cambios obligatorios: todo veto + toda dimensión < 7 genera al menos uno. Cada uno:
   pieza ([1]-[8]), qué falla, qué tiene que lograr la versión nueva (no escribas la frase).
   Máximo 6, por impacto.
6. Sugerencias opcionales, máximo 3.
7. Ronda 2 o 3: comprueba uno por uno los obligatorios anteriores. Uno no aplicado se
   repite y baja 1 punto la dimensión afectada.

Formato de salida (exacto):
## Crítica ronda N (guion vN)
Vetos: ninguno | V1: "<frase>" ...
| Dimensión | Nota | Por qué (cita) |
|---|---|---|
| Gancho | x/10 | ... |
| Claridad | x/10 | ... |
| Especificidad de cifras | x/10 | ... |
| Bucles | x/10 | ... |
| Ritmo | x/10 | ... |
| CTA | x/10 | ... |
Global: x.x/10 (gancho pesa doble)
Veredicto: SALE | REHACER
Cambios obligatorios:
1. [pieza] qué falla -> qué tiene que lograr
Sugerencias:
- ...
Obligatorios de la ronda anterior: (solo ronda 2-3) 1. aplicado | no aplicado ...
```

## Anclas por dimensión
Un 7 es "casi 8, le falta una cosa nombrable". El crítico siempre cita la frase.

### 1. Gancho (pieza [1], peso doble)
| Nota | Ancla |
|---|---|
| 0-2 | Arranca con saludo, contexto o presentación ("Hoy les quiero contar…"). No matchea ningún tipo del catálogo |
| 5 | Matchea un tipo pero es un anuncio sin imagen ("Ahora puedes hacer X"), o no frena; o es de alto impacto sin justificación en [2] |
| 8 | Tipo identificable, una sola idea, se entiende en una lectura, abre un vacío concreto y toca un deseo SSDD. Si es de alto impacto, [2] lo justifica. Menos de ~20 palabras |
| 10 | Lo del 8 + una escena (protagonista + verbo + momento) que se ve sin imagen, o una contradicción que obliga a quedarse. Ninguna palabra sobra. Literalmente cierto |

### 2. Claridad (filtro del 5 + del 50)
| Nota | Ancla |
|---|---|
| 0-2 | Jerga sin traducir en varias frases o el hilo no se sigue |
| 5 | Se entiende pero 2-3 frases exigen contexto, o el ángulo solo le sirve a quien ya sabe |
| 8 | Cero jerga sin traducir; cada cuerpo se entiende solo; el beneficio en palabras de quien mira |
| 10 | Lo del 8 y le sirve a alguien totalmente ajeno al tema: lo repetiría con sus palabras |

### 3. Especificidad de cifras
| Nota | Ancla |
|---|---|
| 0-2 | Nada concreto ("mucho", "mejor"), o cifras fuera de la hoja de hechos (además es V1) |
| 5 | Una cifra vaga o redonda sin fuente, o cifras amontonadas en un tramo |
| 8 | Al menos 2 cifras propias, de la hoja de hechos, en cuerpos distintos, que se entienden solas |
| 10 | Lo del 8 y una cifra rara o contraintuitiva que sostiene el gancho. Ninguna decorativa |

### 4. Bucles (piezas [4] y [6])
| Nota | Ancla |
|---|---|
| 0-2 | No hay bucles, o uno no se cierra (además es V3) |
| 5 | Anuncian en vez de prometer, o el 2 no sube la tensión |
| 8 | Dos bucles con pregunta concreta, cada uno cerrado en el cuerpo siguiente, el 2 sube la apuesta, lo más sorprendente detrás del 2. Cortos |
| 10 | Lo del 8 + un mini-bucle temprano que se paga en el remate, o un meta-giro que resignifica el gancho |

### 5. Ritmo
Referencia: vídeos que retienen bien rondan 2,9-3,4 palabras por segundo. Objetivo: 45-65 s (8 piezas) o 6 piezas si baja de 30 s.
| Nota | Ancla |
|---|---|
| 0-2 | Más de 15 s fuera de duración sin razón, subordinadas imposibles de decir de un tirón, o la intro tarda más de 30 palabras en dar algo útil |
| 5 | Duración bien pero tramos planos, un cuerpo que no cabe en 2-3 frases, o lo más fuerte enterrado |
| 8 | Dentro de duración; frases de menos de ~15 palabras alternando largas y golpes; se dice en voz alta sin trabarse |
| 10 | Lo del 8, va de menos a más sorprendente y ninguna frase sobra |

### 6. CTA (pieza [8])
| Nota | Ancla |
|---|---|
| 0-2 | No hay, o es genérico ("dale like y suscríbete"), o promete la respuesta en otro vídeo |
| 5 | Doble o triple (seguir + comentar + guardar), palabra clave genérica, o no dice qué recibe |
| 8 | Una sola acción, a los que llegaron, con lo que recibe dicho en concreto. Lo prometido existe el día de publicar |
| 10 | Lo del 8 y la palabra clave hace callback al gancho o al remate: cierra el arco |

## Para que la nota no se infle
Antes de dar un 9 o un 10 en una dimensión, el crítico tiene que poder citar la frase exacta que lo justifica contra el ancla. Si no puede, la nota está inflada. Como referencia de escala: el esqueleto de ejemplo de `estructura-8-piezas.md` rondaría un 7 (gancho 8, claridad 8, cifras 4 porque no tiene ninguna propia, bucles 8, ritmo 8, CTA 8): le falta especificidad.
