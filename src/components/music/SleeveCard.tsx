'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

import {
  MUSIC_FACE,
  MUSIC_FACE_BOTTOM,
  MUSIC_FACE_CAT,
  MUSIC_FACE_META,
  MUSIC_FACE_NAME,
  MUSIC_FACE_TOP,
  MUSIC_SLEEVE,
  MUSIC_SLEEVE_DISC,
  MUSIC_SLEEVE_DISC_LABEL,
} from './tokens';

/**
 * 热榜卡 = 一张唱片套，黑胶从右侧探出半个身位。
 *
 * 上游 /leaderboard/boards 只有 id/name/bangid，封面不是榜单列表自带的。
 * `cover` 由调用方传入：榜单自己的 pic 字段优先，否则用榜内第一首歌的专辑图。
 * 没有地址，或图片加载失败（防盗链、404）时，退回目录号版式，不留破图。
 *
 * 封面走 `<img referrerPolicy="no-referrer">`，和歌曲行、歌单卡同一套。
 * 网易云 / QQ / 酷我 / 酷狗图床拒的是外站 Referer，空 Referer 可以过；
 * 不走 next/image，也不改 remotePatterns。
 */
export default function SleeveCard({
  rank,
  name,
  meta,
  top,
  cover,
  onOpen,
}: {
  rank: number;
  name: string;
  meta?: string;
  top?: string;
  cover?: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const src = cover && !failed ? cover : '';
  const rankLabel = String(rank).padStart(2, '0');

  useEffect(() => {
    setFailed(false);
  }, [cover]);

  return (
    <button type='button' onClick={onOpen} className={MUSIC_SLEEVE}>
      <span className='relative block aspect-square w-full'>
        <span aria-hidden className={MUSIC_SLEEVE_DISC}>
          <span className={MUSIC_SLEEVE_DISC_LABEL} />
        </span>

        <span className={cn(MUSIC_FACE, src && 'text-white')}>
          {src ? (
            // 音乐图床要靠 referrerPolicy 过防盗链，不走 next/image，避免再改 remotePatterns。
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=''
              loading='lazy'
              referrerPolicy='no-referrer'
              onError={() => setFailed(true)}
              className='absolute inset-0 z-0 h-full w-full object-cover'
            />
          ) : null}
          {src ? (
            <span
              aria-hidden
              className='absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/35 to-black/25'
            />
          ) : null}
          {top ? <span className={MUSIC_FACE_TOP}>{top}</span> : null}
          {src ? (
            <span className='relative z-[2] self-start rounded-[2px] bg-black/45 px-1.5 py-0.5 font-music-mono text-[calc(12*var(--music-px))] font-semibold leading-none tracking-[-0.04em] text-white [font-variant-numeric:tabular-nums]'>
              {rankLabel}
            </span>
          ) : (
            <span className={MUSIC_FACE_CAT}>{rankLabel}</span>
          )}
          <span className={MUSIC_FACE_BOTTOM}>
            <span className={cn(MUSIC_FACE_NAME, src && 'text-white')}>
              {name}
            </span>
            {meta ? (
              <span className={cn(MUSIC_FACE_META, src && 'text-white/80')}>
                {meta}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}
