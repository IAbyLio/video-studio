# Tarjeta que crece por estados

La escena más rentable del formato largo: la tarjeta nace compacta (solo el título, centrado) y se expande a medida que llega el contenido. Estados: compacta → transformación 1 → contenido 1 → transformación 2 → contenido 2 → (transformación 3) → salida.

## HTML
```html
<div id="t1" class="clip tarjeta es-compacta" data-start="…" data-duration="…" data-track-index="…">
  <div class="cabecera"><div class="num">1</div><div class="titulo">Formación</div></div>
  <div class="contenido">
    <div class="logos">…</div>
    <div class="puntos">…</div>
    <div class="subtarjeta">…</div>
  </div>
</div>
```

## CSS
```css
.tarjeta {
  position: absolute; left: 660px; right: 60px; top: 110px; bottom: 130px;
  border-radius: calc(var(--radio) * 2); padding: 36px 40px; box-sizing: border-box;
  background: color-mix(in srgb, var(--superficie) 70%, transparent);
  backdrop-filter: blur(22px) saturate(1.3);
  border: 2px solid color-mix(in srgb, var(--acento) 32%, transparent);
  display: flex; flex-direction: column; gap: 26px; overflow: hidden;
}
.tarjeta.es-compacta .contenido { display: none; }   /* en compacta, la cabecera se centra sola */
```

## Timeline
```js
gsap.set('#t1', { opacity: 0, scale: 0.92, left: 960, right: 360, top: 470, bottom: 470 });   // compacta, centrada en el panel derecho
gsap.set('#t1 .cabecera', { x: X_DESPLAZ, y: -7 });   // parece centrada aunque el flex la ponga arriba a la izquierda
['#t1-l1', '#t1-l2'].forEach((s) => gsap.set(s, { opacity: 0, y: 24, scale: 0.7 }));
gsap.set('#t1-p1', { opacity: 0, y: 16 });

tl.to('#t1', { opacity: 1, scale: 1, duration: 0.55, ease: 'expo.out' }, T_ENTRA);

// Transformación 1: se quita la clase y, en el mismo instante, el transform compensa el salto de layout
tl.call(() => { const c = document.getElementById('t1'); if (c) c.classList.remove('es-compacta'); }, [], T_M1);
tl.to('#t1 .cabecera', { x: 0, y: 0, duration: 1.0, ease: 'power3.inOut' }, T_M1);
tl.to('#t1', { left: 660, right: 60, top: 110, bottom: 580, duration: 1.0, ease: 'power3.inOut' }, T_M1);

tl.to('#t1-l1', { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, T_LOGO1);   // en su palabra
tl.to('#t1-l2', { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }, T_LOGO2);

// Transformación 2: crece hasta abajo y entran los puntos
tl.to('#t1', { bottom: 130, duration: 0.55, ease: 'power2.inOut' }, T_M2);
tl.to('#t1-p1', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, T_PUNTO);

tl.to('#t1', { opacity: 0, scale: 1.02, filter: 'blur(8px)', duration: 0.5, ease: 'power2.in', overwrite: 'auto' }, T_SALE);
```

## El desplazamiento de la cabecera
```
ancho_compacta  = 1920 − left − right   (p. ej. 600)
ancho_contenido = ancho_compacta − 80   (40 de padding a cada lado)
ancho_cabecera  ≈ número (82) + hueco (22) + ancho del título
X_DESPLAZ = (ancho_contenido − ancho_cabecera) / 2
```
`y: -7` compensa que el número es un poco más alto que el título. Con títulos largos, ensancha la compacta (700-720) en vez de achicar la letra.

## Lo que costó aprender
- **Salto al quitar la clase:** quitar `es-compacta` cambia el layout de golpe. La compensación con transform en el mismo instante lo convierte en un movimiento suave.
- **Elementos que llegan después** (un precio, una etiqueta): déjalos en el layout desde el principio con `opacity: 0`, `flex-shrink: 0`, y `overflow: hidden` en su contenedor. Con `display: none` → `flex` el layout se recoloca y se nota un salto justo antes de la posición final.
- **Subtarjeta que se ensancha:** fija el ancho inicial con `gsap.set` (`width: 340`) y anima al final (`width: 760`) con `box-sizing: border-box`; si el contenido tiene que deslizarse dentro, anima `paddingLeft` a la vez. Curva `sine.out` o `power2.inOut`, nunca `power3.inOut` en anchos (su cola lenta "salta" al final).
- **Logos cuadrados:** contenedor con alto fijo y `width: auto`; un ancho fijo deja huecos a los lados.
