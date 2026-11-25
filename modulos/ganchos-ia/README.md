# Ganchos generados con IA de vídeo

Para cuando una **escena física** que obliga a quedarse (algo a punto de caerse, golpearse, derramarse) funciona mejor que tu cara o que los gráficos desde el segundo cero. La IA de vídeo hace lo caro de construir (un plano realista con tensión); el código hace todo lo que tiene que ser exacto (congelado, texto, voz, sonido). El estilo listo para clonar está en `estilos/gancho-ia/` (con un clip de relleno hecho por código).

**De pago:** cada imagen y cada vídeo generado gasta créditos de tu cuenta (Higgsfield, Seedance a través de la plataforma que uses, etc.). **Gate de coste:** antes de cada generación, la IA te dice qué va a generar, en qué plataforma y que mires el precio en pantalla; sin tu OK no se genera nada. Las tarifas cambian: leelas siempre en la plataforma, el día que generas.

## El método (en orden, con tus OK en las marcas)
1. **Idea** [OK]: una escena, un plano continuo, tres tiempos: arranque en tiempo real → cámara lenta acercándose → justo antes del desenlace. La escena tiene que ser una metáfora de tu mensaje que se pueda decir en una frase.
2. **Fotograma inicial** [OK y coste]: primero la imagen (iterar imagen es barato; vídeo no). 9:16, "parece un fotograma de móvil". Si sale una persona, que no sea nadie reconocible salvo que sea tu decisión.
3. **Vídeo** [OK y coste]: a partir del fotograma inicial, 8-10 s, con el desenlace incluido en el mismo clip (es el remate). Resolución baja de móvil (480p) si la estética es amateur: más barato y creíble. Mejor con el audio nativo (ambiente, golpe). Prompt por tramos con segundos ("0-3 s… 3-8 s…") y una lista de negativos. No gastes más de 2-3 intentos en relaciones espaciales finas.
4. **Punto de congelado**: medirlo fotograma a fotograma sobre el clip definitivo. El último fotograma donde **se entiende lo que va a pasar**. Anota también el del primer contacto (ahí cae el golpe del remate).
5. **Guion** (`analisis-viralidad`): el congelado es el bucle abierto largo; el desenlace va **después** de la llamada a la acción, para quien se queda. ≤ 150 palabras de voz.
6. **Composición**: un solo vídeo base con ffmpeg (arranque + fotograma congelado repetido + desenlace): PNG + vídeo da saltos de nivel visibles. Encima: anotaciones, captions y, si el objeto narra, su cara por código (`scripts/personaje/cara.js`, `Cara.mount`) con lip-sync (`scripts/personaje/build-mouth-data.mjs`). Cámara: acercamiento muy lento y 2-3 reencuadres; una imagen quieta de un minuto se muere sin eso.
7. **Sonido**: audio nativo del arranque (suele venir bajo: subirlo), corte seco al congelar con un solo clic, voz, golpe del desenlace alineado a su fotograma y reforzado con `impacto-suave`.
8. **QA**: zonas seguras, fotogramas mirados, y tu escucha.

## Si el objeto habla
El objeto en tensión puede ser el narrador: tiene un motivo propio para hablar (no quiere caerse). Su voz es una identidad nueva: va declarada en `modulos/voz/perfiles.json` con su nota (puede ser una voz diseñada en ElevenLabs a partir de una descripción).

## Claves de cuentas
Si quieres que la IA consulte saldos o lance generaciones por API, pon la clave de tu plataforma en `.env` (`HIGGSFIELD_API_KEY`, `FAL_KEY` o `REPLICATE_API_TOKEN`) y díselo. `node scripts/comprobar-cuentas.mjs` revisa el formato sin gastar. Lo más simple y seguro: generar el clip en la web de la plataforma y pasarle el archivo a la IA.
