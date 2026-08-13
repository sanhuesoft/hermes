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
 * Encuentra el Range exacto de una frase dentro de un párrafo,
 * soportando que la frase esté dividida en múltiples nodos de texto (ej. por tags <em> o <strong>).
 */
function findSentenceRange(paragraph: HTMLElement, sentenceText: string): Range | null {
  if (!sentenceText) return null;
  
  const doc = paragraph.ownerDocument;
  const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const textNodes: { node: Text; start: number; end: number }[] = [];
  
  let currentOffset = 0;
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent || '';
    textNodes.push({
      node: node as Text,
      start: currentOffset,
      end: currentOffset + text.length
    });
    currentOffset += text.length;
  }
  
  const pText = paragraph.textContent || '';
  const matchIndex = pText.indexOf(sentenceText);
  if (matchIndex === -1) return null;
  
  const matchStart = matchIndex;
  const matchEnd = matchIndex + sentenceText.length;
  
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  
  for (const tn of textNodes) {
    if (!startNode && matchStart >= tn.start && matchStart < tn.end) {
      startNode = tn.node;
      startOffset = matchStart - tn.start;
    }
    // Usamos <= para que si termina justo al final del nodo, lo atrape.
    // Si la longitud es 0, no entra.
    if (!endNode && matchEnd > tn.start && matchEnd <= tn.end) {
      endNode = tn.node;
      endOffset = matchEnd - tn.start;
    }
  }
  
  if (startNode && endNode) {
    const range = doc.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  }
  
  return null;
}

/**
 * Aplica resaltado de frase/párrafo activo TTS (se remueve al avanzar).
 */
export function highlightActiveParagraph(
  iframeDocument: Document,
  index: number,
  sentenceText?: string
): DOMRect | null {
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
  if (!current) return null;

  // 3. Intentar aplicar Custom Highlight a la frase exacta soportando HTML anidado
  if (sentenceText && sentenceText.trim() !== '' && iframeWindow && 'CSS' in iframeWindow && 'highlights' in iframeWindow.CSS) {
    const range = findSentenceRange(current, sentenceText);
    
    if (range) {
      const highlight = new iframeWindow.Highlight(range);
      iframeWindow.CSS.highlights.set('tts-active', highlight);
      return range.getBoundingClientRect();
    }
  }

  // 4. Fallback: Resaltar todo el párrafo con gris suave si no hay API o no se encontró la frase
  current.style.backgroundColor = 'rgba(212, 221, 218, 0.4)';
  return current.getBoundingClientRect();
}

/**
 * Encuentra el índice de la frase (sentence) bajo el cursor (x, y)
 */
export function getSentenceIndexFromPoint(
  iframeDocument: Document,
  x: number,
  y: number,
  sentences: string[]
): { sentenceIndex: number, paragraphIndex: number } | null {
  const docAny = iframeDocument as any;
  let range: Range | null = null;
  
  if (docAny.caretRangeFromPoint) {
    range = docAny.caretRangeFromPoint(x, y);
  } else if (docAny.caretPositionFromPoint) {
    const pos = docAny.caretPositionFromPoint(x, y);
    if (pos) {
      range = iframeDocument.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }

  if (!range) return null;

  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) return null;

  const paragraph = textNode.parentElement?.closest('[data-paragraph-index]') as HTMLElement;
  if (!paragraph) return null;

  const paragraphIndex = parseInt(paragraph.getAttribute('data-paragraph-index') || '-1', 10);
  if (paragraphIndex < 0) return null;

  // Buscar en qué frase cayó el clic basándose en los bounding rects de cada frase
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const range = findSentenceRange(paragraph, s);
    if (range) {
      const rects = range.getClientRects();
      for (let j = 0; j < rects.length; j++) {
        const r = rects[j];
        // Comprobar si el cursor está dentro del rect
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return { sentenceIndex: i, paragraphIndex };
        }
      }
    }
  }

  // Fallback: si no le dimos exacto a una frase pero sí al párrafo,
  // podríamos devolver la primera frase o -1. Por seguridad devolvemos -1 
  // para que el click no haga saltos raros.
  return { sentenceIndex: -1, paragraphIndex };
}

/**
 * Aplica el resaltado de hover a una frase específica
 */
export function highlightHoverSentence(
  iframeDocument: Document,
  paragraphIndex: number,
  sentenceText: string
): void {
  const iframeWindow = iframeDocument.defaultView as any;
  if (!iframeWindow || !('CSS' in iframeWindow) || !('highlights' in iframeWindow.CSS)) return;

  iframeWindow.CSS.highlights.delete('tts-hover');

  const current = iframeDocument.querySelector<HTMLElement>(
    `[data-paragraph-index="${paragraphIndex}"]`
  );
  if (!current || !sentenceText.trim()) return;

  const range = findSentenceRange(current, sentenceText);
  if (range) {
    const highlight = new iframeWindow.Highlight(range);
    iframeWindow.CSS.highlights.set('tts-hover', highlight);
  }
}

/**
 * Limpia el resaltado de hover
 */
export function clearHoverSentence(iframeDocument: Document): void {
  const iframeWindow = iframeDocument.defaultView as any;
  if (iframeWindow && 'CSS' in iframeWindow && 'highlights' in iframeWindow.CSS) {
    iframeWindow.CSS.highlights.delete('tts-hover');
  }
}
