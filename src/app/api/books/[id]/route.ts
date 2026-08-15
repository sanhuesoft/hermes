import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { books, highlights, bookmarks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { deleteStorageFile } from '@/lib/server/storage';
import type { LibraryBook, Highlight, Bookmark } from '@/types/epub';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();

    const book = db.select().from(books).where(eq(books.id, id)).get();
    if (!book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    const bookHighlights = db
      .select()
      .from(highlights)
      .where(eq(highlights.bookId, id))
      .all();

    const bookBookmarks = db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.bookId, id))
      .all();

    const result: LibraryBook = {
      id: book.id,
      folderId: book.folderId,
      fileName: book.fileName,
      coverUrl: book.coverRelativePath ? `/api/books/${encodeURIComponent(book.id)}/cover` : null,
      coverMimeType: book.coverMimeType,
      meta: {
        title: book.title,
        author: book.author,
        identifier: book.identifier,
        language: book.language,
        publisher: book.publisher || undefined,
        pubdate: book.pubdate || undefined,
      },
      addedAt: book.addedAt,
      lastOpenedAt: book.lastOpenedAt,
      lastCfi: book.lastCfi,
      highlights: bookHighlights.map((hl) => ({
        id: hl.id,
        cfiRange: hl.cfiRange,
        text: hl.text,
        color: hl.color as Highlight['color'],
        note: hl.note || undefined,
        createdAt: hl.createdAt,
      })),
      bookmarks: bookBookmarks.map((bm) => ({
        id: bm.id,
        cfi: bm.cfi,
        label: bm.label,
        createdAt: bm.createdAt,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener libro:', error);
    return NextResponse.json({ error: 'Error al obtener libro' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const updates: Partial<{
      folderId: string | null;
      lastCfi: string | null;
      lastOpenedAt: string | null;
      title: string;
      author: string;
    }> = {};

    if (body.folderId !== undefined) updates.folderId = body.folderId;
    if (body.lastCfi !== undefined) updates.lastCfi = body.lastCfi;
    if (body.lastOpenedAt !== undefined) updates.lastOpenedAt = body.lastOpenedAt;
    if (body.title !== undefined) updates.title = body.title;
    if (body.author !== undefined) updates.author = body.author;

    db.update(books).set(updates).where(eq(books.id, id)).run();

    return NextResponse.json({ success: true, id, updates });
  } catch (error) {
    console.error('Error al actualizar libro:', error);
    return NextResponse.json({ error: 'Error al actualizar libro' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();

    const book = db.select().from(books).where(eq(books.id, id)).get();
    if (!book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    // Eliminar archivos físicos
    await deleteStorageFile(book.fileRelativePath);
    if (book.coverRelativePath) {
      await deleteStorageFile(book.coverRelativePath);
    }

    // Eliminar de base de datos (highlights y bookmarks se eliminan en cascada)
    db.delete(books).where(eq(books.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar libro:', error);
    return NextResponse.json({ error: 'Error al eliminar libro' }, { status: 500 });
  }
}
