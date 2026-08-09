import type { Rendition } from 'epubjs';
import type { Highlight, HighlightColor } from '@/types/epub';

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 235, 59, 0.4)',
  green:  'rgba(76, 175, 80, 0.35)',
  blue:   'rgba(33, 150, 243, 0.35)',
  pink:   'rgba(233, 30, 99, 0.35)',
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
 * Aplica resaltado de párrafo activo TTS (se remueve al avanzar).
 */
export function highlightActiveParagraph(
  iframeDocument: Document,
  index: number,
  previousIndex?: number
): void {
  if (previousIndex !== undefined) {
    const prev = iframeDocument.querySelector<HTMLElement>(
      `[data-paragraph-index="${previousIndex}"]`
    );
    if (prev) {
      prev.style.backgroundColor = '';
    }
  }

  const current = iframeDocument.querySelector<HTMLElement>(
    `[data-paragraph-index="${index}"]`
  );
  if (current) {
    current.style.backgroundColor = 'rgba(255, 235, 59, 0.35)';
  }
}
