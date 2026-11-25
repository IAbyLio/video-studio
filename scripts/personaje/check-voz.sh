#!/usr/bin/env bash
# check-voz.sh <audio...> — QA sin escuchar de cada tramo de voz: duración, volumen medio/pico, silencios largos y
# transcripción con whisper large-v3 (el medium se salta frases y da falsos "falta texto"). Pasar los TRAMOS, no el
# audio entero: whisper sobre el audio completo también se salta frases.
# Comprobar a ojo: que no se lea ninguna etiqueta [audio tag] y que no falte ni sobre texto.
# Variables: WHISPER_MODEL (default ~/.cache/hyperframes/whisper/models/ggml-large-v3.bin), WHISPER_LANG (default es).
set -euo pipefail
MODEL="${WHISPER_MODEL:-$HOME/.cache/hyperframes/whisper/models/ggml-large-v3.bin}"
LANG_W="${WHISPER_LANG:-es}"
[[ $# -gt 0 ]] || { echo "uso: check-voz.sh <audio...>" >&2; exit 1; }
command -v whisper-cli >/dev/null || { echo "falta whisper-cli (brew install whisper-cpp)" >&2; exit 1; }
[[ -f "$MODEL" ]] || { echo "falta el modelo whisper: $MODEL" >&2; exit 1; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
for f in "$@"; do
  b="$(basename "${f%.*}")"; w="$tmp/$b.wav"
  ffmpeg -v error -y -i "$f" -ac 1 -ar 16000 -c:a pcm_s16le "$w"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  v=$(ffmpeg -hide_banner -i "$f" -af volumedetect -f null - 2>&1 | grep -E 'mean_volume|max_volume' | sed 's/.*\] //' | tr '\n' ' ')
  s=$(ffmpeg -hide_banner -i "$f" -af silencedetect=noise=-38dB:d=0.6 -f null - 2>&1 | grep -E 'silence_(start|end)' | sed 's/.*\] //' | tr '\n' ' ' || true)
  t=$(whisper-cli -m "$MODEL" -l "$LANG_W" -nt -np "$w" 2>/dev/null | tr '\n' ' ')
  echo "== $b  dur=$d  $v"; echo "   sil: ${s:-ninguno}"; echo "   txt: $t"
done
