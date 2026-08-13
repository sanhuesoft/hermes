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
  bookLanguage: string;

  // Acciones
  setVoices: (voices: Voice[]) => void;
  setSelectedVoice: (voice: Voice) => void;
  setParagraphs: (paragraphs: string[]) => void;
  setActiveParagraphIndex: (index: number) => void;
  setStatus: (status: TtsPlaybackStatus) => void;
  setError: (error: string) => void;
  setChapterTitle: (title: string) => void;
  setBookLanguage: (lang: string) => void;
  autoSelectVoice: () => void;
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
  bookLanguage: 'es',

  setChapterTitle: (title) => set({ chapterTitle: title }),
  setBookLanguage: (lang) => set({ bookLanguage: lang }),

  autoSelectVoice: () => {
    const { voices, bookLanguage, selectedVoice } = get();
    if (voices.length === 0) return;
    
    // Extraer prefijo (e.g. 'en-us' -> 'en', 'es-cl' -> 'es')
    const langPrefix = bookLanguage.split('-')[0].toLowerCase();
    
    // Buscar primero coincidencia exacta de locale, luego por prefijo
    let match = voices.find(v => v.Locale.toLowerCase() === bookLanguage.toLowerCase());
    if (!match) {
      match = voices.find(v => v.Locale.toLowerCase().startsWith(langPrefix));
    }
    
    // Si hay un match y es diferente a la voz actual, o si no hay voz seleccionada, autoseleccionar
    if (match && (!selectedVoice || !selectedVoice.Locale.toLowerCase().startsWith(langPrefix))) {
      set({ selectedVoice: match });
    }
  },

  setVoices: (voices) => {
    set({ voices });
    get().autoSelectVoice();
  },
  
  setSelectedVoice: (voice) => set({ selectedVoice: voice }),
  setActiveParagraphIndex: (index) => set({ activeParagraphIndex: index }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ status: 'error', error }),
  
  setParagraphs: (paragraphs) => {
    const current = get().paragraphs;
    // Si el texto es idéntico, asumimos que fue un re-render de la misma vista 
    // y no reiniciamos el índice de lectura.
    if (current.length === paragraphs.length && current[0] === paragraphs[0]) {
      set({ paragraphs });
    } else {
      set({ paragraphs, activeParagraphIndex: 0 });
    }
  },

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
