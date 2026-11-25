# Filosofía de motion: cómo se mueve un buen vídeo corto

> Para la IA: leelo antes de componer cualquier vídeo y repasa la lista final antes de decir que algo está listo. La estética (colores, fuentes) sale de `DESIGN.md`; esto es la **disciplina**, que vale para cualquier marca.

## Las leyes
1. **Una idea por momento.** Cada escena dice una sola cosa. Si hay dos, son dos escenas.
2. **Nada se queda muerto.** En cada instante hay algo moviéndose: si las entradas terminan pronto, suma movimiento secundario (una deriva, un brillo que respira, un subrayado que se dibuja). Un fotograma quieto más de 1 s se lee como error.
3. **El remate se sostiene.** Lo importante de cada escena (el número, la palabra clave, el sello) queda al menos 1 s en pantalla, mejor 1,5.
4. **El sello llega después de lo que sella.** Un "¡NO!" o un tachado entra 0,1-0,25 s después de que el texto que lo justifica terminó de aparecer, no a la vez.
5. **Las transiciones cuentan algo.** Nunca dos cortes secos seguidos. Varía: salida hacia arriba con desenfoque, empuje, barrido, cambio de modo de cara, el propio conector de una pizarra. La salida de una escena **es** la transición.
6. **Varía las curvas.** Al menos tres tipos de *ease* por escena (`expo.out` para entradas vivas, `power3.out` para losas, `back.out` para rebote chico, `power4.in` para golpes).
7. **Pocos colores y con significado.** Máximo 4-5. Cada uno quiere decir algo (positivo, negativo, neutro, destacado) y se usa siempre igual. Un color sin significado es ruido.
8. **El fondo es una capa, no un color.** Degradado + textura sutil (cuadrícula, grano, partículas) + viñeta. Un fondo plano parece un borrador.
9. **Cámara viva.** Todo el "mundo" dentro de un contenedor `#cam`: deriva lenta (escala 1 → 1,03-1,05) en cada tramo, golpe en las palabras clave (+0,05-0,08 en 0,3 s con un poco de rebote) y vuelta al reposo entre partes. La viñeta queda fuera (es la lente). Con una persona a pantalla completa, nunca por debajo de escala 1.
10. **Captions que entran, no que etiquetan.** Cada palabra aparece cuando se dice (opacidad + subida + desenfoque que se limpia, ~0,3 s), el bloque sale hacia arriba al cambiar de frase. Contorno con `text-shadow`. Huecos a propósito cuando la frase ya está en pantalla.
11. **Un golpe cada ~5 s.** Algo que sorprenda: una palabra que entra gigante, un cambio de modo de cara, un objeto que actúa. Sin eso, un vídeo correcto se olvida.
12. **Los objetos actúan.** Si se nombra algo, ese algo hace algo en ese instante (si se dice "guardar", la hoja entra en la carpeta).
13. **De a tres.** Listas de tres se recuerdan; de cinco, no.
14. **Volver al principio.** Un remate que retoma el gancho (callback) cierra el vídeo mejor que un final nuevo.
15. **El final respira.** El último plano queda 1,5-3 s quieto pero vivo (en reels cortos, menos; en piezas largas, hasta 4-6 s).
16. **El audio manda.** Con voz, primero la voz definitiva y después cada entrada se ancla a su palabra (con la palabra en un comentario del código). Una animación con ritmo propio "va demasiado rápido".

## Recetas que se repiten
```js
// entrada de palabra (captions)
tl.fromTo(w, { opacity: 0, y: 26, scale: 0.92, filter: "blur(6px)" }, { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.3, ease: "expo.out" }, t);
// golpe tipográfico en la palabra pico (y golpe de cámara en el mismo instante)
tl.fromTo(slam, { scale: 1.85, filter: "blur(10px)", opacity: 0 }, { scale: 1, filter: "blur(0px)", opacity: 1, duration: 0.26, ease: "power4.in" }, t);
tl.to("#cam", { scale: 1.06, duration: 0.3, ease: "back.out(2.2)" }, t + 0.26);
// salida del bloque = transición
tl.to(bloque, { opacity: 0, y: -100, filter: "blur(12px)", duration: 0.25, ease: "power2.in" }, tFin);
// la timeline dura lo que dura el vídeo
tl.set({}, {}, DURACION);
```
- Repeticiones siempre finitas (`repeat: 3`), nunca `repeat: -1`.
- Fondos en canvas o 3D: función pura de una fase o del tiempo, conducida por GSAP.

## Lista antes de decir "listo"
- [ ] ¿Cada escena dice una sola cosa?
- [ ] ¿Hay movimiento en todo momento? ¿Ningún tramo quieto de más de 1 s sin intención?
- [ ] ¿Los remates se sostienen ≥ 1 s? ¿Los sellos llegan después de su texto?
- [ ] ¿Ninguna transición repetida dos veces seguidas?
- [ ] ¿Colores solo de la marca y con significado?
- [ ] ¿Fondo con capas?
- [ ] ¿Cámara viva (deriva, golpes, reposo)?
- [ ] ¿Captions legibles, centradas, sin duplicar lo que ya está en pantalla?
- [ ] ¿Un golpe cada ~5 s?
- [ ] ¿Todo dentro de las zonas seguras, en todo su recorrido?
- [ ] ¿Miraste los fotogramas de verdad?
