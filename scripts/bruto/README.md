# scripts/bruto

Herramientas del módulo **editar lo que grabas**. Método, comandos y trampas: [`modulos/editar-lo-que-grabas/README.md`](../../modulos/editar-lo-que-grabas/README.md).

| Script | Hace |
|---|---|
| `editar.mjs` | Orquestador en dos fases con tu confirmación en medio |
| `analizar.mjs` | Transcribe por tramos, mide silencios y PROPONE cortes (`cortes.json` + `cortes.md`). No corta |
| `cortar.mjs` | Aplica `cortes.json` en una sola pasada. Se niega si quedan decisiones pendientes |
| `verificar.mjs` | Re-transcribe el resultado, busca clics y desincronías. Código 4 si no pasa |
| `encuadrar.mjs` | 9:16 (o 4:5 / 1:1) centrado en la cara, zooms en las juntas |
| `lib.mjs`, `medios.mjs` | Funciones puras (con tests en `scripts/__tests__/bruto.test.mjs`) y E/S con ffmpeg/whisper |
| `detectar-caras.swift` | Detector de caras con Vision (solo macOS) |
