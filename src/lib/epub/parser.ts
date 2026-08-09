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
  // Capturar encabezados, párrafos y listas.
  // IMPORTANTE: Se filtra para no duplicar si un li contiene un p.
  const elements = Array.from(
    iframeDocument.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')
  ).filter(el => {
    // Si este elemento es un 'li' y tiene un 'p' hijo, lo ignoramos 
    // porque el 'p' hijo ya será capturado por el querySelector.
    if (el.tagName.toLowerCase() === 'li' && el.querySelector('p')) {
      return false;
    }
    return true;
  });

  const paragraphs: string[] = [];

  elements.forEach((el, index) => {
    el.setAttribute('data-paragraph-index', String(index));
    const text = el.textContent?.trim() ?? '';
    
    if (text.length > 0) {
      paragraphs.push(text);
    }
  });

  return paragraphs;
}
