'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useReaderStore } from '@/stores/useReaderStore';
import type { EpubMeta, Chapter, Highlight, HighlightColor } from '@/types/epub';
import type { EpubViewerHandle } from '@/components/reader/EpubViewer';
import VoiceSelector from '@/components/tts/VoiceSelector';
import TtsControls from '@/components/tts/TtsControls';
import ZenOverlay from '@/components/reader/ZenOverlay';
import HighlightMenu from '@/components/reader/HighlightMenu';
import ReaderSettingsModal from '@/components/settings/ReaderSettingsModal';
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
  // Estado del archivo cargado
  // -------------------------------------------------------
  const [file, setFile] = useState<File | null>(null);
  const [bookMeta, setBookMeta] = useState<EpubMeta | null>(null);
  const [toc, setToc] = useState<Chapter[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // -------------------------------------------------------
  // Estado de UI
  // -------------------------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [highlightRequest, setHighlightRequest] = useState<{
    cfiRange: string;
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importSidecarRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<EpubViewerHandle>(null);

  const { theme, isZenMode, toggleZenMode } = useReaderStore();

  // Aplicar data-theme al html para que las CSS vars funcionen
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // -------------------------------------------------------
  // Manejo de archivo
  // -------------------------------------------------------
  const handleFile = useCallback((selectedFile: File) => {
    if (!selectedFile.name.endsWith('.epub')) {
      alert('Por favor selecciona un archivo .epub');
      return;
    }
    setFile(selectedFile);
    setHighlights([]);
    setToc([]);
    setBookMeta(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

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
    exportSidecar(
      bookMeta,
      highlights,
      file?.name.replace('.epub', '') ?? 'notas'
    );
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
  // Pantalla de dropzone
  // -------------------------------------------------------
  if (!file) {
    return (
      <main className="dropzone">
        <div
          id="epub-dropzone"
          className={`dropzone__card ${isDragging ? 'dropzone__card--dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Zona de carga de archivo EPUB"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <div className="dropzone__icon">📚</div>

          <h1 className="dropzone__title">EReader</h1>

          <p className="dropzone__subtitle">
            Arrastra un archivo <strong>.epub</strong> aquí<br />
            o haz clic para seleccionarlo
          </p>

          <button
            id="epub-open-btn"
            className="dropzone__btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            📂 Abrir archivo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        <div className="dropzone__features">
          <span className="dropzone__feature">🔒 100% local</span>
          <span className="dropzone__feature">🎙️ Voz Edge TTS</span>
          <span className="dropzone__feature">✏️ Anotaciones</span>
          <span className="dropzone__feature">🌙 Modo Zen</span>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------
  // Interfaz de lectura
  // -------------------------------------------------------
  return (
    <ZenOverlay>
      <div className="reader-layout" data-theme={theme}>
        {/* Header */}
        <header className={`reader-header ${isZenMode ? 'reader-header--hidden' : ''}`}>
          {/* Cerrar libro */}
          <button
            id="reader-close-btn"
            className="reader-header__btn"
            onClick={() => setFile(null)}
            title="Cerrar libro"
            aria-label="Cerrar libro"
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
            {bookMeta?.title ?? file.name}
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
              file={file}
              onBookLoaded={(meta, chapters) => {
                setBookMeta(meta);
                setToc(chapters);
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
