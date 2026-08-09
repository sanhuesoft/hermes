// ============================================================
// Tipos principales para el motor EPUB
// ============================================================

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface EpubMeta {
  title: string;
  author: string;
  identifier: string;
  language: string;
  publisher?: string;
  cover?: string; // URL de objeto blob
}

export interface Chapter {
  id: string;
  href: string;
  label: string;
  subitems?: Chapter[];
}

export interface Highlight {
  id: string;
  cfiRange: string;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

// ============================================================
// Archivo sidecar .epub.notes.json
// ============================================================

export interface SidecarFile {
  version: '1.0';
  bookMeta: {
    title: string;
    identifier: string;
  };
  updatedAt: string;
  highlights: Highlight[];
}

// ============================================================
// Estado del reader
// ============================================================

export type ReaderTheme = 'light' | 'dark' | 'sepia';

export type FontFamily =
  | 'inter'
  | 'merriweather'
  | 'garamond'
  | 'mono'
  | 'opendyslexic';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: FontFamily;
  fontSize: number;      // 12–32 px
  lineHeight: number;    // 1.2 | 1.5 | 1.8 | 2.0
  marginX: number;       // 0–25 (porcentaje)
  isZenMode: boolean;
}
