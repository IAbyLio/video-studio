#!/usr/bin/env bash
# generar.sh — fabrica el material de relleno de los ejemplos (una "persona" hecha por código) y lo copia a los
# ejemplos que lo usan. No hace falta correrlo: los archivos ya vienen en el repo. Sirve para regenerarlos.
#   persona.mp4           → con fondo de habitación (lo que sería tu grabación)
#   persona-recorte.webm  → solo la persona, fondo transparente (lo que sería tu recorte)
# Uso: bash estilos/_material/generar.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export DO_NOT_TRACK=1

cd "$AQUI/persona"
npx hyperframes lint >/dev/null
npx hyperframes render --quality standard --output "$TMP/persona.mp4" >/dev/null

# Misma escena sin fondo ni etiqueta (--con-fondo: 0) y renderizada con transparencia (VP9 con alfa).
cp -R "$AQUI/persona" "$TMP/recorte"
sed -i.bak 's/--con-fondo: 1;/--con-fondo: 0;/' "$TMP/recorte/index.html" && rm "$TMP/recorte/index.html.bak"
cd "$TMP/recorte"
npx hyperframes render --format webm --quality standard --output "$TMP/persona-recorte.webm" >/dev/null

for d in talking-head split-screen texto-detras; do
  mkdir -p "$RAIZ/estilos/$d/ejemplo/assets"
  cp "$TMP/persona.mp4" "$RAIZ/estilos/$d/ejemplo/assets/persona.mp4"
done
cp "$TMP/persona-recorte.webm" "$RAIZ/estilos/texto-detras/ejemplo/assets/persona-recorte.webm"
for d in natural premium; do mkdir -p "$RAIZ/modulos/captions/ejemplos/$d/assets"; cp "$TMP/persona.mp4" "$RAIZ/modulos/captions/ejemplos/$d/assets/persona.mp4"; done
cp "$TMP/persona-recorte.webm" "$RAIZ/modulos/captions/ejemplos/premium/assets/persona-recorte.webm"
echo "material regenerado y copiado a talking-head, split-screen y texto-detras"
