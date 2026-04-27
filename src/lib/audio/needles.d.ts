declare module '@domchristie/needles' {
	interface LoudnessMeterOptions {
		source: AudioNode;
		modes?: Array<'momentary' | 'short-term' | 'integrated'>;
		workerUri: string;
	}

	interface LoudnessEvent {
		data: {
			mode: 'momentary' | 'short-term' | 'integrated';
			value: number;
		};
	}

	class LoudnessMeter {
		constructor(options: LoudnessMeterOptions);
		on(event: 'dataavailable', handler: (event: LoudnessEvent) => void): void;
		off(event: string, handler?: (...args: unknown[]) => void): void;
		start(): void;
		stop(): void;
		pause(): void;
		resume(): void;
		reset(): void;
	}

	export { LoudnessMeter };
}
