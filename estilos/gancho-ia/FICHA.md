# Gancho generado con IA + composición

**Estado: probado.** El método se usó en un reel real aprobado a la primera en el estudio del que sale este repo. El ejemplo de esta carpeta es una versión mínima nueva y **usa un clip PLACEHOLDER hecho por código** (una torre de bloques dibujada con HTML, en `placeholder/`) para poder renderizar sin gastar nada. En tu vídeo, ese clip lo reemplaza uno generado con una IA de vídeo.

## Qué es

La IA de vídeo hace lo que es caro de construir (un plano realista con tensión: algo a punto de caerse, golpearse, derramarse) y el código hace todo lo que tiene que ser exacto (congelado, cara, texto, voz, sonido). El clip generado es **solo el gancho y el remate**: el guion vive sobre un **fotograma congelado en el punto de máxima tensión**, y el desenlace se ve al final, como premio para quien se quedó.

El ejemplo: una torre de bloques; un dedo saca el de abajo; justo antes de caer, el vídeo se congela, la torre "habla" con una cara dibujada por código, y al descongelar se cae.

## Cuándo usarlo

- Hay una escena cotidiana con un desenlace que el espectador **necesita** ver, y esa escena es una metáfora directa del mensaje ("tu proyecto se apoya en una pieza que nadie anotó").
- Quieres frenar el scroll con algo físico en vez de una cara o un titular.

## Cuándo no

- Si el mensaje necesita explicar datos desde el principio (mejor pizarra viva o mundo 3D).
- Si la escena no tiene un desenlace pendiente: sin tensión, no hay congelado que aguante.
- Si no quieres gastar: generar vídeo con IA es de pago.

## Qué necesita

- **Una cuenta en una plataforma de IA de vídeo** (la que tengas: Higgsfield, Seedance a través de la plataforma que lo ofrezca, etc.). **Gasta créditos: pide OK antes y lee el precio en la plataforma en el momento**, porque cambia.
- Opcional: una voz para el objeto que habla (módulo `voz`) y Rhubarb para su boca (módulo `personaje-3d`). Sin voz, el ejemplo usa bocas sintéticas.
- Módulo relacionado: `modulos/ganchos-ia/`.

## Cómo se construye (y dónde están los gates de coste)

El estado de cada fase conviene llevarlo en un `CONTEXTO.md` del proyecto.

