# Render directo de una composición larga

**Síntoma:** al renderizar la raíz (`index.html`) que incrusta `compositions/completo.html` con `<template data-composition-src>`, el MP4 sale con todos los fotogramas del color de fondo. En el registro aparecen errores del tipo "Cannot read properties of null (reading 'appendChild')" y "Sub-composition timelines not registered after 45000ms".

**Causa:** al expandir la sub-composición durante el render, su script corre antes de que su DOM esté en el documento. Busca un contenedor (por ejemplo, el de los captions), recibe `null`, falla al usarlo y nunca llega a registrar `window.__timelines["completo"]`. El render espera, se rinde y captura el estado inicial. La vista previa de la composición sola no tiene el problema porque carga su HTML como página principal.

**Solución (siempre):**
```bash
npx hyperframes render --quality draft --composition compositions/completo.html --output renders/completo-borrador.mp4
```
`--composition` renderiza ese archivo como si fuera la raíz.

**Lo que no arregla nada:** esperar con `setTimeout` o sondeos al contenedor (el render ya dejó de esperar), silenciar el error y confiar en que registre igual.

**Si de verdad hay que unir varias composiciones por la raíz:**
1. Cada script tolera elementos que todavía no existen (comprueba `null` antes de usar cualquier nodo).
2. Si necesita esperar a un nodo, lo hace con un presupuesto muy por debajo de 45 s.
3. Registra su timeline **siempre**, aunque falte algún elemento.
4. Anótalo en el `BRIEF.md` del proyecto.
