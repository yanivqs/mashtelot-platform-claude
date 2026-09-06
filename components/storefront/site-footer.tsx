import type { Nursery } from '@prisma/client';
import { Phone, MessageCircle } from 'lucide-react';

export function SiteFooter({ nursery }: { nursery: Nursery }) {
  const waNumber = nursery.whatsappNumber?.replace(/[^\d]/g, '');

  return (
    <footer className="mt-16 border-t border-gray-100 bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-right">
        <div>
          <p className="font-bold text-gray-900">{nursery.name}</p>
          <p className="mt-1 text-sm text-gray-500">
            © {new Date().getFullYear()} · כל הזכויות שמורות
          </p>
        </div>
        <div className="flex items-center gap-4">
          {nursery.phoneNumber && (
            <a
              href={`tel:${nursery.phoneNumber}`}
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Phone className="h-4 w-4" />
              {nursery.phoneNumber}
            </a>
          )}
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-900"
            >
              <MessageCircle className="h-4 w-4" />
              וואטסאפ
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
