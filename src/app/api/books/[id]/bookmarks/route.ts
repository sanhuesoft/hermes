import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { bookmarks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Bookmark } from '@/types/epub';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();
    const list = db.select().from(bookmarks).where(eq(bookmarks.bookId, id)).all();

    const result: Bookmark[] = list.map((bm) => ({
      id: bm.id,
      cfi: bm.cfi,
      label: bm.label,
      createdAt: bm.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener bookmarks:', error);
    return NextResponse.json({ error: 'Error al obtener bookmarks' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const items: Bookmark[] = body.bookmarks || [];

    const db = getDb();

    // Eliminar marcadores anteriores e insertar los nuevos
    db.delete(bookmarks).where(eq(bookmarks.bookId, id)).run();

    if (items.length > 0) {
      for (const item of items) {
        db.insert(bookmarks)
          .values({
            id: item.id || `bm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            bookId: id,
            cfi: item.cfi,
            label: item.label || 'Marcador',
            createdAt: item.createdAt || new Date().toISOString(),
          })
          .run();
      }
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Error al guardar bookmarks:', error);
    return NextResponse.json({ error: 'Error al guardar bookmarks' }, { status: 500 });
  }
}
