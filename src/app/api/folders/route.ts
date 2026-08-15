import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { folders } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();
    const allFolders = db.select().from(folders).orderBy(asc(folders.createdAt)).all();
    return NextResponse.json(allFolders);
  } catch (error) {
    console.error('Error al obtener carpetas:', error);
    return NextResponse.json({ error: 'Error al obtener carpetas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const id = body.id || `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = body.createdAt || new Date().toISOString();

    const db = getDb();
    db.insert(folders).values({ id, name, createdAt }).run();

    return NextResponse.json({ id, name, createdAt }, { status: 201 });
  } catch (error) {
    console.error('Error al crear carpeta:', error);
    return NextResponse.json({ error: 'Error al crear carpeta' }, { status: 500 });
  }
}
