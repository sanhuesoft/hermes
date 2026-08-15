'use client';

import { create } from 'zustand';
import type { LibraryBook, LibraryFolder, EpubMeta, Highlight, Bookmark } from '@/types/epub';
import { createBaseCitekey, createUniqueCitekey } from '@/lib/storage/citekey';

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
    coverData: ArrayBuffer | null,
    coverMimeType?: string | null
  ) => Promise<LibraryBook>;
  openBook: (id: string) => Promise<LibraryBook | undefined>;
  moveBook: (bookId: string, folderId: string | null) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  updateHighlights: (bookId: string, highlights: Highlight[]) => Promise<void>;
  updateBookmarks: (bookId: string, bookmarks: Bookmark[]) => Promise<void>;
  updateCover: (bookId: string, coverData: ArrayBuffer, coverMimeType?: string) => Promise<void>;
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
      const [booksRes, foldersRes] = await Promise.all([
        fetch('/api/books'),
        fetch('/api/folders'),
      ]);

      if (!booksRes.ok || !foldersRes.ok) {
        throw new Error('Error al conectar con la base de datos del servidor');
      }

      const books: LibraryBook[] = await booksRes.json();
      const folders: LibraryFolder[] = await foldersRes.json();

      set({ books, folders });
    } catch (err) {
      console.error('Error al cargar biblioteca:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ---------------------------------------------------------------
  // Libros
  // ---------------------------------------------------------------

  addBook: async (fileName, fileData, meta, coverData, coverMimeType) => {
    const baseCitekey = createBaseCitekey(meta);
    if (!baseCitekey) {
      throw new Error('El autor y el año de publicación son necesarios para crear el citekey.');
    }
    const finalId = createUniqueCitekey(baseCitekey, get().books.map((book) => book.id));

    const formData = new FormData();
    formData.append('id', finalId);
    formData.append(
      'file',
      new Blob([fileData], { type: 'application/epub+zip' }),
      fileName
    );
    formData.append('fileName', fileName);
    formData.append('title', meta.title);
    formData.append('author', meta.author);
    formData.append('identifier', meta.identifier || finalId);
    formData.append('language', meta.language || 'es');
    if (meta.publisher) formData.append('publisher', meta.publisher);
    if (meta.pubdate) formData.append('pubdate', meta.pubdate);

    if (coverData && coverData.byteLength > 0) {
      formData.append(
        'cover',
        new Blob([coverData], { type: coverMimeType || 'image/jpeg' }),
        'cover.jpg'
      );
    }

    const res = await fetch('/api/books', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al subir libro' }));
      throw new Error(err.error || 'Error al guardar el libro en el servidor');
    }

    const created: LibraryBook = await res.json();
    set((state) => ({
      books: [created, ...state.books],
    }));
    return created;
  },

  openBook: async (id) => {
    try {
      const [bookRes, fileRes] = await Promise.all([
        fetch(`/api/books/${encodeURIComponent(id)}`),
        fetch(`/api/books/${encodeURIComponent(id)}/file`),
      ]);

      if (!bookRes.ok || !fileRes.ok) return undefined;

      const bookMeta: LibraryBook = await bookRes.json();
      const fileData = await fileRes.arrayBuffer();
      const now = new Date().toISOString();

      // Actualizar timestamp en segundo plano
      fetch(`/api/books/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastOpenedAt: now }),
      }).catch(console.error);

      const fullBook: LibraryBook = {
        ...bookMeta,
        fileData,
        lastOpenedAt: now,
      };

      set((state) => ({
        books: state.books.map((b) => (b.id === id ? { ...b, lastOpenedAt: now } : b)),
      }));

      return fullBook;
    } catch (err) {
      console.error('Error al abrir libro desde servidor:', err);
      return undefined;
    }
  },

  moveBook: async (bookId, folderId) => {
    try {
      await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });

      set((state) => ({
        books: state.books.map((b) => (b.id === bookId ? { ...b, folderId } : b)),
      }));
    } catch (err) {
      console.error('Error al mover libro:', err);
    }
  },

  removeBook: async (id) => {
    try {
      await fetch(`/api/books/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      set((state) => ({
        books: state.books.filter((b) => b.id !== id),
      }));
    } catch (err) {
      console.error('Error al eliminar libro:', err);
    }
  },

  updateHighlights: async (bookId, highlights) => {
    try {
      fetch(`/api/books/${encodeURIComponent(bookId)}/highlights`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ highlights }),
      }).catch(console.error);

      set((state) => ({
        books: state.books.map((b) => (b.id === bookId ? { ...b, highlights } : b)),
      }));
    } catch (err) {
      console.error('Error al actualizar highlights:', err);
    }
  },

  updateBookmarks: async (bookId, bookmarks) => {
    try {
      fetch(`/api/books/${encodeURIComponent(bookId)}/bookmarks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks }),
      }).catch(console.error);

      set((state) => ({
        books: state.books.map((b) => (b.id === bookId ? { ...b, bookmarks } : b)),
      }));
    } catch (err) {
      console.error('Error al actualizar marcadores:', err);
    }
  },

  updateProgress: async (bookId, cfi) => {
    try {
      fetch(`/api/books/${encodeURIComponent(bookId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastCfi: cfi }),
      }).catch(console.error);

      set((state) => ({
        books: state.books.map((b) => (b.id === bookId ? { ...b, lastCfi: cfi } : b)),
      }));
    } catch (err) {
      console.error('Error al actualizar progreso:', err);
    }
  },

  updateCover: async (bookId, coverData, coverMimeType) => {
    try {
      const formData = new FormData();
      formData.append(
        'cover',
        new Blob([coverData], { type: coverMimeType || 'image/jpeg' }),
        'cover.jpg'
      );

      const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/cover`, {
        method: 'PUT',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        set((state) => ({
          books: state.books.map((b) =>
            b.id === bookId
              ? {
                  ...b,
                  coverUrl: `${data.coverUrl}?t=${Date.now()}`,
                  coverMimeType: data.coverMimeType,
                }
              : b
          ),
        }));
      }
    } catch (err) {
      console.error('Error al actualizar portada:', err);
    }
  },

  // ---------------------------------------------------------------
  // Carpetas
  // ---------------------------------------------------------------

  addFolder: async (name) => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      throw new Error('Error al crear carpeta');
    }

    const folder: LibraryFolder = await res.json();
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  renameFolder: async (id, name) => {
    await fetch(`/api/folders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)),
    }));
  },

  removeFolder: async (id) => {
    await fetch(`/api/folders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

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
