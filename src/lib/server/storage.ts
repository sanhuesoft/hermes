import fs from 'fs';
import path from 'path';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const BOOKS_DIR = path.join(DATA_DIR, 'books');
export const COVERS_DIR = path.join(DATA_DIR, 'covers');
export const DB_FILE = path.join(DATA_DIR, 'library.db');

export function ensureDataDirs(): void {
  if (!fs.existsSync(/*turbopackIgnore: true*/ DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  }
  if (!fs.existsSync(/*turbopackIgnore: true*/ COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }
}

export async function saveBookFile(
  bookId: string,
  data: ArrayBuffer | Buffer
): Promise<string> {
  ensureDataDirs();
  const safeId = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeId}.epub`;
  const fullPath = path.join(BOOKS_DIR, fileName);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await fs.promises.writeFile(fullPath, buffer);
  return `books/${fileName}`;
}

export async function saveCoverFile(
  bookId: string,
  data: ArrayBuffer | Buffer,
  mimeType?: string | null
): Promise<{ relativePath: string; mimeType: string }> {
  ensureDataDirs();
  const safeId = bookId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let ext = 'jpg';
  let resolvedMime = mimeType || 'image/jpeg';

  if (mimeType?.includes('png')) {
    ext = 'png';
    resolvedMime = 'image/png';
  } else if (mimeType?.includes('webp')) {
    ext = 'webp';
    resolvedMime = 'image/webp';
  } else if (mimeType?.includes('gif')) {
    ext = 'gif';
    resolvedMime = 'image/gif';
  }

  const fileName = `${safeId}.${ext}`;
  const fullPath = path.join(COVERS_DIR, fileName);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await fs.promises.writeFile(fullPath, buffer);

  return {
    relativePath: `covers/${fileName}`,
    mimeType: resolvedMime,
  };
}

export function getFullPath(relativePath: string): string {
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, relativePath);
}

export async function deleteStorageFile(relativePath?: string | null): Promise<void> {
  if (!relativePath) return;
  try {
    const fullPath = getFullPath(relativePath);
    if (fs.existsSync(/*turbopackIgnore: true*/ fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.error(`Error al eliminar archivo ${relativePath}:`, err);
  }
}
