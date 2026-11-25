#!/usr/bin/env bash
# instalar-rhubarb.sh — baja Rhubarb Lip-Sync 1.14.0 (release oficial de GitHub, github.com/DanielSWolf/rhubarb-lip-sync)
# a .cache/rhubarb/ de la raíz del repo (ignorado por git) y comprueba que corre. Sin sudo y sin tocar el sistema.
# Pesa unos 87 MB comprimido. Rhubarb convierte una voz en "bocas" (visemas) para que el personaje hable sincronizado.
#
# macOS: el binario es x86_64; en Apple Silicon corre con Rosetta 2. Si no la tienes, este script te dice cómo
#        instalarla (es de Apple) y para: no la instala solo.
# Linux: usa el zip oficial de Linux (escrito con cuidado, sin probar).
# Windows: baja el zip de Windows a mano de la página de releases y pon la ruta del .exe en RHUBARB_BIN.
#
# Uso: bash scripts/personaje/instalar-rhubarb.sh [--forzar]
# Deja la ruta del binario en .cache/rhubarb/BIN (la lee build-mouth-data.mjs).
set -euo pipefail

VER="1.14.0"
case "$(uname)" in
  Darwin) PLAT="macOS" ;;
  Linux) PLAT="Linux" ;;
  *) echo "Sistema no soportado por este instalador. Baja el zip a mano de https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v${VER} y exporta RHUBARB_BIN=<ruta al binario>." >&2; exit 1 ;;
esac
ZIP="Rhubarb-Lip-Sync-${VER}-${PLAT}.zip"
URL="https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v${VER}/${ZIP}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="${RAIZ}/.cache/rhubarb"
BIN="${DIR}/Rhubarb-Lip-Sync-${VER}-${PLAT}/rhubarb"

if [[ "$PLAT" == "macOS" && "$(uname -m)" == "arm64" ]] && ! arch -x86_64 /usr/bin/true 2>/dev/null; then
  echo "Rosetta 2 no está instalada y el binario de Rhubarb para Mac es x86_64." >&2
  echo "Se instala (es de Apple, pide tu confirmación) con: softwareupdate --install-rosetta --agree-to-license" >&2
  exit 1
fi

mkdir -p "$DIR"
if [[ ! -x "$BIN" || "${1:-}" == "--forzar" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  echo "Bajando ${URL}"
  curl -fsSL --retry 2 --proto '=https' -o "${tmp}/${ZIP}" "$URL"
  echo "sha256 $(shasum -a 256 "${tmp}/${ZIP}" 2>/dev/null | cut -d' ' -f1 || sha256sum "${tmp}/${ZIP}" | cut -d' ' -f1)  ${ZIP}"
  unzip -q -o "${tmp}/${ZIP}" -d "$DIR"
  [[ "$PLAT" == "macOS" ]] && xattr -dr com.apple.quarantine "$DIR" 2>/dev/null || true
fi

[[ -x "$BIN" ]] || { echo "No se encontró el binario en ${BIN} tras descomprimir." >&2; exit 1; }
echo "$BIN" > "${DIR}/BIN"
echo "binario: ${BIN}"
"$BIN" --version
