import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number (or Prisma Decimal) as ILS currency. */
export function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
}

/**
 * Build a URL-safe, SEO-friendly slug: "<title>--<id>".
 * The double dash separates the human part from the (dash-containing) UUID.
 */
export function productSlug(id: string, title: string): string {
  const clean = title
    .trim()
    .replace(/['"״׳]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${clean}--${id}`;
}

/** Extract the id fragment produced by productSlug. */
export function idFromSlug(slug: string): string {
  const idx = slug.lastIndexOf('--');
  return idx === -1 ? slug : slug.slice(idx + 2);
}
