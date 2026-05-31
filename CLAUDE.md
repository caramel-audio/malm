# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is malm

malm is a browser-based audio loudness analysis tool. Users drop audio files onto the app, configure frequency band crossovers, run analysis, and view per-band EBU R128 loudness plots. All processing happens client-side using the Web Audio API — there is no backend for audio work.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run check        # svelte-kit sync + type-check
npm run lint         # prettier + eslint check
npm run format       # auto-format
npm run test:unit    # vitest (watch mode)
npm run test:e2e     # playwright tests
npm run test         # unit + e2e (CI mode)
```

Run a single vitest test file:
```bash
npx vitest run src/lib/path/to/file.spec.ts
```

## Architecture

The app is a single SvelteKit page (`src/routes/+page.svelte`) with three panels: Upload, Options, and Results.

**State** lives in three `$state` modules under `src/lib/state/`:
- `files.svelte.ts` — loaded `AudioFile` objects (id, File, decoded `AudioBuffer`, metadata)
- `options.svelte.ts` — crossover frequencies (persisted to `localStorage`) and analysis progress
- `results.svelte.ts` — `FileResult[]` produced by analysis; each file has one `BandResult` per band

**Audio pipeline** (`src/lib/audio/`):
1. `analysis.ts` — top-level orchestrator; iterates files × bands, calls filters then loudness, reports progress via callback
2. `filters.ts` — `buildBands(frequencies)` derives `FreqBand[]` from crossover list; `renderBand()` runs a 4th-order LR4 filter chain through `OfflineAudioContext`
3. `loudness.ts` — K-weighted LUFS measurement; custom O(N) sliding-window implementation for momentary/short-term curves, plus `@domchristie/needles` for EBU R128 integrated LUFS
4. `playback.svelte.ts` — stateful playback via `AudioContext`; applies the same LR4 filter chain live so band-isolated playback matches analysis

**Components** (`src/lib/components/`):
- `Upload.svelte` — file drop zone + track list with drag-to-reorder
- `Options.svelte` — crossover frequency editor + Analyze button
- `Results.svelte` — band/loudness-type selectors, "normalize to quietest" toggle, renders one `Plot` per file
- `Plot.svelte` — D3-based loudness timeline with playhead and click-to-seek

## Key conventions

- Svelte 5 throughout — use runes (`$state`, `$derived`, `$effect`), not stores.
- State modules export plain reactive objects (not classes). Components import and mutate them directly.
- `AudioBuffer` objects stay in `files.list`; analysis reads them but does not store filtered copies.
- Playback filters are applied live (same coefficients as analysis) to avoid storing one buffer per band per file.

## Svelte MCP Tools

You have access to the Svelte MCP server. Use it for all Svelte/SvelteKit work:

1. **`list-sections`** — run first to find relevant docs sections
2. **`get-documentation`** — fetch all relevant sections identified above
3. **`svelte-autofixer`** — run on every Svelte component you write; keep calling until no issues remain
4. **`playground-link`** — only on user request, and never when writing to project files

## Current goal

Get a minimal working proof of concept. Rough edges and non-extensible architecture are acceptable.
