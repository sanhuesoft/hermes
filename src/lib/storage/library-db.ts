/**
 * library-db.ts
 *
 * Capa de acceso a IndexedDB para la biblioteca de libros.
 * Usa la API nativa sin dependencias externas.
 *
 * Stores:
 *   - "folders"  → LibraryFolder[]
 *   - "books"    → LibraryBook[]  (fileData se guarda como ArrayBuffer)
 */

import type { LibraryFolder, LibraryBook } from '@/types/epub';

const DB_NAME = 'ereader-library';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('folders')) {
        const foldersStore = db.createObjectStore('folders', { keyPath: 'id' });
        foldersStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('books')) {
        const booksStore = db.createObjectStore('books', { keyPath: 'id' });
        booksStore.createIndex('folderId', 'folderId');
        booksStore.createIndex('addedAt', 'addedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ----------------------------------------------------------------
// Helpers internos
// ----------------------------------------------------------------

function txGet<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function txGetAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function txPut(store: IDBObjectStore, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function txDelete(store: IDBObjectStore, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ----------------------------------------------------------------
// API — Carpetas
// ----------------------------------------------------------------

export async function getFolders(): Promise<LibraryFolder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readonly');
    const store = tx.objectStore('folders');
    txGetAll<LibraryFolder>(store).then(resolve).catch(reject);
  });
}

export async function saveFolder(folder: LibraryFolder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');
    txPut(store, folder).then(resolve).catch(reject);
  });
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');
    txDelete(store, id).then(resolve).catch(reject);
  });
}

// ----------------------------------------------------------------
// API — Libros
// ----------------------------------------------------------------

export async function getBooks(): Promise<LibraryBook[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly');
    const store = tx.objectStore('books');
    txGetAll<LibraryBook>(store).then(resolve).catch(reject);
  });
}

export async function getBook(id: string): Promise<LibraryBook | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly');
    const store = tx.objectStore('books');
    txGet<LibraryBook>(store, id).then(resolve).catch(reject);
  });
}

export async function saveBook(book: LibraryBook): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    txPut(store, book).then(resolve).catch(reject);
  });
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    txDelete(store, id).then(resolve).catch(reject);
  });
}