1. **Idea (gate con la persona).** Una escena, un plano continuo, tres tiempos: **arranque en tiempo real → cámara lenta con acercamiento → primer plano justo antes del desenlace**. El desenlace se genera dentro del mismo clip aunque se use al final. La metáfora tiene que decirse en una frase.
2. **Fotograma inicial (gate: coste de imagen).** Se genera antes que el vídeo porque iterar imagen es barato y vídeo no: el encuadre exacto de partida, 9:16, "parece un fotograma de móvil". Si sale una persona, que no sea alguien reconocible salvo decisión explícita. Un fotograma final solo si hay una posición crítica; los modelos se atascan con relaciones espaciales finas: no gastes más de 2-3 intentos.
3. **Vídeo (gate: coste de vídeo, el más caro).** Desde el fotograma inicial, proporción heredada, 8-10 s (3 s en tiempo real + 4-5 s de cámara lenta + desenlace). Resolución baja (tipo 480p) para la estética de móvil: no se "corrige". Mejor **con audio nativo** (ambiente, golpe): es el sonido del gancho y del remate. Prompt por tramos con segundos ("0-3 s…, 3-8 s…") y una lista de negativos. Pide la acción importante dentro de la zona segura: un objeto clave bajo los botones de la app no se ve.
4. **Punto de congelado.** Mídelo **sobre el clip definitivo**, fotograma a fotograma (hoja de contacto con ffmpeg). Elige el último fotograma donde **se entiende lo que va a pasar**, no el último antes del impacto. Anota también el fotograma del primer contacto: ahí cae el sonido del remate.
5. **Vídeo base único** (`placeholder/preparar.sh`): clip hasta el congelado + ese fotograma repetido durante el guion + desenlace, en **un solo MP4**. Un PNG congelado + un `<video>` da un salto de niveles visible en cada relevo.
6. **(Si habla) voz y cara.** El objeto en tensión puede ser el narrador: rompe la cuarta pared justo cuando el espectador espera el desenlace y tiene un motivo propio para hablar (no quiere caerse). Cara con `cara.js` (`Cara.mount`: ojos, cejas y bocas por visema), montada **en el mismo contenedor que el vídeo** para que el acercamiento la arrastre; aparece al congelar. Si el objeto se mueve, `scripts/personaje/seguir-objeto.mjs` lo sigue fotograma a fotograma. Una voz nueva es una identidad nueva: declárala en `modulos/voz/perfiles.json` con su autorización.
7. **Guion.** Estructura de 8 piezas (skill `analisis-viralidad`) con una particularidad: **el congelado es el bucle abierto largo** y se cierra con el desenlace. El gancho verbal nombra lo que el espectador está esperando ("¿Esperas a ver si se cae?"). Orden: arranque → metáfora → cuerpos → llamada a la acción → **remate = el desenlace**, después de la llamada. Unas 150 palabras de voz como máximo: más, y queda un minuto de imagen quieta.
8. **Composición.** Acercamiento muy lento durante el congelado y 2-3 reencuadres suaves en los cambios de párrafo (una imagen quieta se muere sin eso); zoom-out rápido al descongelar. Anotaciones arriba (y ≥ 240), objeto en el centro, captions sin pasar de y 1470 y con borde derecho ≤ 895. Gráficos discretos como anotaciones sobre el vídeo, texto ≥ 44 px a 1080 de ancho. Grano en dos capas (más grueso sobre clip y cara, fino sobre gráficos) para que lo nítido case con el 480p.
9. **Sonido.** Tres fuentes: audio nativo del gancho, voz intacta y audio nativo del remate. Corte seco al congelar + **un solo** clic; golpe del remate alineado con su fotograma y reforzado con un SFX grave (módulo `sonido`). Música muy baja bajo la voz, fuera antes del remate.
10. **Revisión.** Fotogramas en palabras y pausas (la boca no se queda abierta en silencios), zonas seguras, y la escucha de la persona: las comprobaciones automáticas no sustituyen el oído.

## Trampas

- Un `<video>` con `data-start` no puede ir dentro de otro elemento con `data-start` (el lint de Hyperframes lo marca como error): el contenedor de cámara va sin tiempos.
- El grano con ruido temporal se aplica ANTES de congelar: así el fotograma congelado es idéntico en toda la pausa (comprobado: mismo hash a 3,5 y 4,5 s).
- El ruido sube mucho el peso del MP4: en el ejemplo, con `-crf 28` y ruido suave, el vídeo base pesa ~350 KB.
- Los modelos de vídeo cambian sus interfaces y tarifas: vuelve a leer el precio antes de cada generación.

## Cómo adaptarlo

1. Genera tu clip real (con los gates de arriba) y guárdalo en el proyecto.
2. `bash estilos/gancho-ia/placeholder/preparar.sh <tu-clip.mp4> <segundo-de-congelado> <segundos-de-pausa>` (en tu proyecto, ajusta la ruta de salida).
3. En el `index.html`: `CONGELA` y `HOLD` iguales a lo que pasaste al script; mueve la elipse de la cara (`forma`) sobre tu objeto en el fotograma congelado; cambia textos y la lista `FRASE` por los tiempos de tu voz.

## Comprobado en este repo

Placeholder y ejemplo con `npx hyperframes lint` sin errores; render draft de 6 s; fotogramas revisados en 0,3 · 2,0 · 3,4 · 4,3 · 5,5 s (gancho, tensión, cara hablando, remate); zonas seguras de reel revisadas con `scripts/zonas-seguras.mjs` (el dedo del clip entra en la columna de botones, pero es metraje de fondo; textos, cara y anotación quedan dentro).
