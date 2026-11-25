# Módulo: personaje 3D

Un personaje hecho con código que habla con lip-sync dentro de tus vídeos: narra, señala, reacciona. Gratis por pose
(no se genera ninguna imagen) y determinista. Trae un muñeco neutro de ejemplo (`muneco/`) y la guía para hacer el tuyo.

## Qué hay

| Pieza | Dónde |
|---|---|
| Muñeco de ejemplo (motor, poses, hoja, demo) | `muneco/` · ficha en `muneco/PERSONAJE.md` |
| Cara 2D con ojos, cejas y 9 bocas (sirve sobre 3D, sobre una forma o sobre un objeto filmado) | `scripts/personaje/cara.js` |
| Voz → bocas (Rhubarb + puerta de silencio; sin Rhubarb, boca por volumen) | `scripts/personaje/build-mouth-data.mjs` |
| Instalador de Rhubarb (macOS y Linux, sin sudo, a `.cache/rhubarb/`) | `scripts/personaje/instalar-rhubarb.sh` |
| Unir tramos de voz con pausas elegidas y QA de cada tramo | `scripts/personaje/unir-tramos.py`, `scripts/personaje/check-voz.sh` |
| Seguir un objeto filmado para pegarle una cara | `scripts/personaje/seguir-objeto.mjs` |
| Guía para hacer tu propio personaje | `HAZ-TU-PERSONAJE.md` |
| Estilo listo para elegir en un vídeo | `estilos/personaje-narrador/` |

## Probarlo en 3 comandos

```bash
cd modulos/personaje-3d/muneco/demo && npx hyperframes render --quality draft --output renders/demo.mp4   # bocas sintéticas
bash scripts/personaje/instalar-rhubarb.sh                                                         # desde la raíz, una vez (≈ 87 MB)
node modulos/personaje-3d/muneco/preparar-demo.mjs --audio mi-voz.wav --guion mi-guion.txt         # el demo habla con tu voz
```

Después del tercero, vuelve a renderizar el demo. `--quitar` lo deja como venía. La voz que uses queda fuera de git.

## Reglas

- La boca se saca siempre sobre la voz FINAL (después de cualquier cambio de tono o velocidad).
- Ningún personaje debajo de la interfaz de la plataforma: narrador incluido (`modulos/zonas-seguras/`).
- Una voz clonada solo con perfil declarado y autorizado (`modulos/voz/`).
