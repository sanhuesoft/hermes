'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useReaderStore } from '@/stores/useReaderStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useTtsStore } from '@/stores/useTtsStore';
import type { EpubMeta, Chapter, Highlight, HighlightColor, LibraryBook } from '@/types/epub';
import type { EpubViewerHandle } from '@/components/reader/EpubViewer';
import VoiceSelector from '@/components/tts/VoiceSelector';
import TtsControls from '@/components/tts/TtsControls';
import ZenOverlay from '@/components/reader/ZenOverlay';
import HighlightMenu from '@/components/reader/HighlightMenu';
import ReaderSettingsModal from '@/components/settings/ReaderSettingsModal';
import LibraryView from '@/components/library/LibraryView';
import { exportSidecar, importSidecar } from '@/lib/storage/sidecar-manager';

// EpubViewer se carga solo en el cliente (usa epubjs que requiere el DOM)
const EpubViewer = dynamic(() => import('@/components/reader/EpubViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-center" style={{ color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📖</div>
        <p style={{ fontSize: '0.9rem' }}>Cargando el lector…</p>
      </div>
    </div>
  ),
});

export default function Home() {
  // -------------------------------------------------------
  // Vista activa: 'library' | 'reader'
  // -------------------------------------------------------
  const [activeView, setActiveView] = useState<'library' | 'reader'>('library');

  // -------------------------------------------------------
  // Estado del libro abierto
  // -------------------------------------------------------
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [bookMeta, setBookMeta] = useState<EpubMeta | null>(null);
  const [toc, setToc] = useState<Chapter[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  // -------------------------------------------------------
  // Estado de UI del lector
  // -------------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightRequest, setHighlightRequest] = useState<{
    cfiRange: string;
    text: string;
  } | null>(null);

  const importSidecarRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<EpubViewerHandle>(null);

  const { theme, isZenMode, toggleZenMode } = useReaderStore();
  const { openBook, updateHighlights } = useLibraryStore();

  // Aplicar data-theme al html para que las CSS vars funcionen
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // -------------------------------------------------------
  // Abrir un libro desde la biblioteca
  // -------------------------------------------------------
  const handleOpenBook = useCallback(
    async (book: LibraryBook) => {
      // Registrar apertura y obtener datos actualizados
      const updated = await openBook(book.id);
      const target = updated ?? book;

      setActiveBookId(target.id);
      setHighlights(target.highlights ?? []);
      setFileBuffer(target.fileData);
      setBookMeta(null);
      setToc([]);
      setFile(null);
      setActiveView('reader');
    },
    [openBook]
  );

  // -------------------------------------------------------
  // Cerrar el lector y volver a la biblioteca
  // -------------------------------------------------------
  const handleCloseReader = useCallback(async () => {
    // Guardar highlights antes de salir
    if (activeBookId) {
      await updateHighlights(activeBookId, highlights);
    }
    setActiveView('library');
    setActiveBookId(null);
    setFile(null);
    setFileBuffer(null);
    setBookMeta(null);
    setToc([]);
    setHighlights([]);
  }, [activeBookId, highlights, updateHighlights]);

  // -------------------------------------------------------
  // Highlights
  // -------------------------------------------------------
  const handleHighlightConfirm = useCallback(
    (color: HighlightColor, note?: string) => {
      if (!highlightRequest) return;

      const newHighlight: Highlight = {
        id: `hl_${Date.now()}`,
        cfiRange: highlightRequest.cfiRange,
        text: highlightRequest.text,
        color,
        note,
        createdAt: new Date().toISOString(),
      };

      setHighlights((prev) => [...prev, newHighlight]);
      setHighlightRequest(null);
    },
    [highlightRequest]
  );

  // -------------------------------------------------------
  // Exportar / Importar sidecar
  // -------------------------------------------------------
  const handleExport = () => {
    if (!bookMeta) return;
    const name =
      file?.name.replace('.epub', '') ?? bookMeta.title ?? 'notas';
    exportSidecar(bookMeta, highlights, name);
  };

  const handleImportSidecar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const sidecar = await importSidecar(f);
      setHighlights(sidecar.highlights);
    } catch (err) {
      alert(`Error al importar: ${err instanceof Error ? err.message : 'desconocido'}`);
    }
  };

  // -------------------------------------------------------
  // Vista: Biblioteca
  // -------------------------------------------------------
  if (activeView === 'library') {
    return <LibraryView onOpenBook={handleOpenBook} />;
  }

  // -------------------------------------------------------
  // Vista: Lector
  // -------------------------------------------------------

  // Crear un File virtual desde el ArrayBuffer guardado en IndexedDB
  const epubSource = fileBuffer
    ? new File([fileBuffer], bookMeta?.title ?? 'book.epub', {
        type: 'application/epub+zip',
      })
    : file;

  if (!epubSource) {
    // Fallback: si no hay fuente, volver a la biblioteca
    setActiveView('library');
    return null;
  }

  return (
    <ZenOverlay>
      <div className="reader-layout" data-theme={theme}>
        {/* Header */}
        <header className={`reader-header ${isZenMode ? 'reader-header--hidden' : ''}`}>
          {/* Volver a la biblioteca */}
          <button
            id="reader-close-btn"
            className="reader-header__btn"
            onClick={handleCloseReader}
            title="Volver a la biblioteca"
            aria-label="Volver a la biblioteca"
          >
            ←
          </button>

          {/* TOC toggle */}
          <button
            id="reader-toc-btn"
            className="reader-header__btn"
            onClick={() => setSidebarOpen((v) => !v)}
            title="Tabla de contenidos"
            aria-label="Tabla de contenidos"
          >
            ☰
          </button>

          {/* Título del libro */}
          <span className="reader-header__title">
            {bookMeta?.title ?? epubSource.name}
          </span>

          {/* Exportar notas */}
          {highlights.length > 0 && (
            <button
              id="reader-export-btn"
              className="reader-header__btn"
              onClick={handleExport}
              title="Exportar notas"
              aria-label="Exportar notas"
            >
              ↓
            </button>
          )}

          {/* Importar notas */}
          <button
            id="reader-import-btn"
            className="reader-header__btn"
            onClick={() => importSidecarRef.current?.click()}
            title="Importar notas"
            aria-label="Importar notas"
          >
            ↑
          </button>
          <input
            ref={importSidecarRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportSidecar}
          />

          {/* Modo Zen */}
          <button
            id="reader-zen-btn"
            className="reader-header__btn"
            onClick={toggleZenMode}
            title="Modo Zen"
            aria-label="Activar modo Zen"
          >
            ◎
          </button>

          {/* Ajustes */}
          <button
            id="reader-settings-btn"
            className="reader-header__btn"
            onClick={() => setSettingsOpen(true)}
            title="Ajustes de lectura"
            aria-label="Ajustes de lectura"
          >
            ⚙
          </button>
        </header>

        {/* Body: sidebar + epub */}
        <div className="reader-body">
          {/* Sidebar TOC */}
          <aside className={`reader-sidebar ${!sidebarOpen ? 'reader-sidebar--hidden' : ''}`}>
            <p className="toc-title">Capítulos</p>
            {toc.map((chapter) => (
              <button
                key={chapter.id}
                id={`toc-item-${chapter.id}`}
                className="toc-item"
                title={chapter.label}
                onClick={() => {
                  viewerRef.current?.goToChapter(chapter.href);
                  setSidebarOpen(false);
                }}
              >
                {chapter.label}
              </button>
            ))}
          </aside>

          {/* Área de lectura */}
          <main className="reader-main" id="reader-main">
            <EpubViewer
              ref={viewerRef}
              file={epubSource}
              onBookLoaded={(meta, chapters) => {
                setBookMeta(meta);
                setToc(chapters);
                if (meta.language) {
                  const ttsStore = useTtsStore.getState();
                  ttsStore.setBookLanguage(meta.language);
                  ttsStore.autoSelectVoice();
                }
              }}
              onHighlightRequest={(cfiRange, text) =>
                setHighlightRequest({ cfiRange, text })
              }
              highlights={highlights}
            />
          </main>
        </div>

        {/* Footer: voz + controles TTS */}
        <footer className={`reader-footer ${isZenMode ? 'reader-footer--hidden' : ''}`}>
          <VoiceSelector />
          <TtsControls />
        </footer>

        {/* Menú de highlight contextual */}
        {highlightRequest && (
          <HighlightMenu
            cfiRange={highlightRequest.cfiRange}
            selectedText={highlightRequest.text}
            onConfirm={handleHighlightConfirm}
            onCancel={() => setHighlightRequest(null)}
          />
        )}

        {/* Modal de ajustes */}
        <ReaderSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </ZenOverlay>
  );
}
