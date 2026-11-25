# Ejemplo: reglas de estilo que uno va fijando

> No son reglas de este repo ni van por defecto. Son un ejemplo real (anonimizado) de cómo una persona fue anotando sus preferencias revisando sus propios vídeos. Sirve para ver el formato: cuando corrijas algo que quieras para siempre, tu IA lo anota en `DESIGN.md` → "Reglas de estilo" con esta forma (regla + por qué + fecha).

## 1. Mostrar, no ilustrar
- Si el guion nombra "vídeos de otros", se muestran vídeos de verdad reproduciéndose, no rectángulos abstractos.
- Si el guion nombra algo generado con IA, se muestra el material real generado, con una etiqueta corta ("generado con IA").
- En comparaciones ("antes y después", "prueba y error"), cosas que se vean bien distintas entre sí.

## 2. Marcas de herramientas: logo en 3D, no texto
- Al nombrar una herramienta conocida, su logo oficial como objeto 3D (sin deformarlo ni recolorearlo), en vez de la palabra escrita.

## 3. Personaje
- El personaje es protagonista, grande en cuadro, no un adorno chico. Cuando está grande, sus pies pueden salir por abajo de la zona segura (la cara no).
- Los objetos con los que interactúa, en 3D de verdad y apoyados en su mismo suelo, no flotando.

## 4. Texto en pantalla
- Captions siempre cerca del centro, centradas en x = 540, una a tres palabras con la clave resaltada.
- Cifras en número en etiquetas ("100 %"); en la voz, como se dice.
- Sin logo de marca fijo durante todo el vídeo.
- Etiquetas y flechas con trazo dibujado a mano para señalar: pocas y grandes.
- **Esquinas interiores redondeadas:** todo lo que va dentro de un marco redondeado lleva también las esquinas redondeadas (radio interior = radio del marco − grosor del borde). Trampa técnica: en el render, un `<video>` con transformaciones 3D no se recorta con el `overflow: hidden` del contenedor; el radio va en el propio vídeo (`border-radius` + `clip-path: inset(0 round R)`). Verificar sobre el MP4, no sobre la vista previa.

## 5. Proceso
- Antes de construir el vídeo entero, un fotograma fijo por parte del guion para validar el enfoque.
- Las respuestas largas, por chat (los formularios las recortan).
