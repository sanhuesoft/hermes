'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Epub, { Book, Rendition } from 'epubjs';
import { useReaderStore } from '@/stores/useReaderStore';
import { useTtsStore } from '@/stores/useTtsStore';
import { extractParagraphs } from '@/lib/epub/parser';
import { highlightActiveParagraph } from '@/lib/epub/highlight-manager';
import type { EpubMeta, Chapter, Highlight } from '@/types/epub';

export interface EpubViewerHandle {
  goToChapter: (href: string) => void;
  nextPage: () => void;
  prevPage: () => void;
}

interface EpubViewerProps {
  file: File;
  onBookLoaded: (meta: EpubMeta, toc: Chapter[]) => void;
  onHighlightRequest: (cfiRange: string, text: string) => void;
  highlights: Highlight[];
}

const THEME_CSS: Record<string, Record<string, string>> = {
  light: {
    body: 'background: #ffffff !important; color: #1a1a1a !important;',
  },
  dark: {
    body: 'background: #1a1b26 !important; color: #c0caf5 !important;',
  },
  sepia: {
    body: 'background: #f4ede4 !important; color: #3b2d1f !important;',
  },
};

const FONT_MAP: Record<string, string> = {
  inter: '"Inter", sans-serif',
  merriweather: '"Merriweather", serif',
  garamond: '"EB Garamond", serif',
  mono: '"JetBrains Mono", monospace',
  opendyslexic: '"OpenDyslexic", sans-serif',
};

