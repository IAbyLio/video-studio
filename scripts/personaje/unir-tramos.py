#!/usr/bin/env python3
"""unir-tramos.py — une tramos de voz (uno por párrafo del guion) en una sola pista PCM con control fino del ritmo.

Por tramo: recorte de silencios de borde (umbral -46 dBFS, colchón 30 ms), micro-fades de 8 ms y pausa elegida
entre tramos. Escribe la pista WAV (48 kHz mono) + MP3 y un JSON de segmentos (inicio/fin de cada párrafo, texto
sin etiquetas y las [etiquetas] que llevaba) — sirve para colgar la pista de expresiones del personaje de cada frase.

Uso:
  python3 -I scripts/personaje/unir-tramos.py --tramos dir/tramos --guion guion-audio.txt --out dir/voz-completa
      [--pausas 0.32,0.38,0.40] [--pausa 0.35] [--entrada 0.10] [--cola 0.15] [--patron 'tramo-*.mp3']

Los tramos se ordenan por nombre (tramo-01, tramo-02...; es lo que deja scripts/voz.mjs). --pausas da una pausa por
junta (si faltan, se usa --pausa). Para re-encajar un tramo regenerado sin mover los tiempos de los siguientes:
calcular el hueco que dejaba el viejo (pausa antes + duración + pausa después) y repartir el sobrante entre las dos
pausas (mínimo 0,2 s cada una) — ver references/patterns/personaje-narrador.md.
"""
import argparse, array, glob, json, os, re, subprocess, wave

SR = 48000


def load(f):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return array.array("h", raw)


def trim(x, thr_db=-46, pad=0.03):
    win = int(SR * 0.01); n = len(x) // win; thr = (32768 * 10 ** (thr_db / 20)) ** 2
    on = [k for k in range(n) if sum(v * v for v in x[k * win:(k + 1) * win]) / win > thr]
    if not on:
        return x
    a = max(0, on[0] * win - int(pad * SR)); b = min(len(x), (on[-1] + 1) * win + int(pad * SR))
    return x[a:b]


def fade(x, ms=8):
    n = min(int(SR * ms / 1000), len(x) // 2)
    for k in range(n):
        x[k] = int(x[k] * k / n); x[-1 - k] = int(x[-1 - k] * k / n)
    return x


def silencio(sec):
    return array.array("h", bytes(2 * int(sec * SR)))


def wwav(p, x):
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(x.tobytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tramos", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--guion"); ap.add_argument("--patron", default="tramo-*.mp3")
    ap.add_argument("--pausas", default=""); ap.add_argument("--pausa", type=float, default=0.35)
    ap.add_argument("--entrada", type=float, default=0.10); ap.add_argument("--cola", type=float, default=0.15)
    a = ap.parse_args()
    files = sorted(glob.glob(os.path.join(a.tramos, a.patron)))
    if not files:
        raise SystemExit(f"no hay tramos {a.patron} en {a.tramos}")
    paras = []
    if a.guion:
        paras = [p.strip() for p in open(a.guion, encoding="utf-8").read().split("\n\n") if p.strip()]
        if len(paras) != len(files):
            print(f"AVISO: {len(paras)} párrafos en el guion y {len(files)} tramos")
    pausas = [float(v) for v in a.pausas.split(",") if v.strip()]
    out = [silencio(a.entrada)]; t = a.entrada; segs = []
    for i, f in enumerate(files):
        x = fade(trim(load(f))); d = len(x) / SR
        txt = paras[i] if i < len(paras) else ""
        segs.append({"n": i + 1, "archivo": os.path.basename(f), "inicio": round(t, 3), "fin": round(t + d, 3), "dur": round(d, 3),
                     "etiquetas": re.findall(r"\[([^\]]+)\]", txt), "texto": re.sub(r"\s+", " ", re.sub(r"\[[^\]]+\]", "", txt)).strip()})
        out.append(x); t += d
        if i < len(files) - 1:
            g = pausas[i] if i < len(pausas) else a.pausa
            out.append(silencio(g)); t += g
    out.append(silencio(a.cola))
    full = array.array("h")
    for o in out:
        full.extend(o)
    wwav(a.out + ".wav", full)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.out + ".wav", "-c:a", "libmp3lame", "-b:a", "192k", a.out + ".mp3"], check=True)
    json.dump({"audio": os.path.basename(a.out) + ".wav", "sampleRate": SR, "duracion": round(len(full) / SR, 3), "segmentos": segs},
              open(a.out + "-segmentos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("duración", round(len(full) / SR, 3), "s ·", len(segs), "tramos →", a.out + ".wav/.mp3 + -segmentos.json")


if __name__ == "__main__":
    main()
