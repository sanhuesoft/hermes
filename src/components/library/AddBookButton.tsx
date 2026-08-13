'use client';

import { useRef, useState } from 'react';
import { useLibraryStore } from '@/stores/useLibraryStore';
import type { EpubMeta } from '@/types/epub';

interface AddBookButtonProps {
  onBookAdded?: () => void;
}

/**
 * Extrae los bytes raw de la imagen de portada desde el EPUB.
 * Devuelve null si el libro no tiene portada o si falla la extracción.
 *
 * Estrategia: obtener el blob URL de epubjs → fetch → ArrayBuffer.
 */
async function extractCoverBytes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  book: any
): Promise<ArrayBuffer | null> {
  try {
    const coverUrl: string | null = await book.coverUrl();
    if (!coverUrl) return null;
    const response = await fetch(coverUrl);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Extrae la metadata básica del EPUB y los bytes de la portada.
 * Usa epubjs dinámicamente (solo cliente).
 *
 * El TypeError "Cannot read properties of undefined (reading '0')" ocurre
 * cuando navigation.toc es undefined en algunos EPUBs. Lo manejamos con
 * defensive defaults.
 */
async function parseEpubMeta(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ meta: EpubMeta; coverData: ArrayBuffer | null }> {
  // Importar epubjs solo en cliente
  const ePub = (await import('epubjs')).default;

  // Usamos slice(0) para no transferir el original
  const book = ePub(buffer.slice(0));

  await book.ready;

  // Metadata — defensive: algunos campos pueden ser undefined
  let rawMeta: Record<string, string> = {};
  try {
    rawMeta = (await book.loaded.metadata) as unknown as Record<string, string>;
  } catch {
    // Continuar con defaults
  }


  // Portada — extraemos los bytes reales en lugar de guardar el blob URL
  const coverData = await extractCoverBytes(book);

  // Generar blob URL temporal para mostrar en UI inmediatamente
  // (se regenera en BookCard.tsx al montar el componente desde coverData)
  let coverUrl: string | undefined;
  if (coverData) {
    const blob = new Blob([coverData]);
    coverUrl = URL.createObjectURL(blob);
  }

  book.destroy();

  return {
    meta: {
      title: rawMeta.title || fileName.replace(/\.epub$/i, ''),
      author: rawMeta.creator || '',
      identifier: rawMeta.identifier || `file-${Date.now()}`,
      language: rawMeta.language || 'es',
      publisher: rawMeta.publisher,
      cover: coverUrl,
    },
    coverData,
  };
}

export default function AddBookButton({ onBookAdded }: AddBookButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addBook } = useLibraryStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setError(null);

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.epub')) {
        setError(`"${file.name}" no es un archivo .epub`);
        continue;
      }
      try {
        const buffer = await file.arrayBuffer();
        const { meta, coverData } = await parseEpubMeta(buffer, file.name);
        await addBook(file.name, buffer, meta, coverData);
      } catch (err) {
        console.error('Error al añadir libro:', err);
        setError(`Error al procesar "${file.name}"`);
      }
    }

    setIsProcessing(false);
    onBookAdded?.();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <button
        id="lib-add-book-btn"
        className={`lib-add-btn ${isProcessing ? 'lib-add-btn--loading' : ''}`}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        title="Añadir libro EPUB"
        aria-label="Añadir libro EPUB"
        disabled={isProcessing}
      >
        {isProcessing ? (
          <span className="lib-add-btn__spinner" />
        ) : (
          <span className="lib-add-btn__icon">＋</span>
        )}
      </button>

      {error && (
        <div className="lib-add-error" role="alert">
          {error}
          <button
            className="lib-add-error__close"
            onClick={() => setError(null)}
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </>
  );
}
