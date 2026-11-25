# liqui-glass (vanilla): origen

`liqui-glass.js` es un port a JavaScript sin frameworks de la **técnica** del kernel de liqui-design
(github.com/leefanv/liqui-design, `packages/glass/src/LiquiGlass.tsx`, `filterRegistry.ts`, `glass.css`),
licencia MIT © 2026 Fan Li (ver `LICENSE` en esta carpeta). Commit de referencia:
`50f38714ba8e668917541f0c6f8f19f22592dc52` (2026-09-21). El port se escribió leyendo el código; no se instaló ni se
ejecutó el paquete original.

Cambios respecto del original: sin React ni tokens de tema; filtros y mapas generados de forma síncrona al cargar y
mapa precargado como `<img>` para que la refracción exista desde el primer fotograma capturado (render determinista
de Hyperframes); sin la animación de entrada del filtro.
