# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is malm

malm is a browser-based audio loudness analysis tool. Users create projects, drop audio files onto the app, configure frequency band crossovers, run analysis, and view per-band EBU R128 loudness plots. All processing happens client-side using the Web Audio API — there is no backend for audio work. Projects and audio files are persisted in the browser using OPFS and localStorage.

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

## Route structure

```
/                          → redirect to /projects
/projects                  → project hub (card grid, create/rename/delete)
/projects/[id]/setup       → Upload + Options panels + Analyze button
/projects/[id]/analysis    → Results plots
```

Layout hierarchy:

- `src/routes/+layout.svelte` — root layout (SplashScreen on first visit)
- `src/routes/projects/+layout.svelte` — renders NavBar above all project pages
- `src/routes/projects/[id]/+layout.svelte` — loads project data from OPFS/localStorage on mount, auto-saves changes, handles keyboard shortcuts

When a project already has saved results, the `[id]` layout redirects straight to `/analysis` instead of `/setup`.

## Storage

| Data                                            | Store        | Key/Path                                  |
| ----------------------------------------------- | ------------ | ----------------------------------------- |
| Project list (id, name, dates, file count/size) | localStorage | `malm_projects`                           |
| Per-project crossover options                   | localStorage | `malm_project_{id}_options`               |
| Audio file binaries                             | OPFS         | `/malm/projects/{id}/files/{fileId}`      |
| File manifest (ordered metadata)                | OPFS         | `/malm/projects/{id}/files/manifest.json` |
| Analysis results                                | OPFS         | `/malm/projects/{id}/results.json`        |

OPFS helpers live in `src/lib/storage/opfs.ts`.

## Architecture

**State** lives in `$state` modules under `src/lib/state/`:

- `project.svelte.ts` — project list + CRUD (localStorage-backed); `projects.list`, `createProject`, `deleteProject`, `renameProject`
- `files.svelte.ts` — loaded `AudioFile` objects (id, File, metadata — no PCM); writes to OPFS when `currentProjectId` is set
- `options.svelte.ts` — crossover frequencies and analysis progress; `loadOptionsForProject` / `saveOptionsForProject` use per-project localStorage keys
- `results.svelte.ts` — `FileResult[]` produced by analysis; each file has one `BandResult` per band plus an optional `waveform` (100 ms min/max "peak file" the plot draws); `isFresh` flag indicates whether results match the current file set and options (used to disable the Analyze button)

**Audio pipeline** (`src/lib/audio/`) — fully streaming; a multi-hour track is never decoded into one buffer:

1. `decode.ts` — `decodeAudioChunks(file)` async-generates small PCM chunks via mediabunny (WebCodecs), falling back to one-shot `decodeAudioData` for formats it cannot demux; `probeAudio(file)` reads duration/sample rate/channels
2. `analysis.ts` — top-level orchestrator; one decode pass per file feeds every band's meter plus the waveform accumulator, reports progress weighted by duration
3. `filters.ts` — `buildBands(frequencies)` derives `FreqBand[]` from crossover list; `buildBandCoeffs()` returns the 4th-order LR4 biquad stages
4. `loudness.ts` — push-based `LoudnessMeter` (`feed()` / `finish()`): K-weighted LUFS, custom O(N) sliding windows for momentary/short-term, custom EBU R128 gating for integrated. Filter state and the partial 100 ms step carry across `feed()` calls, so chunking never changes the result (`loudness.spec.ts` pins this). `WaveformAccumulator` collects the peak file.
5. `playback.svelte.ts` — streams through a singleton `HTMLAudioElement` → `MediaElementAudioSourceNode`; applies the same LR4 filter chain live so band-isolated playback matches analysis

**Components** (`src/lib/components/`):

- `NavBar.svelte` — top bar present on all project pages; logo, breadcrumb with project switcher dropdown, Setup/Analysis tabs, info button; two-row on mobile (breadcrumb row + tab row)
- `Upload.svelte` — file drop zone + track list with drag-to-reorder
- `Options.svelte` — crossover frequency editor
- `Results.svelte` — band/loudness-type selectors, "normalize to quietest" toggle, renders one `Plot` per file; controls are a left sidebar on desktop, two-column top bar on mobile
- `Plot.svelte` — D3-based loudness timeline with playhead and click-to-seek
- `SplashScreen.svelte` — shown automatically on first load; also triggered manually via the NavBar info button

## Key conventions

- Svelte 5 throughout — use runes (`$state`, `$derived`, `$effect`), not stores.
- State modules export plain reactive objects (not classes). Components import and mutate them directly.
- Full PCM is never held in memory. `files.list` holds `File` handles (lazy OPFS files); analysis and playback stream from them.
- Playback filters are applied live (same coefficients as analysis) to avoid storing one buffer per band per file.
- Auto-save is debounced via `setTimeout` inside `$effect` blocks in the `[id]` layout; an `isLoaded` flag gates all save effects so initial state population doesn't trigger spurious writes.

## Svelte MCP Tools

You have access to the Svelte MCP server. Use it for all Svelte/SvelteKit work:

1. **`list-sections`** — run first to find relevant docs sections
2. **`get-documentation`** — fetch all relevant sections identified above
3. **`svelte-autofixer`** — run on every Svelte component you write; keep calling until no issues remain
4. **`playground-link`** — only on user request, and never when writing to project files
