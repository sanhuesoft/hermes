'use client';

import { create } from 'zustand';
import type { Voice, TtsPlaybackStatus } from '@/types/tts';

interface TtsStore {
  status: TtsPlaybackStatus;
  activeParagraphIndex: number;
  selectedVoice: Voice | null;
  voices: Voice[];
  paragraphs: string[];
  error?: string;
  chapterTitle: string;

  // Acciones
  setVoices: (voices: Voice[]) => void;
  setSelectedVoice: (voice: Voice) => void;
  setParagraphs: (paragraphs: string[]) => void;
  setActiveParagraphIndex: (index: number) => void;
  setStatus: (status: TtsPlaybackStatus) => void;
  setError: (error: string) => void;
  setChapterTitle: (title: string) => void;
  nextParagraph: () => void;
  prevParagraph: () => void;
  stop: () => void;
}

export const useTtsStore = create<TtsStore>()((set, get) => ({
  status: 'idle',
  activeParagraphIndex: 0,
  selectedVoice: null,
  voices: [],
  paragraphs: [],
  chapterTitle: '',

  setChapterTitle: (title) => set({ chapterTitle: title }),

  setVoices: (voices) => set({ voices }),
  setSelectedVoice: (voice) => set({ selectedVoice: voice }),
  setParagraphs: (paragraphs) => set({ paragraphs, activeParagraphIndex: 0 }),
  setActiveParagraphIndex: (index) => set({ activeParagraphIndex: index }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ status: 'error', error }),

  nextParagraph: () => {
    const { activeParagraphIndex, paragraphs } = get();
    if (activeParagraphIndex < paragraphs.length - 1) {
      set({ activeParagraphIndex: activeParagraphIndex + 1 });
    } else {
      set({ status: 'idle' });
    }
  },

  prevParagraph: () => {
    const { activeParagraphIndex } = get();
    if (activeParagraphIndex > 0) {
      set({ activeParagraphIndex: activeParagraphIndex - 1 });
    }
  },

  stop: () => set({ status: 'idle', activeParagraphIndex: 0 }),
}));
