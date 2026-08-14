'use client';

import { create } from 'zustand';
import type { LibraryBook, LibraryFolder, EpubMeta, Highlight, Bookmark } from '@/types/epub';
import {
  getBooks,
  getBook,
  saveBook,
  deleteBook as dbDeleteBook,
  getFolders,
  saveFolder,
  deleteFolder as dbDeleteFolder,
} from '@/lib/storage/library-db';

// ----------------------------------------------------------------
// Tipos del store
// ----------------------------------------------------------------

type FolderFilter = 'all' | string; // 'all' | folder.id

interface LibraryStore {
  // Estado
  books: LibraryBook[];
  folders: LibraryFolder[];
  selectedFolderId: FolderFilter;
  isLoading: boolean;

  // Derived — libros filtrados por carpeta activa
  filteredBooks: () => LibraryBook[];

  // Acciones de inicialización
  loadLibrary: () => Promise<void>;

  // Libros
  addBook: (
    fileName: string,
    fileData: ArrayBuffer,
    meta: EpubMeta,
    coverData: ArrayBuffer | null
  ) => Promise<LibraryBook>;
  openBook: (id: string) => Promise<LibraryBook | undefined>;
  moveBook: (bookId: string, folderId: string | null) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  updateHighlights: (bookId: string, highlights: Highlight[]) => Promise<void>;
  updateBookmarks: (bookId: string, bookmarks: Bookmark[]) => Promise<void>;
  updateCover: (bookId: string, coverData: ArrayBuffer) => Promise<void>;
  updateProgress: (bookId: string, cfi: string) => Promise<void>;

  // Carpetas
  addFolder: (name: string) => Promise<LibraryFolder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;

  // UI
  setSelectedFolder: (id: FolderFilter) => void;
}

// ----------------------------------------------------------------
// Store
// ----------------------------------------------------------------

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  books: [],
  folders: [],
  selectedFolderId: 'all',
  isLoading: false,

  filteredBooks: () => {
    const { books, selectedFolderId } = get();
    if (selectedFolderId === 'all') return books;
    return books.filter((b) => b.folderId === selectedFolderId);
  },

  // ---------------------------------------------------------------
  // Inicialización
  // ---------------------------------------------------------------

  loadLibrary: async () => {
    set({ isLoading: true });
    try {
      const [books, folders] = await Promise.all([getBooks(), getFolders()]);
      // Ordenar por fecha de adición descendente
      books.sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
      folders.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      set({ books, folders });
    } finally {
      set({ isLoading: false });
    }
  },

  // ---------------------------------------------------------------
  // Libros
  // ---------------------------------------------------------------

  addBook: async (fileName, fileData, meta, coverData) => {
    // Generar citekey ID
    let namePart = 'unknown';
    if (meta.author) {
      const parts = meta.author.split(/[,\s]+/);
      if (meta.author.includes(',')) {
        namePart = parts[0];
      } else {
        namePart = parts[parts.length - 1];
      }
    }
    // normalizar acentos y remover caracteres no alfanuméricos
    namePart = namePart.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!namePart) namePart = 'book';

    let yearPart = new Date().getFullYear().toString();
    if (meta.pubdate) {
      const yearMatch = meta.pubdate.match(/\d{4}/);
      if (yearMatch) yearPart = yearMatch[0];
    }
    
    let baseCitekey = `${namePart}${yearPart}`;
    let finalId = baseCitekey;
    const books = get().books;
    
    // Deduplicación si ya existe el ID
    let counter = 0;
    while (books.some(b => b.id === finalId)) {
      counter++;
      const suffix = String.fromCharCode(96 + counter); // a, b, c...
      finalId = `${baseCitekey}${suffix}`;
    }

    const book: LibraryBook = {
      id: finalId,
      folderId: null,
      fileName,
      fileData,
      coverData,
      meta,
      addedAt: new Date().toISOString(),
      lastOpenedAt: null,
      lastCfi: null,
      highlights: [],
      bookmarks: [],
    };
    await saveBook(book);
    set((state) => ({
      books: [book, ...state.books],
    }));
    return book;
  },

  openBook: async (id) => {
    const book = await getBook(id);
    if (!book) return undefined;
    // Actualizar lastOpenedAt
    const updated: LibraryBook = {
      ...book,
      lastOpenedAt: new Date().toISOString(),
    };
    await saveBook(updated);
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? updated : b)),
    }));
    return updated;
  },

  moveBook: async (bookId, folderId) => {
    const book = get().books.find((b) => b.id === bookId);
    if (!book) return;
    const updated = { ...book, folderId };
    await saveBook(updated);
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  removeBook: async (id) => {
    await dbDeleteBook(id);
    set((state) => ({
      books: state.books.filter((b) => b.id !== id),
    }));
  },

  updateHighlights: async (bookId, highlights) => {
    const book = get().books.find((b) => b.id === bookId);
    if (!book) return;
    const updated = { ...book, highlights };
    await saveBook(updated);
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  updateBookmarks: async (bookId, bookmarks) => {
    const book = get().books.find((b) => b.id === bookId);
    if (!book) return;
    const updated = { ...book, bookmarks };
    await saveBook(updated);
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  updateProgress: async (bookId, cfi) => {
    const book = get().books.find((b) => b.id === bookId);
    if (!book) return;
    const updated = { ...book, lastCfi: cfi };
    await saveBook(updated);
    // Actualizar en memoria (sin re-render innecesario, solo IDB)
    get().books.find((b) => b.id === bookId) && set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  updateCover: async (bookId, coverData) => {
    const book = get().books.find((b) => b.id === bookId);
    if (!book) return;
    const updated = { ...book, coverData };
    await saveBook(updated);
    set((state) => ({
      books: state.books.map((b) => (b.id === bookId ? updated : b)),
    }));
  },

  // ---------------------------------------------------------------
  // Carpetas
  // ---------------------------------------------------------------

  addFolder: async (name) => {
    const folder: LibraryFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || 'Nueva carpeta',
      createdAt: new Date().toISOString(),
    };
    await saveFolder(folder);
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  renameFolder: async (id, name) => {
    const folder = get().folders.find((f) => f.id === id);
    if (!folder) return;
    const updated = { ...folder, name: name.trim() || folder.name };
    await saveFolder(updated);
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? updated : f)),
    }));
  },

  removeFolder: async (id) => {
    // Mover libros de la carpeta a "sin carpeta"
    const affected = get().books.filter((b) => b.folderId === id);
    await Promise.all(
      affected.map((b) => saveBook({ ...b, folderId: null }))
    );
    await dbDeleteFolder(id);
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      books: state.books.map((b) =>
        b.folderId === id ? { ...b, folderId: null } : b
      ),
      selectedFolderId:
        state.selectedFolderId === id ? 'all' : state.selectedFolderId,
    }));
  },

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------

  setSelectedFolder: (id) => set({ selectedFolderId: id }),
}));
