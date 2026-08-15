import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { books } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getFullPath } from '@/lib/server/storage';
import fs from 'fs';

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

    const fullPath = getFullPath(book.fileRelativePath);
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'El archivo físico del libro no existe en el almacenamiento' },
        { status: 404 }
      );
    }

    const stat = await fs.promises.stat(fullPath);
    const fileStream = fs.createReadStream(fullPath);

    // Convert node read stream to web readable stream
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
        'Content-Type': 'application/epub+zip',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(book.fileName)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error al servir archivo EPUB:', error);
    return NextResponse.json({ error: 'Error al servir el archivo' }, { status: 500 });
  }
}
