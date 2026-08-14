'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookPlus, LoaderCircle, Plus, X } from 'lucide-react';
import { useLibraryStore } from '@/stores/useLibraryStore';
import {
  createBaseCitekey,
  createUniqueCitekey,
  getPublicationYear,
} from '@/lib/storage/citekey';
import type { EpubMeta } from '@/types/epub';

interface AddBookButtonProps {
  onBookAdded?: () => void | Promise<void>;
}

interface ExtractedCover {
  data: ArrayBuffer;
  mimeType: string | null;
}

interface PendingBook {
  queueId: string;
  fileName: string;
  fileData: ArrayBuffer;
  meta: EpubMeta;
  cover: ExtractedCover | null;
}

async function extractCover(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  book: any
): Promise<ExtractedCover | null> {
  try {
    const coverUrl: string | null = await book.coverUrl();
    if (!coverUrl) return null;

    const response = await fetch(coverUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    return {
      data: await blob.arrayBuffer(),
      mimeType: blob.type || response.headers.get('content-type'),
    };
  } catch {
    return null;
  }
}

async function parseEpubMeta(buffer: ArrayBuffer, fileName: string): Promise<PendingBook> {
  const ePub = (await import('epubjs')).default;
  const book = ePub(buffer.slice(0));

  await book.ready;

  let rawMeta: Record<string, string> = {};
  try {
    rawMeta = (await book.loaded.metadata) as unknown as Record<string, string>;
  } catch {
    // El modal permite completar cualquier metadata ausente.
  }

  const cover = await extractCover(book);
  book.destroy();

  return {
    queueId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fileName,
    fileData: buffer,
    meta: {
      title: rawMeta.title || fileName.replace(/\.epub$/i, ''),
      author: rawMeta.creator || '',
      identifier: rawMeta.identifier || `file-${Date.now()}`,
      language: rawMeta.language || 'es',
      publisher: rawMeta.publisher || '',
      pubdate: getPublicationYear(rawMeta.pubdate) || '',
      cover: undefined,
    },
    cover,
  };
}

export default function AddBookButton({ onBookAdded }: AddBookButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { addBook, books } = useLibraryStore();
  const [pendingBooks, setPendingBooks] = useState<PendingBook[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingBook = pendingBooks[0] ?? null;
  const pendingQueueId = pendingBook?.queueId;
  const baseCitekey = pendingBook ? createBaseCitekey(pendingBook.meta) : null;
  const citekeyPreview = useMemo(
    () => baseCitekey
      ? createUniqueCitekey(baseCitekey, books.map((book) => book.id))
      : 'Completa autor y año',
    [baseCitekey, books]
  );

  useEffect(() => {
    if (!pendingQueueId) return;
    titleInputRef.current?.focus();
  }, [pendingQueueId]);

  useEffect(() => {
    if (!pendingQueueId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        setError(null);
        setPendingBooks((queue) => queue.slice(1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingQueueId, isSaving]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsProcessing(true);
    setError(null);

    const parsedBooks: PendingBook[] = [];
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.epub')) {
        setError(`"${file.name}" no es un archivo .epub`);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        parsedBooks.push(await parseEpubMeta(buffer, file.name));
      } catch (err) {
        console.error('Error al procesar libro:', err);
        setError(`Error al procesar "${file.name}"`);
      }
    }

    setPendingBooks((queue) => [...queue, ...parsedBooks]);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateMeta = (field: keyof EpubMeta, value: string) => {
    setPendingBooks((queue) => queue.map((book, index) =>
      index === 0 ? { ...book, meta: { ...book.meta, [field]: value } } : book
    ));
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingBook) return;

    const title = pendingBook.meta.title.trim();
    const author = pendingBook.meta.author.trim();
    const year = getPublicationYear(pendingBook.meta.pubdate);

    if (!title || !author || !year) {
      setError('Completa el título, el autor y un año de cuatro dígitos.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const confirmedMeta: EpubMeta = {
        ...pendingBook.meta,
        title,
        author,
        pubdate: year,
        language: pendingBook.meta.language.trim() || 'es',
        publisher: pendingBook.meta.publisher?.trim() || undefined,
      };

      await addBook(
        pendingBook.fileName,
        pendingBook.fileData,
        confirmedMeta,
        pendingBook.cover?.data ?? null,
        pendingBook.cover?.mimeType
      );
      await onBookAdded?.();
      setPendingBooks((queue) => queue.slice(1));
    } catch (err) {
      console.error('Error al añadir libro:', err);
      setError(err instanceof Error ? err.message : `Error al guardar "${pendingBook.fileName}"`);
    } finally {
      setIsSaving(false);
    }
  };

  const isBusy = isProcessing || isSaving || Boolean(pendingBook);

  return (
    <>
      <button
        id="lib-add-book-btn"
        className={`lib-add-btn ${isBusy ? 'lib-add-btn--loading' : ''}`}
        onClick={() => !isBusy && fileInputRef.current?.click()}
        title="Añadir libro EPUB"
        aria-label="Añadir libro EPUB"
        disabled={isBusy}
      >
        {isProcessing || isSaving ? (
          <LoaderCircle className="lib-add-btn__spinner icon-spin" aria-hidden="true" />
        ) : (
          <Plus className="lib-add-btn__icon" aria-hidden="true" />
        )}
      </button>

      {pendingBook && (
        <div className="settings-modal-backdrop" role="presentation">
          <form
            className="book-meta-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-meta-modal-title"
            onSubmit={handleConfirm}
          >
            <div className="book-meta-modal__header">
              <div className="book-meta-modal__heading">
                <span className="book-meta-modal__icon" aria-hidden="true"><BookPlus size={18} /></span>
                <div>
                  <h2 id="book-meta-modal-title">Confirmar metadatos</h2>
                  <p>{pendingBook.fileName}</p>
                </div>
              </div>
              <button
                type="button"
                className="settings-modal__close"
                onClick={() => {
                  setError(null);
                  setPendingBooks((queue) => queue.slice(1));
                }}
                disabled={isSaving}
                aria-label="Cancelar importación"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="book-meta-modal__body">
              <label className="book-meta-field">
                <span>Título</span>
                <input
                  ref={titleInputRef}
                  value={pendingBook.meta.title}
                  onChange={(event) => updateMeta('title', event.target.value)}
                  required
                />
              </label>

              <label className="book-meta-field">
                <span>Autor</span>
                <input
                  value={pendingBook.meta.author}
                  onChange={(event) => updateMeta('author', event.target.value)}
                  placeholder="Apellido, Nombre"
                  required
                />
              </label>

              <div className="book-meta-modal__row">
                <label className="book-meta-field">
                  <span>Año</span>
                  <input
                    value={pendingBook.meta.pubdate || ''}
                    onChange={(event) => updateMeta('pubdate', event.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    pattern="\d{4}"
                    placeholder="1972"
                    required
                  />
                </label>
                <label className="book-meta-field">
                  <span>Idioma</span>
                  <input
                    value={pendingBook.meta.language}
                    onChange={(event) => updateMeta('language', event.target.value)}
                    placeholder="es"
                  />
                </label>
              </div>

              <label className="book-meta-field">
                <span>Editorial <small>opcional</small></span>
                <input
                  value={pendingBook.meta.publisher || ''}
                  onChange={(event) => updateMeta('publisher', event.target.value)}
                />
              </label>

              <div className="book-meta-citekey">
                <span>ID del libro</span>
                <code>{citekeyPreview}</code>
              </div>

              {pendingBooks.length > 1 && (
                <p className="book-meta-modal__queue">
                  Quedan {pendingBooks.length - 1} {pendingBooks.length === 2 ? 'libro' : 'libros'} por revisar.
                </p>
              )}
            </div>

            <div className="book-meta-modal__actions">
              <button
                type="button"
                className="book-meta-btn book-meta-btn--secondary"
                onClick={() => {
                  setError(null);
                  setPendingBooks((queue) => queue.slice(1));
                }}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="book-meta-btn book-meta-btn--primary"
                disabled={isSaving || !baseCitekey}
              >
                {isSaving && <LoaderCircle className="icon-spin" size={16} aria-hidden="true" />}
                Guardar libro
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="lib-add-error" role="alert">
          {error}
          <button
            className="lib-add-error__close"
            onClick={() => setError(null)}
            aria-label="Cerrar error"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => handleFiles(event.target.files)}
      />
    </>
  );
}
