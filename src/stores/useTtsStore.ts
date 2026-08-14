'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Voice, TtsPlaybackStatus } from '@/types/tts';

interface TtsStore {
  status: TtsPlaybackStatus;
  activeParagraphIndex: number;
  activeSentenceIndex: number;
  pendingJumpIndex: number | null;
  selectedVoice: Voice | null;
  voices: Voice[];
  paragraphs: string[];
  error?: string;
  chapterTitle: string;
  bookLanguage: string;
  playbackRate: number;

  // Acciones
  setVoices: (voices: Voice[]) => void;
  setSelectedVoice: (voice: Voice) => void;
  setParagraphs: (paragraphs: string[]) => void;
  setActiveParagraphIndex: (index: number) => void;
  setActiveSentenceIndex: (index: number) => void;
  setStatus: (status: TtsPlaybackStatus) => void;
  setError: (error: string) => void;
  setChapterTitle: (title: string) => void;
  setBookLanguage: (lang: string) => void;
  setPlaybackRate: (rate: number) => void;
  autoSelectVoice: () => void;
  nextParagraph: () => void;
  prevParagraph: () => void;
  stop: () => void;
  jumpToParagraph: (index: number) => void;
  jumpToSentence: (paragraphIndex: number, sentenceIndex: number) => void;
  clearJump: () => void;
}

export const useTtsStore = create<TtsStore>()(
  persist(
    (set, get) => ({
      status: 'idle',
      activeParagraphIndex: 0,
      activeSentenceIndex: 0,
      pendingJumpIndex: null,
      selectedVoice: null,
      voices: [],
      paragraphs: [],
      chapterTitle: '',
      bookLanguage: 'es',
      playbackRate: 1,

      setChapterTitle: (title) => set({ chapterTitle: title }),
      setBookLanguage: (lang) => set({ bookLanguage: lang }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),

      autoSelectVoice: () => {
        const { voices, bookLanguage, selectedVoice } = get();
        if (voices.length === 0) return;
        
        // Si ya hay una voz seleccionada guardada (persistida) que existe en las voces actuales, no la sobreescribimos
        if (selectedVoice && voices.find(v => v.ShortName === selectedVoice.ShortName)) {
          return;
        }
        
        const langPrefix = bookLanguage.split('-')[0].toLowerCase();
        let match = voices.find(v => v.Locale.toLowerCase() === bookLanguage.toLowerCase());
        if (!match) {
          match = voices.find(v => v.Locale.toLowerCase().startsWith(langPrefix));
        }
        
        if (match) {
          set({ selectedVoice: match });
        }
      },

      setVoices: (voices) => {
        set({ voices });
        get().autoSelectVoice();
      },
      
      setSelectedVoice: (voice) => set({ selectedVoice: voice }),
      setActiveParagraphIndex: (index) => set({ activeParagraphIndex: index, activeSentenceIndex: 0 }),
      setActiveSentenceIndex: (index) => set({ activeSentenceIndex: index }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ status: 'error', error }),
      
      setParagraphs: (paragraphs) => {
        const { status, paragraphs: current } = get();
        if (status === 'playing' || status === 'loading') {
          set({ paragraphs });
          return;
        }
        if (current.length === paragraphs.length && current[0] === paragraphs[0]) {
          set({ paragraphs });
        } else {
          set({ paragraphs, activeParagraphIndex: 0, activeSentenceIndex: 0 });
        }
      },

      nextParagraph: () => {
        const { activeParagraphIndex, paragraphs } = get();
        if (activeParagraphIndex < paragraphs.length - 1) {
          set({ activeParagraphIndex: activeParagraphIndex + 1, activeSentenceIndex: 0 });
        } else {
          set({ status: 'idle' });
        }
      },

      prevParagraph: () => {
        const { activeParagraphIndex } = get();
        if (activeParagraphIndex > 0) {
          set({ activeParagraphIndex: activeParagraphIndex - 1, activeSentenceIndex: 0 });
        }
      },

      stop: () => set({ status: 'idle', activeParagraphIndex: 0, activeSentenceIndex: 0 }),

      jumpToParagraph: (index) => {
        const { paragraphs } = get();
        if (index < 0 || index >= paragraphs.length) return;
        set({ pendingJumpIndex: index, activeParagraphIndex: index, activeSentenceIndex: 0 });
      },

      jumpToSentence: (paragraphIndex, sentenceIndex) => {
        const { paragraphs } = get();
        if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) return;
        set({ pendingJumpIndex: paragraphIndex, activeParagraphIndex: paragraphIndex, activeSentenceIndex: sentenceIndex });
      },

      clearJump: () => set({ pendingJumpIndex: null }),
    }),
    {
      name: 'reader-tts-storage',
      // Solo queremos persistir la voz seleccionada
      partialize: (state) => ({ selectedVoice: state.selectedVoice }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
