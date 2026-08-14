'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  BookOpen,
  Bookmark as BookmarkIcon,
  BookmarkCheck as BookmarkFilledIcon,
  Download,
  Focus,
  Menu,
  Minimize2,
  PanelLeft,
  PanelRight,
  Settings,
  StickyNote,
  Trash2,
  Upload,
} from 'lucide-react';
import { useReaderStore } from '@/stores/useReaderStore';
import { useLibraryStore } from '@/stores/useLibraryStore';
import { useTtsStore } from '@/stores/useTtsStore';
import type { EpubMeta, Chapter, Highlight, HighlightColor, LibraryBook, Bookmark } from '@/types/epub';
import type { EpubViewerHandle } from '@/components/reader/EpubViewer';
import VoiceSelector from '@/components/tts/VoiceSelector';
import TtsControls from '@/components/tts/TtsControls';

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
        <BookOpen size={34} aria-hidden="true" style={{ margin: '0 auto 0.5rem' }} />
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
  const [initialCfi, setInitialCfi] = useState<string | null>(null);
  const [bookMeta, setBookMeta] = useState<EpubMeta | null>(null);
  const [toc, setToc] = useState<Chapter[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [currentCfi, setCurrentCfi] = useState<string | null>(null);

  // -------------------------------------------------------
  // Estado de UI del lector
  // -------------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [annotationsPanelOpen, setAnnotationsPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightRequest, setHighlightRequest] = useState<{
    cfiRange: string;
    text: string;
  } | null>(null);
  const [hoveredHighlight, setHoveredHighlight] = useState<{
    highlight: Highlight;
    position: { x: number; y: number };
  } | null>(null);

  const importSidecarRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<EpubViewerHandle>(null);

  const { theme, isZenMode, toggleZenMode } = useReaderStore();
  const { openBook, updateHighlights, updateBookmarks, updateProgress } = useLibraryStore();

  // Aplicar data-theme al html para que las CSS vars funcionen
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // -------------------------------------------------------
  // Abrir un libro desde la biblioteca
  // -------------------------------------------------------
  const handleOpenBook = useCallback(
    async (book: LibraryBook | { id: string }) => {
      const updated = await openBook(book.id);
      const target = updated ?? (book as LibraryBook);

      if (!updated && !target.fileData) {
        // El libro no se encontró en la BD y no hay datos
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      setActiveBookId(target.id);
      setHighlights(target.highlights ?? []);
      setBookmarks(target.bookmarks ?? []);
      setFileBuffer(target.fileData);
      setInitialCfi(target.lastCfi ?? null); // restaurar posición guardada
      setCurrentCfi(target.lastCfi ?? null);
      setBookMeta(null);
      setToc([]);
      setFile(null);
      setActiveView('reader');
      window.history.pushState(null, '', '?book=' + target.id);
    },
    [openBook]
  );

  // -------------------------------------------------------
  // Recuperar libro de la URL al cargar
  // -------------------------------------------------------
  useEffect(() => {
    const bookId = new URLSearchParams(window.location.search).get('book');
    if (!bookId) return;

    const timer = window.setTimeout(() => {
      handleOpenBook({ id: bookId });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [handleOpenBook]);

  // -------------------------------------------------------
  // Cerrar el lector y volver a la biblioteca
  // -------------------------------------------------------
  const handleCloseReader = useCallback(async () => {
    if (activeBookId) {
      await updateHighlights(activeBookId, highlights);
      await updateBookmarks(activeBookId, bookmarks);
    }
    setActiveView('library');
    setActiveBookId(null);
    setFile(null);
    setFileBuffer(null);
    setInitialCfi(null);
    setCurrentCfi(null);
    setBookMeta(null);
    setToc([]);
    setHighlights([]);
    setBookmarks([]);
    window.history.pushState(null, '', window.location.pathname);
  }, [activeBookId, highlights, bookmarks, updateHighlights, updateBookmarks]);

  // -------------------------------------------------------
  // Highlights
  // -------------------------------------------------------
  const handleHighlightConfirm = useCallback(
    async (color: HighlightColor, note?: string) => {
      if (!highlightRequest) return;

      const newHighlight: Highlight = {
        id: `hl_${Date.now()}`,
        cfiRange: highlightRequest.cfiRange,
        text: highlightRequest.text,
        color,
        note,
        createdAt: new Date().toISOString(),
      };

      setHighlights((prev) => {
        const updated = [...prev, newHighlight];
        if (activeBookId) {
          updateHighlights(activeBookId, updated).catch(console.error);
        }
        return updated;
      });
      setHighlightRequest(null);
    },
    [highlightRequest, activeBookId, updateHighlights]
  );

  // -------------------------------------------------------
  // Bookmarks
  // -------------------------------------------------------
  // Detectar si la página actual ya tiene bookmark
  const isCurrentPageBookmarked = currentCfi
    ? bookmarks.some((b) => b.cfi === currentCfi)
    : false;

  const handleToggleBookmark = useCallback(() => {
    const cfi = viewerRef.current?.getCurrentCfi();
    if (!cfi) return;

    setBookmarks((prev) => {
      const exists = prev.find((b) => b.cfi === cfi);
      let updated;
      if (exists) {
        updated = prev.filter((b) => b.id !== exists.id);
      } else {
        const newBookmark: Bookmark = {
          id: `bm_${Date.now()}`,
          cfi,
          label: `Marcador en posición`,
          createdAt: new Date().toISOString(),
        };
        updated = [...prev, newBookmark];
      }
      if (activeBookId) {
        updateBookmarks(activeBookId, updated).catch(console.error);
      }
      return updated;
    });
  }, [activeBookId, updateBookmarks]);

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

  // Crear una fuente estable sin cambiar el orden de hooks entre vistas.
  const epubSource = useMemo(() => {
    return fileBuffer
      ? new File([fileBuffer], 'book.epub', {
          type: 'application/epub+zip',
        })
      : file;
  }, [fileBuffer, file]);

  // -------------------------------------------------------
  // Vista: Biblioteca
  // -------------------------------------------------------
  if (activeView === 'library' || !epubSource) {
    return <LibraryView onOpenBook={handleOpenBook} />;
  }

  // -------------------------------------------------------
  // Vista: Lector
  // -------------------------------------------------------

  return (
    <>
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
            <ArrowLeft size={20} aria-hidden="true" />
          </button>

          {/* TOC toggle */}
          <button
            id="reader-toc-btn"
            className={`reader-header__btn${sidebarOpen ? ' reader-header__btn--active' : ''}`}
            onClick={() => setSidebarOpen((v) => !v)}
            title="Tabla de contenidos"
            aria-label="Tabla de contenidos"
            aria-pressed={sidebarOpen}
          >
            <PanelLeft size={20} aria-hidden="true" />
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
              <Download size={19} aria-hidden="true" />
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
            <Upload size={19} aria-hidden="true" />
          </button>
          <input
            ref={importSidecarRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportSidecar}
          />

          {/* Añadir marcador */}
          <button
            id="reader-bookmark-btn"
            className={`reader-header__btn${isCurrentPageBookmarked ? ' reader-header__btn--active' : ''}`}
            onClick={handleToggleBookmark}
            title={isCurrentPageBookmarked ? 'Eliminar marcador' : 'Añadir marcador'}
            aria-label={isCurrentPageBookmarked ? 'Eliminar marcador' : 'Añadir marcador'}
            aria-pressed={isCurrentPageBookmarked}
          >
            {isCurrentPageBookmarked
              ? <BookmarkFilledIcon size={19} aria-hidden="true" />
              : <BookmarkIcon size={19} aria-hidden="true" />}
          </button>

          {/* Modo Zen */}
          <button
            id="reader-zen-btn"
            className="reader-header__btn"
            onClick={toggleZenMode}
            title="Modo Zen"
            aria-label="Activar modo Zen"
          >
            <Focus size={20} aria-hidden="true" />
          </button>

          {/* Panel de anotaciones */}
          <button
            id="reader-annotations-btn"
            className={`reader-header__btn${annotationsPanelOpen ? ' reader-header__btn--active' : ''}`}
            onClick={() => setAnnotationsPanelOpen((v) => !v)}
            title="Subrayados y notas"
            aria-label="Subrayados y notas"
            aria-pressed={annotationsPanelOpen}
          >
            <PanelRight size={20} aria-hidden="true" />
          </button>

          {/* Ajustes */}
          <button
            id="reader-settings-btn"
            className="reader-header__btn"
            onClick={() => setSettingsOpen(true)}
            title="Ajustes de lectura"
            aria-label="Ajustes de lectura"
          >
            <Settings size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body: sidebar + epub */}
        <div className="reader-body">
          {/* Sidebar TOC izquierdo */}
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

            {bookmarks.length > 0 && (
              <>
                <p className="toc-title" style={{ marginTop: '1.5rem' }}>Marcadores</p>
                {bookmarks.map((bm) => (
                  <button
                    key={bm.id}
                    className="toc-item"
                    title={bm.label}
                    onClick={() => {
                      viewerRef.current?.goToChapter(bm.cfi);
                      setSidebarOpen(false);
                    }}
                  >
                    <BookmarkIcon size={14} aria-hidden="true" />
                    <span>{new Date(bm.createdAt).toLocaleDateString()} {new Date(bm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                ))}
              </>
            )}
          </aside>

          {/* Panel de anotaciones derecho */}
          <aside
            id="reader-annotations-panel"
            className={`reader-annotations-panel ${!annotationsPanelOpen ? 'reader-annotations-panel--hidden' : ''}`}
          >
            <p className="toc-title">
              Subrayados
              <span className="annotations-count">{highlights.length}</span>
            </p>

            {highlights.length === 0 ? (
              <p className="annotations-empty">No hay subrayados aún.</p>
            ) : (
              <div className="annotations-list">
                {highlights.map((hl) => {
                  const COLOR_HEX: Record<string, string> = {
                    yellow: '#ffc701',
                    green:  '#c7e372',
                    blue:   '#9ad0dc',
                    pink:   '#ef5a68',
                  };
                  const hex = COLOR_HEX[hl.color] || '#ffc701';
                  return (
                    <div
                      key={hl.id}
                      className="annotation-card"
                      style={{ '--hl-color': hex } as React.CSSProperties}
                    >
                      {/* Texto subrayado */}
                      <button
                        className="annotation-card__text"
                        title="Ir al subrayado"
                        onClick={() => {
                          viewerRef.current?.goToChapter(hl.cfiRange);
                          setAnnotationsPanelOpen(false);
                        }}
                      >
                        <span
                          className="annotation-card__swatch"
                          style={{ background: hex }}
                        />
                        <span className="annotation-card__quote">
                          &ldquo;{hl.text.slice(0, 120)}{hl.text.length > 120 ? '…' : ''}&rdquo;
                        </span>
                      </button>

                      {/* Nota (si existe) */}
                      {hl.note && (
                        <div className="annotation-card__note">
                          <StickyNote size={12} aria-hidden="true" />
                          <span>{hl.note}</span>
                        </div>
                      )}

                      {/* Fecha + eliminar */}
                      <div className="annotation-card__meta">
                        <span className="annotation-card__date">
                          {new Date(hl.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          className="annotation-card__delete"
                          title="Eliminar subrayado"
                          aria-label="Eliminar subrayado"
                          onClick={() => {
                            setHighlights((prev) => {
                              const updated = prev.filter((h) => h.id !== hl.id);
                              if (activeBookId) updateHighlights(activeBookId, updated).catch(console.error);
                              return updated;
                            });
                          }}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Área de lectura */}
          <main className="reader-main" id="reader-main">
            <EpubViewer
              ref={viewerRef}
              file={epubSource}
              initialCfi={initialCfi}
              onProgressUpdate={(cfi) => {
                if (activeBookId) updateProgress(activeBookId, cfi);
              }}
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
              onHighlightHover={(hl, pos) => {
                if (hl && pos) {
                  setHoveredHighlight({ highlight: hl, position: pos });
                } else {
                  setHoveredHighlight(null);
                }
              }}
              onLocationChange={(cfi) => setCurrentCfi(cfi)}
              highlights={highlights}
            />
          </main>
        </div>

        {/* Footer: controles TTS */}
        <footer className={`reader-footer ${isZenMode ? 'reader-footer--hidden' : ''}`}>
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

        {/* Tooltip de nota en resaltado */}
        {hoveredHighlight && hoveredHighlight.highlight.note && (
          <div
            style={{
              position: 'absolute',
              top: hoveredHighlight.position.y + 10,
              left: hoveredHighlight.position.x,
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, rgba(100,100,100,0.2))',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
              zIndex: 50,
              maxWidth: '300px',
              color: 'var(--text-color, #1a1a1a)',
              pointerEvents: 'none',
              transform: 'translateX(-50%)', // Centrar horizontalmente respecto a la posición x
            }}
          >
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.4' }}>
              {hoveredHighlight.highlight.note}
            </p>
          </div>
        )}

        {/* Botón flotante para salir del Modo Zen */}
        {isZenMode && (
          <button
            className="zen-exit-btn"
            onClick={toggleZenMode}
            title="Salir del modo Zen"
            aria-label="Salir del modo Zen"
          >
            <Minimize2 size={22} aria-hidden="true" />
          </button>
        )}

        {/* Modal de ajustes */}
        <ReaderSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </>
  );
}
