import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { folders, books } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const db = getDb();
    db.update(folders).set({ name }).where(eq(folders.id, id)).run();

    return NextResponse.json({ success: true, id, name });
  } catch (error) {
    console.error('Error al actualizar carpeta:', error);
    return NextResponse.json({ error: 'Error al actualizar carpeta' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const db = getDb();

    // Actualizar libros que pertenecían a esta carpeta para dejarlos sin carpeta
    db.update(books).set({ folderId: null }).where(eq(books.folderId, id)).run();

    // Eliminar la carpeta
    db.delete(folders).where(eq(folders.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar carpeta:', error);
    return NextResponse.json({ error: 'Error al eliminar carpeta' }, { status: 500 });
  }
}
