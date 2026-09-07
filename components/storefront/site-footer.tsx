import Link from 'next/link';
import type { Nursery } from '@prisma/client';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { normalizeOpeningHours } from '@/lib/theme';
import { SocialLinks } from './social-links';

export function SiteFooter({ nursery }: { nursery: Nursery }) {
  const hours = normalizeOpeningHours(nursery.openingHours);
  const address = [nursery.addressLine, nursery.city].filter(Boolean).join(', ');

  return (
    <footer className="mt-16 border-t border-gray-100 bg-gray-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-base font-bold text-gray-900">{nursery.name}</p>
          {nursery.aboutText?.trim() && (
            <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-500">
              {nursery.aboutText}
            </p>
          )}
          <SocialLinks nursery={nursery} className="mt-4" />
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">יצירת קשר</p>
          {nursery.phoneNumber && (
            <a href={`tel:${nursery.phoneNumber}`} className="flex items-center gap-2 hover:text-gray-900">
              <Phone className="h-4 w-4 text-brand-600" />
              {nursery.phoneNumber}
            </a>
          )}
          {nursery.contactEmail && (
            <a href={`mailto:${nursery.contactEmail}`} className="flex items-center gap-2 hover:text-gray-900">
              <Mail className="h-4 w-4 text-brand-600" />
              {nursery.contactEmail}
            </a>
          )}
          {address && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                {address}
                {nursery.mapLink && (
                  <>
                    {' · '}
                    <a
                      href={nursery.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      במפה
                    </a>
                  </>
                )}
              </span>
            </p>
          )}
        </div>

        {hours.length > 0 && (
          <div className="space-y-1.5 text-sm text-gray-600">
            <p className="flex items-center gap-2 font-semibold text-gray-900">
              <Clock className="h-4 w-4 text-brand-600" />
              שעות פעילות
            </p>
            {hours.map((row) => (
              <p key={row.label} className="flex justify-between gap-4">
                <span>{row.label}</span>
                <span className="text-gray-500">{row.value}</span>
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gray-900">ניווט</p>
          <Link href="/catalog" className="block text-gray-600 hover:text-gray-900">קטלוג</Link>
          <Link href="/contact" className="block text-gray-600 hover:text-gray-900">צור קשר</Link>
          <Link href="/cart" className="block text-gray-600 hover:text-gray-900">עגלת קניות</Link>
        </div>
      </div>

      <div className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {nursery.name} · כל הזכויות שמורות
      </div>
    </footer>
  );
}
