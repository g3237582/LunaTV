'use client';

import { useState } from 'react';

import { hasRenderableBookCover } from '@/lib/opds-entry';

function coverTone(title: string) {
  const tones = [
    'from-emerald-200 via-lime-100 to-amber-100 text-emerald-950 dark:from-emerald-900 dark:via-lime-950 dark:to-amber-950 dark:text-emerald-50',
    'from-sky-200 via-cyan-100 to-emerald-100 text-sky-950 dark:from-sky-900 dark:via-cyan-950 dark:to-emerald-950 dark:text-sky-50',
    'from-amber-200 via-orange-100 to-rose-100 text-amber-950 dark:from-amber-900 dark:via-orange-950 dark:to-rose-950 dark:text-amber-50',
    'from-violet-200 via-fuchsia-100 to-rose-100 text-violet-950 dark:from-violet-900 dark:via-fuchsia-950 dark:to-rose-950 dark:text-violet-50',
  ];
  const index = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

export default function BookCover({
  src,
  title,
  author,
  className = '',
}: {
  src?: string;
  title: string;
  author?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !failed && hasRenderableBookCover(src);

  if (showImage) {
    return (
      <div className='relative h-full w-full'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          className={`h-full w-full object-cover ${className}`.trim()}
          onError={() => setFailed(true)}
        />
        <div className='pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent opacity-80' />
      </div>
    );
  }

  return (
    <div
      className={`flex h-full w-full flex-col justify-end bg-gradient-to-br p-3 ${coverTone(title)} ${className}`.trim()}
    >
      <div className='line-clamp-3 text-sm font-semibold leading-5'>{title}</div>
      {author ? <div className='mt-1 line-clamp-1 text-[11px] opacity-75'>{author}</div> : null}
    </div>
  );
}
