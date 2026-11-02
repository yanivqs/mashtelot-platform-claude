'use client';

import { useState } from 'react';

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  return (
    <div className="w-full shrink-0 sm:w-72">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[current]} alt={title} className="h-56 w-full rounded-xl object-cover" />
      {images.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((src, i) => (
            <button key={src} type="button" aria-label={`תמונה ${i + 1}`} aria-pressed={i === current} onClick={() => setCurrent(i)} className={`overflow-hidden rounded-lg border-2 ${i === current ? 'border-brand-600' : 'border-transparent'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-12 w-12 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
