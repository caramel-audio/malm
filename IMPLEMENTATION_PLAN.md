# Analysis Implementation Plan

Seven iterative steps to implement the full analysis pipeline. Each step is self-contained and verifiable.

## Status

- [x] Step 1 — `buildBands()` — pure frequency → FreqBand[] derivation
- [ ] Step 2 — `renderBand()` — OfflineAudioContext + BiquadFilter cascade (24 dB/oct)
- [ ] Step 3 — `measureLoudness()` — @domchristie/needles integration
- [ ] Step 4 — `analyzeFiles()` orchestration + results state wiring
- [ ] Step 5 — Basic Results display (table of LUFS values, no D3)
- [ ] Step 6 — D3 Plot (waveform + loudness curve + hover tooltip)
- [ ] Step 7 — Playback on click (play filtered band audio, mutual exclusion)

## Step Details

### Step 1 — `buildBands()` ✅
File: `src/lib/audio/filters.ts`
- Pure function, no browser APIs
- Input: sorted crossover frequencies e.g. `[80, 200, 800, 2000, 8000]`
- Output: FreqBand[] — one band per interval between freqs, plus a leading 0→first, trailing last→Nyquist, and a "full" band
- Example: `[80, 200]` → `[{0–80 Hz}, {80–200 Hz}, {200+ Hz}, {full}]`

### Step 2 — `renderBand()`
File: `src/lib/audio/filters.ts`
- Use `OfflineAudioContext` to render filtered audio offline
- For lowpass edge: cascade 2× BiquadFilterNode type="lowpass" at highHz (each 12 dB/oct → 24 dB/oct total)
- For highpass edge: cascade 2× BiquadFilterNode type="highpass" at lowHz
- Full band: return source buffer unchanged
- Returns a new AudioBuffer of same length/sampleRate

### Step 3 — `measureLoudness()`
File: `src/lib/audio/loudness.ts`
- Install: `npm install @domchristie/needles`
- Feed AudioBuffer samples into needles Meter frame by frame
- Collect momentary LUFS every 100 ms → `[timeMs, lufs][]`
- Collect short-term LUFS every 400 ms → `[timeMs, lufs][]`
- Collect true peak per 100 ms window → `[timeMs, dbfs][]`
- Return `{ momentary, shortTerm, peak }`

### Step 4 — `analyzeFiles()` + results state
Files: `src/lib/audio/analysis.ts`, `src/lib/state/results.svelte.ts`, `src/lib/components/Options.svelte`
- Add `setResults(data: FileResult[])` and `clearResults()` to results state
- Implement `analyzeFiles()`: buildBands → for each file × band: renderBand → measureLoudness
- Store filtered AudioBuffers back onto `AudioFile.bandBuffers[band.label]`
- Call `onProgress()` after each file×band unit
- Wire Options "Process" button to call analyzeFiles, set isAnalyzing, update progress

### Step 5 — Basic Results display
File: `src/lib/components/Results.svelte`
- No D3 yet — just a table/list
- For each file: show filename, then for each band: label + integrated LUFS (last short-term value as proxy)
- Proves the full data pipeline works end-to-end

### Step 6 — D3 Plot
File: `src/lib/components/Plot.svelte`
- Draw waveform from raw AudioBuffer samples using D3
- Overlay momentary LUFS curve for the selected band
- Band selection dropdown + momentary/short-term toggle in Results.svelte
- Hover tooltip showing time (mm:ss), peak (dBFS), momentary LUFS, short-term LUFS

### Step 7 — Playback on click
Files: `src/lib/components/Plot.svelte`, `src/lib/state/results.svelte.ts`
- Click on plot → play `AudioFile.bandBuffers[selectedBand]` from clicked time offset via AudioContext
- If full band selected, play original `AudioFile.buffer`
- Global playback state: only one file plays at a time; clicking another stops the current one
