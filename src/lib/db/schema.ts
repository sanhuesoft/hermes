import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const books = sqliteTable('books', {
  id: text('id').primaryKey(), // citekey
  folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  fileName: text('file_name').notNull(),
  fileRelativePath: text('file_relative_path').notNull(),
  coverRelativePath: text('cover_relative_path'),
  coverMimeType: text('cover_mime_type'),
  title: text('title').notNull(),
  author: text('author').notNull(),
  identifier: text('identifier').notNull(),
  language: text('language').notNull(),
  publisher: text('publisher'),
  pubdate: text('pubdate'),
  addedAt: text('added_at').notNull(),
  lastOpenedAt: text('last_opened_at'),
  lastCfi: text('last_cfi'),
});

export const highlights = sqliteTable('highlights', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  cfiRange: text('cfi_range').notNull(),
  text: text('text').notNull(),
  color: text('color').notNull(), // 'yellow' | 'green' | 'blue' | 'pink'
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

export const bookmarks = sqliteTable('bookmarks', {
  id: text('id').primaryKey(),
  bookId: text('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  cfi: text('cfi').notNull(),
  label: text('label').notNull(),
  createdAt: text('created_at').notNull(),
});
