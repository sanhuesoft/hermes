'use client';

import { useState, useRef, useEffect } from 'react';
import type { LibraryBook, LibraryFolder } from '@/types/epub';
import { useLibraryStore } from '@/stores/useLibraryStore';

interface BookCardProps {
  book: LibraryBook;
  onOpen: (book: LibraryBook) => void;
}

/** Genera un color de fondo determinístico a partir de un string */
function colorFromTitle(title: string): string {
  const colors = [
    'hsl(246, 60%, 55%)',
    'hsl(200, 65%, 45%)',
    'hsl(160, 55%, 40%)',
    'hsl(340, 65%, 50%)',
    'hsl(30,  70%, 50%)',
    'hsl(275, 55%, 50%)',
    'hsl(15,  70%, 48%)',
    'hsl(180, 55%, 38%)',
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Formatea una fecha relativa simple */
function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca abierto';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hace un momento';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return new Date(dateStr).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
  });
}

/** Convierte ArrayBuffer a blob URL — se llama al montar el componente */
function bufferToObjectURL(buffer: ArrayBuffer | null | undefined): string | null {
  if (!buffer || buffer.byteLength === 0) return null;
  const blob = new Blob([buffer]);
  return URL.createObjectURL(blob);
}


export default function BookCard({ book, onOpen }: BookCardProps) {
  const { folders, moveBook, removeBook, updateCover } = useLibraryStore();

  // ---------- Cover URL (regenerada desde coverData en cada montaje) ----------
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    // Usar coverData (bytes persistidos) para generar la blob URL
    const url = bufferToObjectURL(book.coverData);
    setCoverUrl(url);
    return () => {
      // Limpiar la blob URL al desmontar para evitar memory leaks
      if (url) URL.revokeObjectURL(url);
    };
  }, [book.coverData]);

  // ---------- Menú de opciones ----------
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowMovePanel(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  const handleMove = async (folderId: string | null) => {
    await moveBook(book.id, folderId);
    setMenuOpen(false);
    setShowMovePanel(false);
  };

  const handleDelete = async () => {
    if (confirm(`¿Eliminar "${book.meta.title}" de la biblioteca?`)) {
      if (coverUrl) URL.revokeObjectURL(coverUrl);
      await removeBook(book.id);
    }
    setMenuOpen(false);
  };

  // ---------- Portada personalizada ----------

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    if (!imgFile.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido.');
      return;
    }
    const newCoverData = await imgFile.arrayBuffer();
    await updateCover(book.id, newCoverData);
    // Actualizar URL local inmediatamente
    if (coverUrl) URL.revokeObjectURL(coverUrl);
    const newUrl = bufferToObjectURL(newCoverData);
    setCoverUrl(newUrl);
    setMenuOpen(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const bgColor = colorFromTitle(book.meta.title);
  const currentFolder = folders.find((f: LibraryFolder) => f.id === book.folderId);

  return (
    <article className="book-card" id={`book-card-${book.id}`}>
      {/* Portada */}
      <div
        className="book-card__cover"
        style={!coverUrl ? { background: bgColor } : undefined}
        onClick={() => onOpen(book)}
        role="button"
        tabIndex={0}
        aria-label={`Abrir ${book.meta.title}`}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(book)}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`Portada de ${book.meta.title}`}
            className="book-card__cover-img"
          />
        ) : (
          <div className="book-card__cover-placeholder">
            <span className="book-card__cover-icon">📖</span>
            <span className="book-card__cover-initials">
              {book.meta.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Overlay al hover */}
        <div className="book-card__cover-overlay">
          <span className="book-card__open-label">Abrir</span>
        </div>
      </div>

      {/* Información */}
      <div className="book-card__info">
        <h3 className="book-card__title" title={book.meta.title}>
          {book.meta.title}
        </h3>
        <p className="book-card__author" title={book.meta.author}>
          {book.meta.author || 'Autor desconocido'}
        </p>
        <div className="book-card__meta-row">
          {currentFolder && (
            <span className="book-card__folder-badge">
              📁 {currentFolder.name}
            </span>
          )}
          <span className="book-card__time">
            {relativeTime(book.lastOpenedAt)}
          </span>
        </div>
      </div>

      {/* Menú de opciones ⋮ */}
      <div className="book-card__menu-wrapper" ref={menuRef}>
        <button
          className="book-card__menu-btn"
          aria-label="Opciones del libro"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
            setShowMovePanel(false);
          }}
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="book-card__dropdown">
            {!showMovePanel ? (
              <>
                <button
                  className="book-card__dropdown-item"
                  onClick={() => onOpen(book)}
                >
                  📖 Abrir
                </button>
                <button
                  className="book-card__dropdown-item"
                  onClick={() => coverInputRef.current?.click()}
                >
                  🖼️ Cambiar portada
                </button>
                <button
                  className="book-card__dropdown-item"
                  onClick={() => setShowMovePanel(true)}
                >
                  📂 Mover a carpeta
                </button>
                <div className="book-card__dropdown-divider" />
                <button
                  className="book-card__dropdown-item book-card__dropdown-item--danger"
                  onClick={handleDelete}
                >
                  🗑️ Eliminar
                </button>
              </>
            ) : (
              <>
                <button
                  className="book-card__dropdown-item book-card__dropdown-item--back"
                  onClick={() => setShowMovePanel(false)}
                >
                  ← Volver
                </button>
                <div className="book-card__dropdown-divider" />
                <button
                  className={`book-card__dropdown-item ${book.folderId === null ? 'book-card__dropdown-item--active' : ''}`}
                  onClick={() => handleMove(null)}
                >
                  🏠 Sin carpeta
                </button>
                {folders.map((f: LibraryFolder) => (
                  <button
                    key={f.id}
                    className={`book-card__dropdown-item ${book.folderId === f.id ? 'book-card__dropdown-item--active' : ''}`}
                    onClick={() => handleMove(f.id)}
                  >
                    📁 {f.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Input oculto para cambiar portada */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCoverUpload}
      />
    </article>
  );
}
