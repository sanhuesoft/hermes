// ============================================================
// Tipos principales para el motor EPUB
// ============================================================

// ============================================================
// Biblioteca de libros
// ============================================================

export interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
}

export interface LibraryBook {
  id: string;
  folderId: string | null; // null = sin carpeta
  fileName: string;        // nombre original del archivo .epub
  fileData: ArrayBuffer;   // contenido raw del EPUB
  coverData: ArrayBuffer | null; // bytes de la imagen de portada (persiste en IDB)
  meta: EpubMeta;
  addedAt: string;
  lastOpenedAt: string | null;
  lastCfi: string | null;  // posición exacta de lectura (epubcfi) para restaurar progreso
  highlights: Highlight[];
}


export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface EpubMeta {
  title: string;
  author: string;
  identifier: string;
  language: string;
  publisher?: string;
  cover?: string; // blob URL efímera (generada en runtime desde coverData, NO persiste)
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
