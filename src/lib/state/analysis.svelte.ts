export const analysis = $state({ isAnalyzing: false, progress: 0 });

export function resetAnalysis(): void {
	analysis.isAnalyzing = false;
	analysis.progress = 0;
}
