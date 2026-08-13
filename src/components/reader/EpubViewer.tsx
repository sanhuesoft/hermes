'use client';

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Epub, { Book, Rendition } from 'epubjs';
import { useReaderStore } from '@/stores/useReaderStore';
import { useTtsStore } from '@/stores/useTtsStore';
import { extractParagraphs, splitIntoSentences } from '@/lib/epub/parser';
import { highlightActiveParagraph, getSentenceIndexFromPoint, highlightHoverSentence, clearHoverSentence } from '@/lib/epub/highlight-manager';
import type { EpubMeta, Chapter, Highlight } from '@/types/epub';

export interface EpubViewerHandle {
  goToChapter: (href: string) => void;
  nextPage: () => void;
  prevPage: () => void;
  getCurrentCfi: () => string | undefined;
}

interface EpubViewerProps {
  file: File;
  onBookLoaded: (meta: EpubMeta, toc: Chapter[]) => void;
  onHighlightRequest: (cfiRange: string, text: string) => void;
  highlights: Highlight[];
  /** CFI de la última posición guardada (para restaurar progreso) */
  initialCfi?: string | null;
  /** Callback para guardar el progreso periódicamente */
  onProgressUpdate?: (cfi: string) => void;
  /** Callback cuando se hace hover sobre un resaltado (para mostrar nota) */
  onHighlightHover?: (highlight: Highlight | null, position?: { x: number; y: number }) => void;
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

const getCleanHref = (href: string | undefined | null) => {
  if (!href) return '';
  return decodeURIComponent(href.split('#')[0]);
};

const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer({
  file,
  onBookLoaded,
  onHighlightRequest,
  highlights,
  initialCfi,
  onProgressUpdate,
  onHighlightHover,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const prevParagraphIndexRef = useRef<number>(0);
  // Ref para el último CFI, para guardar progreso sin re-renders
  const lastCfiRef = useRef<string | null>(null);
  // Ref para el debounce de progreso
  const progressSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mapa local de párrafos por sección para evitar que precargas de otros capítulos pisen el actual
  const sectionParagraphsMapRef = useRef<Map<string, string[]>>(new Map());
  // Ref para rastrear los highlights ya renderizados
  const renderedHighlightsRef = useRef<Set<string>>(new Set());
  // Ref para mantener los highlights actuales accesibles a los listeners
  const highlightsRef = useRef<Highlight[]>(highlights);

  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  const { theme, fontFamily, fontSize, lineHeight, marginX } = useReaderStore();
  const { activeParagraphIndex, activeSentenceIndex, paragraphs: ttsParagraphs, status: ttsStatus, setParagraphs } = useTtsStore();

  const ttsActive = ttsStatus === 'playing' || ttsStatus === 'loading';

  // -------------------------------------------------------
  // Cargar el libro
  // -------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const loadBook = async () => {
      if (!containerRef.current || !file) return;

      // Limpiar contenedor físico
      containerRef.current.innerHTML = '';
      renderedHighlightsRef.current.clear();

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
        allowScriptedContent: false,
      });
      renditionRef.current = rendition;

      // Registrar temas
      Object.entries(THEME_CSS).forEach(([name, styles]) => {
        rendition.themes.register(name, styles);
      });
      rendition.themes.select(theme);

      // Tipografía inicial
      applyTypography(rendition, fontFamily, fontSize, lineHeight);

