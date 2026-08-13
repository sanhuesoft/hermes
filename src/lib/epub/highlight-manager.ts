import type { Rendition } from 'epubjs';
import type { Highlight, HighlightColor } from '@/types/epub';

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 199, 1, 0.4)',
  green:  'rgba(199, 227, 114, 0.4)',
  blue:   'rgba(154, 208, 220, 0.4)',
  pink:   'rgba(239, 90, 104, 0.4)',
};

/**
 * Agrega un resaltado a la rendición de epubjs y retorna el objeto Highlight creado.
 */
export function addHighlight(
  rendition: Rendition,
  cfiRange: string,
  text: string,
  color: HighlightColor,
  note?: string
): Highlight {
  const highlight: Highlight = {
    id: `hl_${Date.now()}`,
    cfiRange,
    text,
    color,
    note,
    createdAt: new Date().toISOString(),
  };

  rendition.annotations.highlight(
    cfiRange,
    {},
    undefined,
    'hl',
    { fill: COLOR_MAP[color], 'fill-opacity': '1', 'mix-blend-mode': 'multiply' }
  );

  return highlight;
}

/**
 * Elimina un resaltado de la rendición de epubjs.
 */
export function removeHighlight(rendition: Rendition, cfiRange: string): void {
  rendition.annotations.remove(cfiRange, 'highlight');
}

/**
 * Re-aplica todos los highlights guardados (ej. al importar un sidecar).
 */
export function restoreHighlights(rendition: Rendition, highlights: Highlight[]): void {
  for (const hl of highlights) {
    rendition.annotations.highlight(
      hl.cfiRange,
      {},
      undefined,
      'hl',
      { fill: COLOR_MAP[hl.color], 'fill-opacity': '1', 'mix-blend-mode': 'multiply' }
    );
  }
}

/**
 * Aplica resaltado de frase/párrafo activo TTS (se remueve al avanzar).
 */
export function highlightActiveParagraph(
  iframeDocument: Document,
  index: number,
  sentenceText?: string
): void {
  // 1. Limpiar todos los resaltados anteriores (fondo heredado y Custom Highlights)
  const prevs = iframeDocument.querySelectorAll('[data-paragraph-index]');
  prevs.forEach((el) => {
    (el as HTMLElement).style.backgroundColor = '';
  });

  const iframeWindow = iframeDocument.defaultView as any;
  if (iframeWindow && 'CSS' in iframeWindow && 'highlights' in iframeWindow.CSS) {
    iframeWindow.CSS.highlights.delete('tts-active');
  }

  // 2. Buscar el párrafo actual
  const current = iframeDocument.querySelector<HTMLElement>(
    `[data-paragraph-index="${index}"]`
  );
  if (!current) return;

  // 3. Intentar aplicar Custom Highlight a la frase exacta
  if (sentenceText && sentenceText.trim() !== '' && iframeWindow && 'CSS' in iframeWindow && 'highlights' in iframeWindow.CSS) {
    const range = iframeDocument.createRange();
    let found = false;
    
    // Búsqueda simple en nodos de texto (funciona en párrafos sin HTML anidado complejo)
    const walker = iframeDocument.createTreeWalker(current, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.includes(sentenceText)) {
        const start = node.textContent.indexOf(sentenceText);
        range.setStart(node, start);
        range.setEnd(node, start + sentenceText.length);
        found = true;
        break;
      }
    }
    
    if (found) {
      const highlight = new iframeWindow.Highlight(range);
      iframeWindow.CSS.highlights.set('tts-active', highlight);
      return;
    }
  }

  // 4. Fallback: Resaltar todo el párrafo con gris suave si no hay API o no se encontró la frase
  current.style.backgroundColor = 'rgba(212, 221, 218, 0.4)';
}
