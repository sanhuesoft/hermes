'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReaderSettings, ReaderTheme, FontFamily } from '@/types/epub';

interface ReaderStore extends ReaderSettings {
  // Acciones
  setTheme: (theme: ReaderTheme) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setMarginX: (margin: number) => void;
  toggleZenMode: () => void;
  setZenMode: (active: boolean) => void;
}

export const useReaderStore = create<ReaderStore>()(
  persist(
    (set) => ({
      // Valores por defecto
      theme: 'light',
      fontFamily: 'inter',
      fontSize: 18,
      lineHeight: 1.8,
      marginX: 10,
      isZenMode: false,

      // Acciones
      setTheme: (theme) => set({ theme }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize: Math.min(32, Math.max(12, fontSize)) }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMarginX: (marginX) => set({ marginX: Math.min(25, Math.max(0, marginX)) }),
      toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
      setZenMode: (active) => set({ isZenMode: active }),
    }),
    {
      name: 'ereader-settings',
    }
  )
);
