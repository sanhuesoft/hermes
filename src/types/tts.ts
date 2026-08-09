// ============================================================
// Tipos para el motor TTS (msedge-tts)
// ============================================================

export interface Voice {
  ShortName: string;       // ej. "es-CL-CatalinaNeural"
  FriendlyName: string;   // ej. "Microsoft Catalina Online (Natural) - Spanish (Chile)"
  Gender: 'Female' | 'Male';
  Locale: string;          // ej. "es-CL"
}

export type TtsPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface TtsPlaybackState {
  status: TtsPlaybackStatus;
  activeParagraphIndex: number;
  selectedVoice: Voice | null;
  voices: Voice[];
  error?: string;
}

// Payload para el endpoint /api/tts/synthesize
export interface SynthesizeRequest {
  text: string;
  voiceId: string;
}
