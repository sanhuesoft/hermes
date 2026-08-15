import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { highlights } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { Highlight } from '@/types/epub';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();
    const list = db.select().from(highlights).where(eq(highlights.bookId, id)).all();

    const result: Highlight[] = list.map((hl) => ({
      id: hl.id,
      cfiRange: hl.cfiRange,
      text: hl.text,
      color: hl.color as Highlight['color'],
      note: hl.note || undefined,
      createdAt: hl.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al obtener highlights:', error);
    return NextResponse.json({ error: 'Error al obtener highlights' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const items: Highlight[] = body.highlights || [];

    const db = getDb();

    // Eliminar highlights anteriores e insertar los nuevos de forma atómica
    db.delete(highlights).where(eq(highlights.bookId, id)).run();

    if (items.length > 0) {
      for (const item of items) {
        db.insert(highlights)
          .values({
            id: item.id || `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            bookId: id,
            cfiRange: item.cfiRange,
            text: item.text,
            color: item.color,
            note: item.note || null,
            createdAt: item.createdAt || new Date().toISOString(),
          })
          .run();
      }
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Error al guardar highlights:', error);
    return NextResponse.json({ error: 'Error al guardar highlights' }, { status: 500 });
  }
}
