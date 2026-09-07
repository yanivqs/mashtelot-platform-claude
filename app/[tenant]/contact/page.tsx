import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { getNurseryByTenant } from '@/lib/tenant';
import { normalizeOpeningHours } from '@/lib/theme';
import { SocialLinks } from '@/components/storefront/social-links';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { tenant: string };
}): Promise<Metadata> {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};
  return {
    title: 'צור קשר',
    description: `פרטי התקשרות, מיקום ושעות פעילות של ${nursery.name}.`,
    alternates: { canonical: '/contact' },
  };
}

function mapEmbedSrc(link: string): string | null {
  if (/google\.[a-z.]+\/maps\/embed/i.test(link)) return link;
  return null;
}

export default async function ContactPage({ params }: { params: { tenant: string } }) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const hours = normalizeOpeningHours(nursery.openingHours);
  const address = [nursery.addressLine, nursery.city].filter(Boolean).join(', ');
  const embed = nursery.mapLink ? mapEmbedSrc(nursery.mapLink) : null;

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">צור קשר</h1>
      {nursery.aboutText?.trim() && (
        <p className="mt-4 max-w-2xl whitespace-pre-line leading-relaxed text-gray-600">
          {nursery.aboutText}
        </p>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          {nursery.phoneNumber && (
            <a href={`tel:${nursery.phoneNumber}`} className="flex items-center gap-3 text-gray-700 hover:text-brand-700">
              <Phone className="h-5 w-5 text-brand-600" />
              <span>{nursery.phoneNumber}</span>
            </a>
          )}
          {nursery.contactEmail && (
            <a href={`mailto:${nursery.contactEmail}`} className="flex items-center gap-3 text-gray-700 hover:text-brand-700">
              <Mail className="h-5 w-5 text-brand-600" />
              <span>{nursery.contactEmail}</span>
            </a>
          )}
          {address && (
            <div className="flex items-start gap-3 text-gray-700">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
              <span>
                {address}
                {nursery.mapLink && !embed && (
                  <>
                    {' · '}
                    <a
                      href={nursery.mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      פתח במפות
                    </a>
                  </>
                )}
              </span>
            </div>
          )}
          <SocialLinks nursery={nursery} className="pt-1" />
        </div>

        {hours.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
              <Clock className="h-5 w-5 text-brand-600" />
              שעות פעילות
            </p>
            <dl className="space-y-1.5 text-sm text-gray-600">
              {hours.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 border-b border-gray-100 py-1.5">
                  <dt>{row.label}</dt>
                  <dd className="text-gray-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {embed && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-100">
          <iframe
            src={embed}
            title="מפה"
            loading="lazy"
            className="h-80 w-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  );
}
