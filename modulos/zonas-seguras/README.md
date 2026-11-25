# Zonas seguras

Instagram, TikTok y YouTube tapan partes de la pantalla con su interfaz: pestañas arriba, nombre de la cuenta y texto del post abajo, botones de "me gusta" y "compartir" a la derecha. Lo que caiga ahí no se lee. Este módulo dice dónde no poner nada y lo comprueba sobre los fotogramas.

## La regla
Ningún **objeto** debajo de la interfaz: texto, captions, caras, manos, logos, tarjetas, iconos, personajes, flechas. Da igual que sea importante o de relleno. Lo único que puede llegar a los bordes es el **fondo** (color, degradado, textura, un vídeo usado como fondo completo).

## Reel / TikTok / Short vertical (1080 x 1920)

| Zona | Medida | Qué hay ahí |
|---|---|---|
| Arriba | y de 0 a 220 | Pestañas, cámara, audio |
| Abajo | y de 1470 a 1920 | Cuenta, texto del post, audio |
| Lados | 35 px a cada lado | Borde que algunos móviles recortan |
| Botones | x > 910 entre y 1160 y 1470 | Me gusta, comentar, compartir, guardar |

- **Zona segura:** x 35–1045, y 220–1470, sin nada en la columna de botones.
- **Lo centrado se centra en x = 540.** La columna de botones limita el ancho, no mueve el eje: un texto centrado va de x 185 a x 895 como mucho (710 px).
- **Primer fotograma y portada:** en el feed y en el perfil el reel se ve recortado (se pierden 240 px arriba y abajo). Lo que tenga que leerse ahí va entre y 240 e y 1470.
- **Lo que se mueve cuenta en todo su recorrido.** Una tarjeta puede cruzar una zona prohibida al entrar; no puede quedarse ni leerse ahí. En zooms de cámara, mira los extremos.
- **Persona a cámara:** el torso puede salir por abajo; la cara, las manos y los gestos van dentro.

## Otros formatos

```bash
node scripts/zonas-seguras.mjs --list          # formatos disponibles
node scripts/zonas-seguras.mjs --rect story    # rectángulo seguro en JSON
```

| Formato | Lienzo | Arriba | Abajo | Lados |
|---|---|---|---|---|
| Story 9:16 | 1080x1920 | 250 | 250 | 35 |
| Anuncio vertical 9:16 | 1080x1920 | 220 | 450 | 35 + botones |
| Post / carrusel 3:4 | 1080x1440 | 150 | 180 | 50 |
| Feed 4:5 (también anuncios de feed) | 1080x1350 | 150 | 180 | 50 |
| Cuadrado 1:1 | 1080x1080 | 110 | 135 | 50 |
| Horizontal 16:9 | 1920x1080 | 54 | 120 | 96 |

Son medidas aproximadas: unas salen de guías de diseño públicas (2026), otras de mirar la interfaz y otras son margen prudente propio (el JSON dice cuál es cuál). Las apps cambian: si algo te queda justo, compruébalo subiendo un borrador privado. Si un vídeo va a dos destinos (reel + story), vale la zona más restrictiva de las dos.

## Cómo se comprueba

1. **Antes de construir:** el `BRIEF.md` del proyecto lleva el bloque `## Zona segura` (lo escribe `scripts/nuevo-proyecto.mjs`). Sin él no se empieza.
2. **Mientras construyes:** saca fotogramas sin renderizar y pinta las zonas encima:
   ```bash
   cd proyectos/<slug>
   npx hyperframes snapshot --at 0.5,2,4 --output renders/f
   node ../../scripts/zonas-seguras.mjs renders/f/*.png --format reel
   ```
   Rojo = prohibido, amarillo = precaución, verde = contorno de la zona segura. La IA abre las imágenes y las mira.
3. **Después del borrador:** lo mismo con fotogramas del MP4 (`node scripts/extract-frames.mjs`). Un objeto en rojo es un error que se arregla antes de enseñarte el vídeo.

Atajo visual en la plantilla en blanco: `--guias: block` en el CSS pinta las zonas de reel en la vista previa (volver a `none` antes de renderizar).

## Archivos
- `zonas-seguras.json`: los datos (fuente única).
- `scripts/zonas-seguras.mjs`: el pintor de zonas sobre fotogramas.
