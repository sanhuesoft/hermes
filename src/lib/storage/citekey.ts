import type { EpubMeta } from '@/types/epub';

export function getPublicationYear(pubdate?: string): string | null {
  return pubdate?.match(/\b\d{4}\b/)?.[0] ?? null;
}

function getAuthorKey(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  const surname = trimmed.includes(',') ? parts[0] : parts.at(-1);

  return (surname ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function createBaseCitekey(meta: Pick<EpubMeta, 'author' | 'pubdate'>): string | null {
  const authorKey = getAuthorKey(meta.author);
  const year = getPublicationYear(meta.pubdate);
  return authorKey && year ? `${authorKey}${year}` : null;
}

export function createUniqueCitekey(base: string, existingIds: Iterable<string>): string {
  const ids = new Set(existingIds);
  if (!ids.has(base)) return base;

  const suffixFor = (value: number) => {
    let suffix = '';
    let remaining = value;
    while (remaining > 0) {
      remaining -= 1;
      suffix = String.fromCharCode(97 + (remaining % 26)) + suffix;
      remaining = Math.floor(remaining / 26);
    }
    return suffix;
  };

  let counter = 1;
  let candidate = `${base}${suffixFor(counter)}`;
  while (ids.has(candidate)) {
    counter += 1;
    candidate = `${base}${suffixFor(counter)}`;
  }
  return candidate;
}
