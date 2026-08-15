import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { DB_FILE, ensureDataDirs } from '../server/storage';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;

function initDatabase(): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
} {
  ensureDataDirs();

  const sqlite = new Database(DB_FILE);

  // Performance pragmas for SQLite
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  // Ensure tables exist automatically
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      file_relative_path TEXT NOT NULL,
      cover_relative_path TEXT,
      cover_mime_type TEXT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      identifier TEXT NOT NULL,
      language TEXT NOT NULL,
      publisher TEXT,
      pubdate TEXT,
      added_at TEXT NOT NULL,
      last_opened_at TEXT,
      last_cfi TEXT
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      cfi_range TEXT NOT NULL,
      text TEXT NOT NULL,
      color TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      cfi TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_books_folder_id ON books(folder_id);
    CREATE INDEX IF NOT EXISTS idx_highlights_book_id ON highlights(book_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_book_id ON bookmarks(book_id);
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function getDb() {
  if (!dbInstance) {
    const initialized = initDatabase();
    dbInstance = initialized.db;
    sqliteInstance = initialized.sqlite;
  }
  return dbInstance;
}

export { schema };
