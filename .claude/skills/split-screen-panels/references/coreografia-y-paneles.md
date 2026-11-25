# Coreografía completa y variantes de panel

## La regla del margen
Cada cambio de modo empieza **0,20 s antes** del `data-start` de la escena a la que entra:
```
t − 0,20 : empieza el cambio de modo (0,45 s, expo.inOut)
t        : data-start de la escena nueva (el panel empieza su entrada en 0,10)
t + 0,25 : la cara ya está en su sitio
```
Si el cambio empieza en `t` o después, el panel y la cara se mueven a la vez y pelean por la atención.

## El marco de la ventana chica
Al **entrar** en ventana chica, el marco de color alrededor aparece 0,10 s **después** de que la cara empieza a encogerse (si aparece a la vez, flota en el vacío). Al **salir**, al revés: primero se va el marco y después se mueve la cara (un marco alrededor de una cara que crece parece estirarse).

## Cadena de ejemplo (vídeo de 7 escenas, tiempos de `data-start`)
```
Escena 1 gancho     t=0,00   completa   (sin cambio)
Escena 2 contexto   t=8,00   mitad      cara a los 7,80
Escena 3 golpe      t=24,65  mitad      (mismo modo)
Escena 4 idea       t=35,68  ventana    cara a los 35,48, marco a los 35,58
Escena 5 detalle    t=52,28  ventana    (mismo modo)
Escena 6 regla      t=65,63  mitad      marco fuera a los 65,33, cara a los 65,43
Escena 7 cierre     t=77,88  completa   cara a los 77,68
```

## Variantes de panel (todas con la geometría de `.panel` del SKILL.md)

### A. Tablero (datos o una interfaz simulada)
Cabecera con punto de estado, un gráfico y una fila de indicadores. Se recrea con las variables de marca; nunca una captura real de una plataforma (se ve ajena a la marca y puede llevar datos privados).
```html
<div class="panel panel-tablero" id="panel">
  <div class="cab"><span class="punto"></span><span class="titulo">Ventas de la semana</span><span class="estado">EN VIVO</span></div>
  <div class="grafico"><!-- SVG: barras o línea que se dibuja --></div>
  <div class="kpis">
    <div class="kpi"><div class="etq">PEDIDOS</div><div class="val"><span id="kpi-1">128</span></div></div>
    <div class="kpi"><div class="etq">TICKET MEDIO</div><div class="val"><span id="kpi-2">34</span> €</div></div>
  </div>
</div>
```
```css
.panel-tablero { display: flex; flex-direction: column; gap: 28px; }
.panel-tablero .cab { display: flex; align-items: center; gap: 18px; font-family: var(--fuente-titulos); color: var(--texto); }
.panel-tablero .punto { width: 14px; height: 14px; border-radius: 50%; background: var(--acento); }
.panel-tablero .titulo { flex: 1; font-size: 38px; }
.panel-tablero .estado { font-family: var(--fuente-mono); font-size: 22px; letter-spacing: 0.14em; color: var(--acento); }
.panel-tablero .kpis { display: flex; gap: 26px; }
.panel-tablero .kpi { flex: 1; border: 2px solid color-mix(in srgb, var(--texto) 15%, transparent); border-radius: 20px; padding: 18px 20px; }
.panel-tablero .etq { font-family: var(--fuente-mono); font-size: 22px; letter-spacing: 0.14em; color: var(--texto-suave); }
.panel-tablero .val { font-family: var(--fuente-titulos); font-weight: var(--peso-titulos); font-size: 56px; color: var(--texto); font-variant-numeric: tabular-nums; }
```
Variante "caída": la línea del gráfico se desploma, los indicadores pasan a `var(--negativo)` y entra un sello **después** de que la caída se ve entera.

### B. Tarjeta con regla (un número protagonista)
Un número enorme (180 px o más, que se lea en miniatura), una etiqueta corta y una línea de apoyo.
```css
.panel-regla { display: flex; flex-direction: column; justify-content: space-between; padding: 54px 80px 60px; }
.panel-regla .numero { font-family: var(--fuente-titulos); font-weight: var(--peso-titulos); font-size: 240px; line-height: 0.9; letter-spacing: -0.03em; text-align: center; color: var(--texto); font-variant-numeric: tabular-nums; }
.panel-regla .numero .sep { color: var(--acento); }
.panel-regla .apoyo { font-family: var(--fuente-texto); font-size: 40px; text-align: center; color: var(--texto-suave); }
```
Entrada: el número cuenta hasta su valor (`tl.to(obj, { v: 20, onUpdate })`) y después la línea de apoyo; el remate se queda ≥ 1 s.

### C. Aviso (lo que no hay que hacer)
Borde superior en `var(--negativo)`, icono grande, título y 2-3 puntos que entran uno a uno al ritmo de la voz. Un leve temblor finito del icono (`repeat: 5`, nunca `-1`) cuando se nombra el problema.

## Contador sin red ni azar
```js
const obj = { v: 0 };
tl.to(obj, { v: 128, duration: 1.2, ease: 'power2.out',
  onUpdate: () => { document.getElementById('kpi-1').textContent = Math.round(obj.v).toLocaleString('es-ES'); } }, 0.5);
```
