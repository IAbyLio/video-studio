# Pantalla partida (split screen)

**Estado:** probado (método usado en piezas reales aprobadas). Ejemplo mínimo con persona de relleno.

## Qué es
Tu cara centrada en la mitad de arriba y un panel grande en la mitad de abajo con el dato que estás contando: una regla, un número grande, un gráfico, un tablero. Ni la cara tapa el panel ni el panel tapa la cara.

## Cuándo usarlo
- El gráfico principal es alto (más de ~600 px): tablas, comparaciones, paneles de datos, una "regla" con número enorme.
- No para un chip o etiqueta chica (eso flota encima en *cara a cámara*), ni para diagramas sueltos en el centro (mejor el modo ventana chica de *cara a cámara*).

## Qué necesita
- Tu vídeo a cámara (vertical 1080x1920) o un avatar; las cifras que vas a mostrar (tuyas y comprobables).

## Cómo está hecho
- Arranca en pantalla completa; a los 0,8 s la cara sube a la mitad de arriba (`y: -300`, recortada a y 960) en 0,45 s, y 0,2 s después el panel sube desde abajo (`power3.out`, sin rebote: es una losa).
- Panel: `top: 960`, borde superior de color, esquinas redondeadas solo arriba, sombra hacia arriba. Su **fondo** puede llegar al borde inferior (es fondo); su **contenido** queda dentro de x 80–880 e y ≤ 1440.
- Las barras crecen con `scaleY` desde la base, una a una; la ganadora late unas veces (repeticiones finitas: nunca `repeat: -1`).

## Adaptarlo
- Cambia los `data-h` (altura relativa) y `data-v` (rótulo) de las barras, o reemplaza el contenido del panel por tu tarjeta.
- Si tu cara queda alta o baja en la mitad de arriba, ajusta `y` del modo `MITAD` (más negativo = sube) y el recorte (`inset(0 0 X 0)` con X = 1920 − (960 − y)).

## Trampas
- Texto del panel por debajo de y 1470 → lo tapa la descripción del post.
- Rótulos encima de las barras que chocan con el título: deja aire (`margin-top`) para el valor de la barra más alta.
- Cifras inventadas: en el ejemplo son de muestra y lo dice el código; en tu vídeo, solo datos tuyos.