      // Puentear eventos de teclado desde el iframe hacia la ventana principal
      const handleKey = (e: KeyboardEvent) => {
        // Ignorar si el usuario está escribiendo en algún input
        const isTyping = document.activeElement && (
          document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.hasAttribute('contenteditable')
        );
        if (isTyping) return;

        // Tecla Espacio: alternar TTS
        if (e.key === ' ') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('toggle-tts'));
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          rendition.prev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          rendition.next();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const location = rendition.location;
          if (location && bookRef.current) {
            const currentHref = location.start.href;
            const spine = (bookRef.current as any).spine;
            const items = spine?.spineItems || [];

            const currentIndex = items.findIndex((i: any) =>
              i.href === currentHref || decodeURIComponent(i.href) === decodeURIComponent(currentHref)
            );

            if (currentIndex !== -1) {
              const targetIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
              if (targetIndex >= 0 && targetIndex < items.length) {
                e.preventDefault();
                rendition.display(items[targetIndex].href);
              }
            }
          }
        }
      };

      rendition.on('keydown', (e: Event) => {
        handleKey(e as KeyboardEvent);
      });

      const globalKeyHandler = (e: KeyboardEvent) => handleKey(e);
      window.addEventListener('keydown', globalKeyHandler);

      book.ready.then(() => {
        (book as any)._globalKeyHandler = globalKeyHandler;
      });

      // Listener de selección para highlights
      rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
        const selection = contents.window.getSelection();
        const selectedText = selection?.toString().trim() ?? '';
        if (selectedText.length > 0) {
          onHighlightRequest(cfiRange, selectedText);
        }
      });

      // Cuando se renderiza una sección
      rendition.on('rendered', (section: any, view: any) => {
        const iframeDocument = view?.document;
        if (!iframeDocument) return;

        const cleanHref = getCleanHref(section.href);

        // Extraer párrafos para TTS y guardarlos en el mapa local
        const paragraphs = extractParagraphs(iframeDocument);
        sectionParagraphsMapRef.current.set(cleanHref, paragraphs);

        // Si esta sección es la que se está visualizando actualmente, actualizar el store
        const currentLocation = rendition.location;
        if (currentLocation && getCleanHref(currentLocation.start.href) === cleanHref) {
          useTtsStore.getState().setParagraphs(paragraphs);
        }

        // Inyectar estilos de cursor + hover para párrafos clicables y FUENTES
        const styleId = 'tts-paragraph-click-styles';
        if (!iframeDocument.getElementById(styleId)) {
          const style = iframeDocument.createElement('style');
          style.id = styleId;
          style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&display=swap');
            @import url('https://fonts.cdnfonts.com/css/opendyslexic');

            [data-paragraph-index] {
              cursor: pointer;
              border-radius: 3px;
              transition: background-color 0.15s;
            }

            ::highlight(tts-active) {
              background-color: #d4ddda;
              color: inherit;
            }
            
            ::highlight(tts-hover) {
              background-color: rgba(212, 221, 218, 0.4);
              border-bottom: 1px dashed rgba(212, 221, 218, 0.8);
            }

            ::highlight(tts-active) {
              background-color: #d4ddda;
              color: inherit;
            }
          `;
          (iframeDocument.head || iframeDocument.documentElement).appendChild(style);
        }

        // Listener de click sobre párrafos para saltar TTS a la frase exacta
        const handleParagraphClick = (e: MouseEvent) => {
          // Ignorar el click si el usuario está seleccionando texto (para crear un highlight/nota)
          const selection = iframeDocument.defaultView?.getSelection();
          if (selection && selection.toString().trim().length > 0) return;

          const target = e.target as Element;
          if (!target.closest('[data-paragraph-index]')) return;

          const paragraphs = sectionParagraphsMapRef.current.get(cleanHref) || [];
          const pos = getSentenceIndexFromPoint(iframeDocument, e.clientX, e.clientY, []);

          if (pos && pos.paragraphIndex >= 0) {
             const pText = paragraphs[pos.paragraphIndex] || '';
             const sentences = splitIntoSentences(pText);
             const exactPos = getSentenceIndexFromPoint(iframeDocument, e.clientX, e.clientY, sentences);
             
             if (exactPos && exactPos.sentenceIndex >= 0) {
               useTtsStore.getState().jumpToSentence(exactPos.paragraphIndex, exactPos.sentenceIndex);
             } else {
               useTtsStore.getState().jumpToParagraph(pos.paragraphIndex);
             }
          }
        };
        
        let hoverTimeout: any = null;
        const handleMouseMove = (e: MouseEvent) => {
          if (hoverTimeout) clearTimeout(hoverTimeout);
          hoverTimeout = setTimeout(() => {
            const target = e.target as Element;
            if (!target.closest('[data-paragraph-index]')) {
              clearHoverSentence(iframeDocument);
              return;
            }
            
            const paragraphs = sectionParagraphsMapRef.current.get(cleanHref) || [];
            const pos = getSentenceIndexFromPoint(iframeDocument, e.clientX, e.clientY, []);
            if (pos && pos.paragraphIndex >= 0) {
               const pText = paragraphs[pos.paragraphIndex] || '';
               const sentences = splitIntoSentences(pText);
               const exactPos = getSentenceIndexFromPoint(iframeDocument, e.clientX, e.clientY, sentences);
               if (exactPos && exactPos.sentenceIndex >= 0) {
                 highlightHoverSentence(iframeDocument, exactPos.paragraphIndex, sentences[exactPos.sentenceIndex]);
               } else {
                 clearHoverSentence(iframeDocument);
               }
            } else {
               clearHoverSentence(iframeDocument);
            }
          }, 50); // throttle para no bloquear
        };

        const docAny = iframeDocument as Document & { 
          _ttsClickHandler?: EventListener;
          _ttsMoveHandler?: EventListener;
          _hlMoveHandler?: EventListener;
          _hlOutHandler?: EventListener;
        };
        
        if (docAny._ttsClickHandler) {
          iframeDocument.removeEventListener('click', docAny._ttsClickHandler);
          iframeDocument.removeEventListener('mousemove', docAny._ttsMoveHandler as EventListener);
          iframeDocument.removeEventListener('mouseover', docAny._hlMoveHandler as EventListener);
          iframeDocument.removeEventListener('mouseout', docAny._hlOutHandler as EventListener);
        }

        // --- Highlight Hover Logic ---
        let hlHoverTimeout: any = null;
        const handleHighlightMouseOver = (e: MouseEvent) => {
          const target = e.target as Element;
          // Epubjs agrega el atributo data-epubjs-annotation a las marcas de resaltado,
          // o podemos buscar nuestra clase personalizada `custom-hl-[id]`
          const annotationMark = target.closest('[data-epubjs-annotation]') || target;

          let matchId: string | null = null;

          if (annotationMark.hasAttribute('data-epubjs-annotation')) {
             const cfi = annotationMark.getAttribute('data-epubjs-annotation');
             const h = highlightsRef.current.find(h => h.cfiRange === cfi);
             if (h) matchId = h.id;
          }

          if (!matchId) {
            // Check for custom class
            const matchClass = Array.from(annotationMark.classList || []).find(c => c.startsWith('custom-hl-'));
            if (matchClass) {
              matchId = matchClass.replace('custom-hl-', '');
            } else if (target.parentElement) {
              const parentClass = Array.from(target.parentElement.classList || []).find(c => c.startsWith('custom-hl-'));
              if (parentClass) matchId = parentClass.replace('custom-hl-', '');
            }
          }

          if (matchId) {
            const match = highlightsRef.current.find(h => h.id === matchId);
            if (match && match.note) {
              if (hlHoverTimeout) clearTimeout(hlHoverTimeout);
              hlHoverTimeout = setTimeout(() => {
                // Calcular posición
                const rect = annotationMark.getBoundingClientRect();
                const iframeRect = iframeDocument.defaultView?.frameElement?.getBoundingClientRect();

                onHighlightHover?.(match, {
                  x: rect.left + (iframeRect ? iframeRect.left : 0),
                  y: rect.bottom + (iframeRect ? iframeRect.top : 0)
                });
              }, 200);
            }
          }
        };

        const handleHighlightMouseOut = (e: MouseEvent) => {
          const target = e.target as Element;
          if (target.closest('[data-epubjs-annotation]') || Array.from(target.classList || []).some(c => c.startsWith('custom-hl-')) || (target.parentElement && Array.from(target.parentElement.classList || []).some(c => c.startsWith('custom-hl-')))) {
            if (hlHoverTimeout) clearTimeout(hlHoverTimeout);
            hlHoverTimeout = setTimeout(() => {
              onHighlightHover?.(null);
            }, 300);
          }
        };
        // -----------------------------

        docAny._ttsClickHandler = handleParagraphClick as EventListener;
        docAny._ttsMoveHandler = handleMouseMove as EventListener;
        docAny._hlMoveHandler = handleHighlightMouseOver as EventListener;
        docAny._hlOutHandler = handleHighlightMouseOut as EventListener;

        iframeDocument.addEventListener('click', handleParagraphClick as EventListener);
        iframeDocument.addEventListener('mousemove', handleMouseMove as EventListener);
        iframeDocument.addEventListener('mouseover', handleHighlightMouseOver as EventListener);
        iframeDocument.addEventListener('mouseout', handleHighlightMouseOut as EventListener);
      });

      // Evento de reubicación: guardar progreso + sincronizar TTS
      rendition.on('relocated', (location: any) => {
        const { status, stop, setActiveParagraphIndex, setChapterTitle } = useTtsStore.getState();

        const currentHref = location.start.href;
        const cleanHref = getCleanHref(currentHref);

        // Si la sección cambia a un capítulo diferente durante la reproducción,
        // detenemos el TTS para evitar reproducir audio desincronizado.
        const currentParagraphs = useTtsStore.getState().paragraphs;
        const activeIdx = useTtsStore.getState().activeParagraphIndex;
        const newParagraphs = sectionParagraphsMapRef.current.get(cleanHref);

        if (status === 'playing' || status === 'loading') {
          if (newParagraphs && (newParagraphs.length !== currentParagraphs.length || newParagraphs[0] !== currentParagraphs[0])) {
            console.log('[TTS] Deteniendo reproducción por cambio manual de capítulo.');
            stop();
          }
        }

        // Cargar del mapa local los párrafos de la sección visible activa
        if (newParagraphs) {
          useTtsStore.getState().setParagraphs(newParagraphs);
        }

        // Guardar CFI con debounce de 1 s para no saturar IDB
        if (location?.start?.cfi) {
          const cfi = location.start.cfi;
          lastCfiRef.current = cfi;
          if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
          progressSaveTimerRef.current = setTimeout(() => {
            onProgressUpdate?.(cfi);
          }, 1000);
        }

        // Actualizar título del capítulo
        if (location && bookRef.current) {
          const currentHref = location.start.href;
          const nav = (bookRef.current as any).navigation;
          if (nav?.toc) {
            const findTitle = (tocItems: any[]): string | null => {
              for (const item of tocItems) {
                if (
                  item.href === currentHref ||
                  decodeURIComponent(item.href) === decodeURIComponent(currentHref) ||
                  item.href.split('#')[0] === currentHref.split('#')[0]
                ) {
                  return item.label;
                }
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

        // Sincronizar posición TTS solo cuando NO está reproduciendo
        if (status === 'idle' || status === 'paused') {
          try {
            const range = rendition.getRange(location.start.cfi);
            if (range) {
              let el = range.startContainer;
              if (el.nodeType === 3 && el.parentNode) {
                el = el.parentNode;
              }
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

      // Mostrar libro: restaurar posición guardada o ir al inicio
      const startCfi = initialCfi ?? null;
      await (startCfi ? rendition.display(startCfi) : rendition.display());
      if (isCancelled) return;

      const [metadata, navigation] = await Promise.all([
        book.loaded.metadata,
        book.loaded.navigation,
      ]);

      // --- Highlight Hover on Global Container (for SVG overlays) ---
      let containerHoverTimeout: any = null;
      const handleContainerMouseOver = (e: MouseEvent) => {
        const target = e.target as Element;
        let matchId: string | null = null;
        
        const matchClass = Array.from(target.classList || []).find(c => c.startsWith('custom-hl-'));
        if (matchClass) {
          matchId = matchClass.replace('custom-hl-', '');
        } else if (target.parentElement) {
          const parentClass = Array.from(target.parentElement.classList || []).find(c => c.startsWith('custom-hl-'));
          if (parentClass) matchId = parentClass.replace('custom-hl-', '');
        }

        if (matchId) {
          const match = highlightsRef.current.find(h => h.id === matchId);
          if (match && match.note) {
            if (containerHoverTimeout) clearTimeout(containerHoverTimeout);
            containerHoverTimeout = setTimeout(() => {
              const rect = target.getBoundingClientRect();
              onHighlightHover?.(match, { x: rect.left, y: rect.bottom });
            }, 200);
          }
        }
      };

      const handleContainerMouseOut = (e: MouseEvent) => {
        const target = e.target as Element;
        if (Array.from(target.classList || []).some(c => c.startsWith('custom-hl-')) || (target.parentElement && Array.from(target.parentElement.classList || []).some(c => c.startsWith('custom-hl-')))) {
          if (containerHoverTimeout) clearTimeout(containerHoverTimeout);
          containerHoverTimeout = setTimeout(() => {
            onHighlightHover?.(null);
          }, 300);
        }
      };

      containerRef.current?.addEventListener('mouseover', handleContainerMouseOver as EventListener);
      containerRef.current?.addEventListener('mouseout', handleContainerMouseOut as EventListener);
      (book as any)._hlHoverHandler = handleContainerMouseOver;
      (book as any)._hlOutHandler = handleContainerMouseOut;
      // -------------------------------------------------------------

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
      if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
      if (bookRef.current) {
        const handler = (bookRef.current as any)._globalKeyHandler;
        if (handler) window.removeEventListener('keydown', handler);

        const hlHover = (bookRef.current as any)._hlHoverHandler;
        const hlOut = (bookRef.current as any)._hlOutHandler;
        if (hlHover && containerRef.current) containerRef.current.removeEventListener('mouseover', hlHover);
        if (hlOut && containerRef.current) containerRef.current.removeEventListener('mouseout', hlOut);

        bookRef.current.destroy();
        bookRef.current = null;
        renditionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // -------------------------------------------------------
  // Actualizar tema al cambiar
  // -------------------------------------------------------
  useEffect(() => {
    renditionRef.current?.themes.select(theme);
  }, [theme]);

  // -------------------------------------------------------
  // Actualizar tipografía al cambiar
  // -------------------------------------------------------
  useEffect(() => {
    if (!renditionRef.current) return;
    applyTypography(renditionRef.current, fontFamily, fontSize, lineHeight);
  }, [fontFamily, fontSize, lineHeight]);

  // -------------------------------------------------------
  // Resaltado del párrafo activo de TTS + Auto-Paginación
  // -------------------------------------------------------
  useEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe?.contentDocument || !iframe.contentWindow) return;

    const currentText = ttsParagraphs[activeParagraphIndex] || '';
    const textChunks = splitIntoSentences(currentText);
    const sentenceText = textChunks[activeSentenceIndex] || currentText;

    const rect = highlightActiveParagraph(
      iframe.contentDocument,
      activeParagraphIndex,
      sentenceText
    );

    // Auto-paginación: si la frase o párrafo activo está fuera de la pantalla visible, navegar
    if (rect && useTtsStore.getState().status === 'playing') {
      const viewportWidth = iframe.contentWindow.innerWidth;

      if (rect.left >= viewportWidth) {
        renditionRef.current?.next();
      } else if (rect.right <= 0) {
        renditionRef.current?.prev();
      }
    }

    prevParagraphIndexRef.current = activeParagraphIndex;
  }, [activeParagraphIndex, activeSentenceIndex, ttsParagraphs]);

  // -------------------------------------------------------
  // Render highlights
  // -------------------------------------------------------
  useEffect(() => {
    if (!renditionRef.current) return;
    const rendition = renditionRef.current;

    highlights.forEach((hl) => {
      if (!renderedHighlightsRef.current.has(hl.id)) {
        try {
          // Extraer color real basado en el ID del color o usar el valor si es un color válido
          const colorMap: Record<string, string> = {
            yellow: '#ffc701',
            green: '#c7e372',
            blue: '#9ad0dc',
            pink: '#ef5a68'
          };
          const highlightColor = colorMap[hl.color] || hl.color || '#ffc701';

          rendition.annotations.highlight(
            hl.cfiRange,
            {},
            (e: Event) => {
              // Si se hace clic, también podemos mostrar/ocultar o hacer scroll
            },
            `custom-hl-${hl.id}`,
            { fill: highlightColor, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' }
          );
          renderedHighlightsRef.current.add(hl.id);
        } catch (e) {
          console.warn('[EpubViewer] Error rendering highlight:', e);
        }
      }
    });
  }, [highlights]);

  // -------------------------------------------------------
  // Navegación
  // -------------------------------------------------------
  const nextPage = useCallback(() => {
    renditionRef.current?.next();
  }, []);

  const prevPage = useCallback(() => {
    renditionRef.current?.prev();
  }, []);

  const goToChapter = useCallback((href: string) => {
    if (!renditionRef.current || !bookRef.current) return;

    const spine = (bookRef.current as any).spine;
    let targetHref = href;

    if (spine?.get) {
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
          } else {
            console.error('[EpubViewer] Capítulo no encontrado en el spine:', href);
            return;
          }
        }
      }
    }

    renditionRef.current.display(targetHref).catch((err) => {
      console.warn('[EpubViewer] Error al navegar al capítulo:', targetHref, err);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    goToChapter,
    nextPage,
    prevPage,
    getCurrentCfi: () => {
      const location = renditionRef.current?.location as any;
      return location?.start?.cfi;
    }
  }));

  return (
    <div className="epub-viewer-wrapper relative flex h-full w-full flex-col">
      {/* Envoltorio con padding horizontal */}
      <div
        className="flex-1 transition-all duration-300 w-full h-full"
        style={{ paddingLeft: `${marginX}%`, paddingRight: `${marginX}%`, minHeight: 0 }}
      >
        <div ref={containerRef} className="epub-canvas w-full h-full" />
      </div>

      {/* Controles de navegación de páginas */}
      <div className="epub-nav-controls absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none px-2">
        <button
          id="epub-prev-page"
          onClick={prevPage}
          aria-label="Página anterior"
          className="epub-nav-btn pointer-events-auto"
          title="Página anterior"
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        <button
          id="epub-next-page"
          onClick={nextPage}
          aria-label="Página siguiente"
          className="epub-nav-btn pointer-events-auto"
          title="Página siguiente"
        >
          <ChevronRight size={26} aria-hidden="true" />
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
}
