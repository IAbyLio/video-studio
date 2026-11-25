# Guiones con análisis de viralidad

Antes de grabar o generar voz, el guion pasa por la skill `.claude/skills/analisis-viralidad/` (Claude Code la carga sola; con otro agente, que lea su `SKILL.md`):

1. **Diagnóstico** de tu idea o guion: ¿le interesa a mucha gente? ¿lo entiende alguien sin contexto? ¿tiene gancho?
2. **Reescritura** con la estructura de 8 piezas (gancho → intro → cuerpo → bucle → cuerpo → bucle → cuerpo → llamada a la acción) y un gancho del catálogo de 30.
3. **Crítico:** un segundo agente que no escribió el guion lo puntúa de 0 a 10 en 6 dimensiones. Si no llega a 8, se rehace (máximo 3 rondas). Sin nota ≥ 8 no se genera voz.
4. **Entregables:** `guion-audio.txt` (solo lo que se dice) y `GUION-VIDEO.md` (qué se ve en cada frase), más la hoja de hechos.

Regla de honestidad: tu vídeo solo afirma lo que es verdad el día que se publica (cada cifra y cada afirmación sobre lo que haces, con su fuente en la hoja de hechos). Se copia el mecanismo de los vídeos que te gustan, nunca sus frases, cifras ni personajes.

Pedidos que la activan: "analiza esta idea", "¿esto puede funcionar?", "dale un mejor gancho", "reescribe este guion", "critica este guion".
