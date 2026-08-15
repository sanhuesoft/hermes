import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { books, highlights, bookmarks } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { saveBookFile, saveCoverFile } from '@/lib/server/storage';
import type { LibraryBook, Highlight, Bookmark } from '@/types/epub';

export async function GET() {
  try {
    const db = getDb();
    const allBooks = db.select().from(books).orderBy(desc(books.addedAt)).all();
    const allHighlights = db.select().from(highlights).all();
    const allBookmarks = db.select().from(bookmarks).all();

    // Index highlights and bookmarks by bookId
    const hlMap = new Map<string, Highlight[]>();
    for (const hl of allHighlights) {
      const list = hlMap.get(hl.bookId) || [];
      list.push({
        id: hl.id,
        cfiRange: hl.cfiRange,
        text: hl.text,
        color: hl.color as Highlight['color'],
        note: hl.note || undefined,
        createdAt: hl.createdAt,
      });
      hlMap.set(hl.bookId, list);
    }

    const bmMap = new Map<string, Bookmark[]>();
    for (const bm of allBookmarks) {
      const list = bmMap.get(bm.bookId) || [];
      list.push({
        id: bm.id,
        cfi: bm.cfi,
        label: bm.label,
        createdAt: bm.createdAt,
      });
      bmMap.set(bm.bookId, list);
    }

    const result: LibraryBook[] = allBooks.map((b) => ({
      id: b.id,
      folderId: b.folderId,
      fileName: b.fileName,
      coverUrl: b.coverRelativePath ? `/api/books/${encodeURIComponent(b.id)}/cover` : null,
      coverMimeType: b.coverMimeType,
      meta: {
        title: b.title,
        author: b.author,
        identifier: b.identifier,
        language: b.language,
        publisher: b.publisher || undefined,
        pubdate: b.pubdate || undefined,
      },
      addedAt: b.addedAt,
      lastOpenedAt: b.lastOpenedAt,
      lastCfi: b.lastCfi,
      highlights: hlMap.get(b.id) || [],
      bookmarks: bmMap.get(b.id) || [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al listar libros:', error);
    return NextResponse.json({ error: 'Error al listar libros' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const id = (formData.get('id') as string)?.trim();
    const title = (formData.get('title') as string)?.trim();
    const author = (formData.get('author') as string)?.trim();
    const identifier = (formData.get('identifier') as string)?.trim() || id;
    const language = (formData.get('language') as string)?.trim() || 'es';
    const publisher = (formData.get('publisher') as string)?.trim() || null;
    const pubdate = (formData.get('pubdate') as string)?.trim() || null;
    const folderId = (formData.get('folderId') as string)?.trim() || null;
    const fileName = (formData.get('fileName') as string)?.trim() || file?.name || 'book.epub';

    if (!file || !id || !title || !author) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (archivo, ID, título o autor)' },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db.select().from(books).where(eq(books.id, id)).get();
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un libro con el identificador "${id}"` },
        { status: 409 }
      );
    }

    // Guardar archivo EPUB en el sistema de archivos
    const fileBuffer = await file.arrayBuffer();
    const fileRelativePath = await saveBookFile(id, fileBuffer);

    // Guardar portada si se envió
    const coverFile = formData.get('cover') as File | null;
    let coverRelativePath: string | null = null;
    let coverMimeType: string | null = null;

    if (coverFile && coverFile.size > 0) {
      const coverBuffer = await coverFile.arrayBuffer();
      const savedCover = await saveCoverFile(id, coverBuffer, coverFile.type);
      coverRelativePath = savedCover.relativePath;
      coverMimeType = savedCover.mimeType;
    }

    const addedAt = new Date().toISOString();

    db.insert(books)
      .values({
        id,
        folderId,
        fileName,
        fileRelativePath,
        coverRelativePath,
        coverMimeType,
        title,
        author,
        identifier,
        language,
        publisher,
        pubdate,
        addedAt,
        lastOpenedAt: null,
        lastCfi: null,
      })
      .run();

    const newBook: LibraryBook = {
      id,
      folderId,
      fileName,
      coverUrl: coverRelativePath ? `/api/books/${encodeURIComponent(id)}/cover` : null,
      coverMimeType,
      meta: {
        title,
        author,
        identifier,
        language,
        publisher: publisher || undefined,
        pubdate: pubdate || undefined,
      },
      addedAt,
      lastOpenedAt: null,
      lastCfi: null,
      highlights: [],
      bookmarks: [],
    };

    return NextResponse.json(newBook, { status: 201 });
  } catch (error) {
    console.error('Error al añadir libro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar el libro' },
      { status: 500 }
    );
  }
}
