'use client';

import { useEffect } from 'react';
import { useLibraryStore } from '@/stores/useLibraryStore';
import type { LibraryBook } from '@/types/epub';
import LibrarySidebar from './LibrarySidebar';
import BookCard from './BookCard';
import AddBookButton from './AddBookButton';

interface LibraryViewProps {
  onOpenBook: (book: LibraryBook) => void;
}

export default function LibraryView({ onOpenBook }: LibraryViewProps) {
  const { loadLibrary, isLoading, selectedFolderId, folders, books: allBooks } =
    useLibraryStore();

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const books = selectedFolderId === 'all' 
    ? allBooks 
    : allBooks.filter(b => b.folderId === selectedFolderId);

  const sectionTitle =
    selectedFolderId === 'all'
      ? 'Todos los libros'
      : (folders.find((f) => f.id === selectedFolderId)?.name ?? 'Colección');

  return (
    <div className="lib-layout">
      {/* Sidebar */}
      <LibrarySidebar />

      {/* Área principal */}
      <main className="lib-main" id="lib-main">
        {/* Header del área */}
        <div className="lib-main__header">
          <h1 className="lib-main__title">{sectionTitle}</h1>
          <span className="lib-main__count">
            {books.length} {books.length === 1 ? 'libro' : 'libros'}
          </span>
        </div>

        {/* Estado de carga */}
        {isLoading ? (
          <div className="lib-empty">
            <div className="lib-spinner" />
            <p className="lib-empty__text">Cargando biblioteca…</p>
          </div>
        ) : books.length === 0 ? (
          /* Empty state */
          <div className="lib-empty">
            <div className="lib-empty__icon">📚</div>
            <h2 className="lib-empty__title">
              {selectedFolderId === 'all'
                ? 'Tu biblioteca está vacía'
                : 'Esta colección está vacía'}
            </h2>
            <p className="lib-empty__text">
              {selectedFolderId === 'all'
                ? 'Añade tu primer libro EPUB con el botón +'
                : 'Mueve libros a esta carpeta desde la vista "Todos los libros"'}
            </p>
          </div>
        ) : (
          /* Grid de libros */
          <div className="lib-grid">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onOpen={onOpenBook} />
            ))}
          </div>
        )}

        {/* FAB para añadir libros */}
        <AddBookButton />
      </main>
    </div>
  );
}
