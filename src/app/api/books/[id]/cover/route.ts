import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { books } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getFullPath, saveCoverFile, deleteStorageFile } from '@/lib/server/storage';
import fs from 'fs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();

    const book = db.select().from(books).where(eq(books.id, id)).get();
    if (!book || !book.coverRelativePath) {
      return NextResponse.json({ error: 'Portada no encontrada' }, { status: 404 });
    }

    const fullPath = getFullPath(book.coverRelativePath);
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Archivo de portada no encontrado' }, { status: 404 });
    }

    const stat = await fs.promises.stat(fullPath);
    const fileStream = fs.createReadStream(fullPath);

    const readableWebStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(readableWebStream, {
      status: 200,
      headers: {
        'Content-Type': book.coverMimeType || 'image/jpeg',
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error al servir portada:', error);
    return NextResponse.json({ error: 'Error al servir la portada' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const coverFile = formData.get('cover') as File | null;

    if (!coverFile) {
      return NextResponse.json({ error: 'No se envió ninguna imagen' }, { status: 400 });
    }

    const db = getDb();
    const book = db.select().from(books).where(eq(books.id, id)).get();
    if (!book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 });
    }

    // Borrar portada anterior si existía
    if (book.coverRelativePath) {
      await deleteStorageFile(book.coverRelativePath);
    }

    const buffer = await coverFile.arrayBuffer();
    const saved = await saveCoverFile(id, buffer, coverFile.type);

    db.update(books)
      .set({
        coverRelativePath: saved.relativePath,
        coverMimeType: saved.mimeType,
      })
      .where(eq(books.id, id))
      .run();

    return NextResponse.json({
      success: true,
      coverUrl: `/api/books/${encodeURIComponent(id)}/cover`,
      coverMimeType: saved.mimeType,
    });
  } catch (error) {
    console.error('Error al actualizar portada:', error);
    return NextResponse.json({ error: 'Error al actualizar la portada' }, { status: 500 });
  }
}
