# Cómo escribir el texto que va a la voz (ElevenLabs)

Para que tu clon (o cualquier voz de ElevenLabs) entone bien. Script: `scripts/voz.mjs`.

## Regla de oro: a la voz va SOLO el texto hablado
Nada de `[anotaciones]`, encabezados (`GANCHO`, `CTA`), acotaciones (`(pausa)`, `(serio)`) ni markdown: el modelo lee en voz alta todo lo que recibe. `voz.mjs` rechaza textos con pinta de guion de producción (`--force` para saltarlo a propósito).

Guarda dos archivos por vídeo: `guion-audio.txt` (solo lo que se dice) y `GUION-VIDEO.md` (qué se ve en cada frase).

## v2 (`eleven_multilingual_v2`): la puntuación es la entonación
v2 no entiende etiquetas de emoción. La emoción sale de la puntuación, el largo de las frases y las palabras:

| Recurso | Efecto | Ejemplo |
|---|---|---|
| Punto y frase corta | Cierre firme, ritmo con golpe | "No. Es algo más simple." |
| Coma | Pausa breve, la idea sigue | "Abres la app, grabas, listo." |
| Puntos suspensivos | Duda, aire antes del remate | "Y piensas... esto lo hizo una IA." |
| `¿?` `¡!` (siempre con apertura) | Entonación de pregunta o exclamación real | "¿Se nota la diferencia?" |
| MAYÚSCULAS en UNA palabra | Énfasis | "NADIE te lo cuenta." |
| `<break time="0.6s" />` | Pausa forzada (máx. 3 s). Poquitas: muchas desestabilizan | Antes del remate |

- **Números:** los lee bien; si hay ambigüedad (años, teléfonos, siglas), escríbelos como se dicen.
- **La tilde fuerza la sílaba tónica:** si una palabra sale mal acentuada, escríbela con la grafía que la fuerza aunque difiera del texto en pantalla ("vídeo" en vez de "video").
- **Palabras en inglés:** prueba cómo las dice; si patina, escríbelas como suenan en el guion de audio.
- **Una idea por frase.** Las subordinadas largas suenan a lectura.
- **Escribe como se dice, no como se lee.** Leerlo en voz alta antes de generar es la mejor prueba.

Ajustes de referencia para clones en v2 (los reales salen de tu perfil en `perfiles.json`): `stability` 0,40–0,60 (más alto = más plano), `similarity` 0,82–0,95, `style` 0–0,3 (más = sobreactúa), `speed` 0,7–1,2.

## Por tramos (lo que hace `voz.mjs` por defecto)
- Cada párrafo (línea en blanco) es un pedido. Los tramos se encadenan con el texto anterior/siguiente y los ids de los pedidos previos, así la entonación no se reinicia.
- Si una frase sale rara: retoca su puntuación y regenera SOLO ese tramo con `--only N`. Ojo: es una toma nueva; vuelve a escuchar.
- `--oneshot`: todo en un pedido (útil para frases cortas de personaje, que a veces suenan más vivas).

## v4 (`eleven_v4`) con etiquetas
```bash
node scripts/voz.mjs proyectos/<slug>/guion-audio.txt --model v4 --output proyectos/<slug>/assets/voz.mp3
node scripts/voz.mjs --dry-run --model v4 --text "[calm] Prueba."      # sin red ni gasto
```
- Solo usa `stability` y `similarity` (regla: similitud 1,0, estabilidad 0,60–0,70). `style` y `speed` no cambian nada en v4.
- Etiquetas entre corchetes, **en inglés**, cortas: `[calm, confident]`, `[measured]`, `[lower, thoughtful]`, `[warm, inviting]`, `[pause]`, `[long pause]`. Una al principio del tramo, solo donde cambia la intención. Para un personaje caben más (`[playful]`, `[cheeky]`, `[conspiratorial, lower]`).
- Sin `<break>`: pausas con `...` o `[pause]`.
- v4 sale más ágil que v2 con el mismo texto.

## Comprobar sin escuchar (y después escuchar)
- `bash scripts/personaje/check-voz.sh <tramos...>`: duración, volumen, silencios largos y transcripción por tramo (whisper). Que no se lea ninguna etiqueta y que no falte texto.
- **Escuchar entero** sigue siendo el control de verdad: solo tú sabes si suena a ti.
- Los captions se sacan siempre de la voz FINAL (después de cualquier cambio de velocidad o tono).