const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer({
  file,
  onBookLoaded,
  onHighlightRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  highlights: _highlights, // used in Phase 4 (restoreHighlights on import)
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const prevParagraphIndexRef = useRef<number>(0);

  const { theme, fontFamily, fontSize, lineHeight, marginX } = useReaderStore();
  const { activeParagraphIndex, setParagraphs } = useTtsStore();

  // -------------------------------------------------------
  // Cargar el libro
  // -------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const loadBook = async () => {
      if (!containerRef.current || !file) return;

      // Limpiar contenedor físico
      containerRef.current.innerHTML = '';

      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
        renditionRef.current = null;
      }

      const arrayBuffer = await file.arrayBuffer();
      if (isCancelled) return;

      const book = Epub(arrayBuffer as ArrayBuffer);
      bookRef.current = book;

      await book.opened;
      if (isCancelled) return;

      const rendition = book.renderTo(containerRef.current, {
        width: '100%',
        height: '100%',
        manager: 'continuous',
        flow: 'paginated',
        spread: 'auto',
        allowScriptedContent: true,
      });
      renditionRef.current = rendition;

      // Registrar temas
      Object.entries(THEME_CSS).forEach(([name, styles]) => {
        rendition.themes.register(name, styles);
      });
      rendition.themes.select(theme);

      // Tipografía inicial (sin marginX)
      applyTypography(rendition, fontFamily, fontSize, lineHeight);

      // Puentear eventos de teclado desde el iframe hacia la ventana principal
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
          rendition.prev();
        } else if (e.key === 'ArrowRight') {
          rendition.next();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const location = rendition.location;
          if (location && bookRef.current) {
            const currentHref = location.start.href;
            const spine = (bookRef.current as any).spine;
            const items = spine?.spineItems || [];
            
            // Buscar coincidencia exacta o decodificada
            const currentIndex = items.findIndex((i: any) => 
              i.href === currentHref || decodeURIComponent(i.href) === decodeURIComponent(currentHref)
            );
            
            if (currentIndex !== -1) {
              const targetIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
              if (targetIndex >= 0 && targetIndex < items.length) {
                // Navegar directo al inicio del spine item
                rendition.display(items[targetIndex].href);
              }
            }
          }
        }
      };

      rendition.on('keyup', (e: Event) => {
        handleKey(e as KeyboardEvent);
      });

      // Listener global por si el foco está fuera del iframe
      const globalKeyHandler = (e: KeyboardEvent) => handleKey(e);
      window.addEventListener('keyup', globalKeyHandler);

      // Limpiar listener global en el cleanup del useEffect
      // (Se adjuntará al return original del useEffect)
      book.ready.then(() => {
        (book as any)._globalKeyHandler = globalKeyHandler;
      });

      // Registrar listeners ANTES de display()
      rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
        const selection = contents.window.getSelection();
        const selectedText = selection?.toString().trim() ?? '';
        if (selectedText.length > 0) {
          onHighlightRequest(cfiRange, selectedText);
        }
      });

      rendition.on('rendered', (section: any, view: any) => {
        const iframeDocument = view?.document || containerRef.current?.querySelector('iframe')?.contentDocument;
        if (iframeDocument) {
          const paragraphs = extractParagraphs(iframeDocument);
          useTtsStore.getState().setParagraphs(paragraphs);
        }
      });

      rendition.on('relocated', (location: any) => {
        const { status, setActiveParagraphIndex, setChapterTitle } = useTtsStore.getState();
        
        // Actualizar el título del capítulo actual
        if (location && bookRef.current) {
           const currentHref = location.start.href;
           const spine = (bookRef.current as any).spine;
           const items = spine?.spineItems || [];
           
           // Buscar el nombre del capítulo (del TOC que se precargó)
           const nav = (bookRef.current as any).navigation;
           if (nav && nav.toc) {
              // Buscar de forma recursiva o plana
              const findTitle = (tocItems: any[]): string | null => {
                for (const item of tocItems) {
                   if (item.href === currentHref || decodeURIComponent(item.href) === decodeURIComponent(currentHref)) return item.label;
                   // Si el href del toc contiene el hash o difiere levemente
                   if (item.href.split('#')[0] === currentHref.split('#')[0]) return item.label;
                   if (item.subitems) {
                     const sub = findTitle(item.subitems);
                     if (sub) return sub;
                   }
                }
                return null;
              };
              const title = findTitle(nav.toc);
              if (title) setChapterTitle(title.trim());
           }
        }

        // Solo sincronizamos la vista con el TTS si el usuario NO está reproduciendo el audio en este momento
        if (status === 'idle' || status === 'paused') {
          try {
            const range = rendition.getRange(location.start.cfi);
            if (range) {
              let el = range.startContainer;
              if (el.nodeType === 3) el = el.parentNode; // Si es un nodo de texto, vamos a su contenedor
              const p = (el as Element).closest('[data-paragraph-index]');
              if (p) {
                const index = parseInt(p.getAttribute('data-paragraph-index') || '0', 10);
                setActiveParagraphIndex(index);
              }
            }
          } catch (e) {
            console.warn('[EpubViewer] No se pudo alinear el TTS con la vista:', e);
          }
        }
      });

      await rendition.display();
      if (isCancelled) return;

      const [metadata, navigation] = await Promise.all([
        book.loaded.metadata,
        book.loaded.navigation,
      ]);

      const coverUrl = await book.coverUrl().catch(() => undefined);

      const meta: EpubMeta = {
        title: metadata.title || 'Sin título',
        author: metadata.creator || 'Desconocido',
        identifier: metadata.identifier || '',
        language: metadata.language || 'es',
        publisher: metadata.publisher,
        cover: coverUrl ?? undefined,
      };

      const toc: Chapter[] = navigation.toc.map((item) => ({
        id: item.id,
        href: item.href,
        label: item.label.trim(),
      }));

      onBookLoaded(meta, toc);
    };

    loadBook();

    return () => {
      isCancelled = true;
      if (bookRef.current) {
        const handler = (bookRef.current as any)._globalKeyHandler;
        if (handler) {
          window.removeEventListener('keyup', handler);
        }
        bookRef.current.destroy();
        bookRef.current = null;
        renditionRef.current = null;
      }
    };
  }, [file]);

  // -------------------------------------------------------
  // Actualizar tema al cambiar
  // -------------------------------------------------------
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    rendition.themes.select(theme);
  }, [theme]);

  // -------------------------------------------------------
  // Actualizar tipografía al cambiar
  // -------------------------------------------------------
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    applyTypography(rendition, fontFamily, fontSize, lineHeight);
  }, [fontFamily, fontSize, lineHeight]);

  // -------------------------------------------------------
  // Resaltado del párrafo activo de TTS y Auto-Paginación
  // -------------------------------------------------------
  useEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe?.contentDocument || !iframe.contentWindow) return;

    highlightActiveParagraph(
      iframe.contentDocument,
      activeParagraphIndex,
      prevParagraphIndexRef.current
    );
    
    // Auto-paginación (TTS -> Viewer): Si el elemento resaltado está fuera de la pantalla, pasamos de página.
    const currentEl = iframe.contentDocument.querySelector<HTMLElement>(`[data-paragraph-index="${activeParagraphIndex}"]`);
    if (currentEl && useTtsStore.getState().status === 'playing') {
      const rect = currentEl.getBoundingClientRect();
      const viewportWidth = iframe.contentWindow.innerWidth;
      
      // Si el borde izquierdo del elemento está más allá del ancho visible, significa que está en la siguiente columna/página
      if (rect.left >= viewportWidth) {
        renditionRef.current?.next();
      } else if (rect.right <= 0) {
        renditionRef.current?.prev();
      }
    }

    prevParagraphIndexRef.current = activeParagraphIndex;
  }, [activeParagraphIndex]);

  // -------------------------------------------------------
  // Navegación
  // -------------------------------------------------------
  const nextPage = () => renditionRef.current?.next();
  const prevPage = () => renditionRef.current?.prev();
  const goToChapter = (href: string) => {
    if (!renditionRef.current || !bookRef.current) return;
    
    const spine = (bookRef.current as any).spine;
    let targetHref = href;
    
    // Pre-validar si la sección existe para evitar el error "No Section Found" de epub.js
    // que causa la pantalla roja de error en Next.js.
    if (spine && spine.get) {
      let section = spine.get(href);
      
      if (!section) {
        const cleanHref = decodeURIComponent(href.split('#')[0]);
        const basename = cleanHref.split('/').pop() || cleanHref;
        
        if (spine.spineItems) {
          let match = spine.spineItems.find((i: any) => decodeURIComponent(i.href) === cleanHref);
          if (!match) {
            match = spine.spineItems.find((i: any) => 
              decodeURIComponent(i.href).endsWith(basename) || cleanHref.endsWith(decodeURIComponent(i.href))
            );
          }
          
          if (match) {
            targetHref = match.href;
            console.log('[EpubViewer] Fallback resuelto:', targetHref);
          } else {
            console.error('[EpubViewer] Capítulo no encontrado en el spine:', href);
            return; // Abortamos la navegación para evitar el error.
          }
        }
      }
    }
    
    renditionRef.current.display(targetHref).catch((err) => {
      console.warn('[EpubViewer] Error al navegar al capítulo:', targetHref, err);
    });
  };

  useImperativeHandle(ref, () => ({
    goToChapter,
    nextPage,
    prevPage,
  }));

  return (
    <div className="epub-viewer-wrapper relative flex h-full w-full flex-col">
      {/* Envoltorio con padding para evitar que epubjs malinterprete el clientWidth */}
      <div 
        className="flex-1 transition-all duration-300 w-full h-full"
        style={{ paddingLeft: `${marginX}%`, paddingRight: `${marginX}%`, minHeight: 0 }}
      >
        <div
          ref={containerRef}
          className="epub-canvas w-full h-full"
        />
      </div>

      {/* Controles de navegación de páginas */}
      <div className="epub-nav-controls absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none px-2">
        <button
          id="epub-prev-page"
          onClick={prevPage}
          aria-label="Página anterior"
          className="epub-nav-btn pointer-events-auto"
        >
          ‹
        </button>
        <button
          id="epub-next-page"
          onClick={nextPage}
          aria-label="Página siguiente"
          className="epub-nav-btn pointer-events-auto"
        >
          ›
        </button>
      </div>
    </div>
  );
});

export default EpubViewer;

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function applyTypography(
  rendition: Rendition,
  fontFamily: string,
  fontSize: number,
  lineHeight: number
): void {
  rendition.themes.override('font-family', FONT_MAP[fontFamily] || 'sans-serif');
  rendition.themes.override('font-size', `${fontSize}px`);
  rendition.themes.override('line-height', String(lineHeight));
  // Los márgenes internos del body rompen el flow paginado de CSS columns en epubjs.
  // Es mejor aplicarlos como padding en el div contenedor padre.
}
