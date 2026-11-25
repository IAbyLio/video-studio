<!-- Reference from the HyperFrames skill `website-to-hyperframes` (HeyGen, Apache-2.0), kept in English. Modified for this repo: paths, tools and the brand file name (DESIGN-sitio.md). See LICENCIAS.md. -->
# Step 5: Generate VO + Map Timing

## Audition voices

Never use the first voice you find. Audition 2-3 voices with the first sentence of SCRIPT.md:

- **Kokoro** (try first - free, no API key) - `npx hyperframes tts SCRIPT.md --voice af_nova --output narration.wav`. Runs locally on CPU. Requires Python 3.10+ (macOS system Python 3.9 won't work - if it fails with an onnxruntime error, move to the next option).
- **The person's own voice clone** (ElevenLabs, paid, ask first with the price on screen) - module `modulos/voz/` of this repo (`node scripts/voz.mjs --dry-run --perfil <name>` first). Does not return timestamps - transcribe separately after.
- **A recording by the person** - often the most natural option; clean it with `modulos/editar-lo-que-grabas/` if needed.

Pick the voice that sounds most natural and conversational. Listen for pacing - does it breathe between sentences? Does it sound like a person or a robot?

## Generate full narration

Generate the full script as `narration.wav` (or `.mp3`) in the project directory.

## Transcribe for word-level timestamps

```bash
npx hyperframes transcribe narration.wav --model small --language es --json   # for Spanish; *.en models only work for English
```

Produces `transcript.json` with `[{ text, start, end }]` for every word. These timestamps are the source of truth for all beat durations.

## Map timestamps to beats

Go through STORYBOARD.md beat by beat. For each beat:

1. Find the first word of that beat's VO cue in `transcript.json`
2. Find the last word of that beat's VO cue
3. Set `beat.start = firstWord.start`, `beat.end = lastWord.end`
4. Add 0.3-0.5s padding at the end for visual breathing room

Update STORYBOARD.md with real durations. Replace estimated times (e.g., "0:00-0:05") with actual timestamps (e.g., "0.00-3.21s").

Beat boundaries land on word onsets - hard cuts to the VO.

## Update index.html

Update each scene slot's `data-start` and `data-duration` to match the real beat timings from the transcript. Also update the total composition duration and audio element duration.
