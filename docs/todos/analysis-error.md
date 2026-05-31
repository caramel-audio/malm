On analyzing 8 FLAC songs, around the end of that:
analysis.ts:22 Uncaught (in promise) NotSupportedError: Failed to construct 'AudioBuffer': createBuffer(2, 23950080, 48000) failed.
    at peakClamp (analysis.ts:22:14)
    at analysis.ts:49:21
    at async Promise.all (index 3)
    at async analyzeFiles (analysis.ts:47:23)
    at async HTMLButtonElement.handleAnalyze (+page.svelte:31:14)
