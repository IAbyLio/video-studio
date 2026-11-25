#!/usr/bin/env bash
# preparar.sh — arma el VÍDEO BASE del ejemplo (ejemplo/assets/base.mp4) a partir de un clip:
#   arranque en tiempo real + cámara lenta hasta la tensión  →  fotograma congelado repetido  →  desenlace.
# Un solo vídeo con toda la pista de imagen: poner un PNG congelado + un <video> da un salto de niveles visible
# en cada relevo, así que el congelado se hace con ffmpeg (tpad clona el último fotograma).
#
# Uso: bash estilos/gancho-ia/placeholder/preparar.sh [clip.mp4] [segundo-de-congelado] [segundos-congelado]
#   Sin clip, renderiza primero el placeholder de esta carpeta (torre de bloques hecha por código).
#   Con tu clip real generado por IA: mide el segundo de congelado FOTOGRAMA A FOTOGRAMA sobre ese clip
#   (hoja de contacto: ffmpeg -i clip.mp4 -vf "fps=10,scale=216:-1,tile=8x4" hoja.png) y elige el último
#   fotograma donde se entiende lo que va a pasar, no el último antes del impacto.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
CLIP="${1:-}"
CONGELA="${2:-2.6}"
HOLD="${3:-2.0}"
SALIDA="${AQUI}/../ejemplo/assets/base.mp4"

if [[ -z "$CLIP" ]]; then
  (cd "$AQUI" && DO_NOT_TRACK=1 npx hyperframes render --quality draft --output renders/clip.mp4)
  CLIP="${AQUI}/renders/clip.mp4"
fi

# Look de móvil: se baja a 540 de ancho y se vuelve a subir (blando como un 480p) + grano fino determinista.
ffmpeg -y -v error -i "$CLIP" -filter_complex \
  "[0:v]fps=30,scale=540:-2,scale=1080:1920,noise=alls=4:allf=t,format=yuv420p,split=2[a0][b0];\
   [a0]trim=0:${CONGELA},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${HOLD}[a];\
   [b0]trim=start=${CONGELA},setpts=PTS-STARTPTS[b];\
   [a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -c:v libx264 -preset medium -crf 28 -movflags +faststart -an "$SALIDA"
echo "vídeo base: $SALIDA ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SALIDA") s)"
