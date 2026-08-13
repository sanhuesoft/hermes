import Epub, { Book } from 'epubjs';
import type { EpubMeta, Chapter } from '@/types/epub';

/**
 * Carga un archivo EPUB desde un objeto File del navegador (100% local, sin red).
 * Retorna la instancia de Book de epubjs para controlar el rendition.
 */
export async function loadEpubFromFile(file: File): Promise<Book> {
  const arrayBuffer = await file.arrayBuffer();
  const book = Epub(arrayBuffer);
  await book.ready;
  return book;
}

/**
 * Extrae la metadata principal del libro (título, autor, identificador, idioma).
 */
export async function getEpubMeta(book: Book): Promise<EpubMeta> {
  const metadata = await book.loaded.metadata;
  const coverUrl = await book.coverUrl().catch(() => undefined);

  return {
    title: metadata.title || 'Sin título',
    author: metadata.creator || 'Desconocido',
    identifier: metadata.identifier || '',
    language: metadata.language || 'es',
    publisher: metadata.publisher,
    cover: coverUrl ?? undefined,
  };
}

/**
 * Extrae la tabla de contenidos (TOC) del libro en formato plano de capítulos.
 */
export async function getTableOfContents(book: Book): Promise<Chapter[]> {
  const navigation = await book.loaded.navigation;

  function mapItems(items: typeof navigation.toc): Chapter[] {
    return items.map((item) => ({
      id: item.id,
      href: item.href,
      label: item.label.trim(),
      subitems: item.subitems ? mapItems(item.subitems) : undefined,
    }));
  }

  return mapItems(navigation.toc);
}

/**
 * Extrae el texto de un capítulo renderizado para TTS.
 * @param iframeDocument - El documento del iframe del rendition
 */
export function extractParagraphs(iframeDocument: Document): string[] {
  // Capturar todo tipo de contenedor de texto común
  const elements = Array.from(
    iframeDocument.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div')
  ).filter(el => {
    const tag = el.tagName.toLowerCase();
    
    // Si el elemento es un contenedor genérico, solo lo aceptamos si es la "hoja" final
    // (es decir, no contiene otros bloques dentro de sí mismo, para evitar extraer el texto duplicado)
    if (tag === 'div' || tag === 'li' || tag === 'blockquote') {
      const hasBlockChild = Array.from(el.children).some(child => 
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div'].includes(child.tagName.toLowerCase())
      );
      if (hasBlockChild) return false;
    }
    
    return true;
  });

  const paragraphs: string[] = [];

  // Asignamos índices solo a los elementos que realmente pasaron el filtro y tienen texto
  let actualIndex = 0;
  elements.forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (text.length > 0) {
      el.setAttribute('data-paragraph-index', String(actualIndex));
      paragraphs.push(text);
      actualIndex++;
    }
  });

  return paragraphs;
}
