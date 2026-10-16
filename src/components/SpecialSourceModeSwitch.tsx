'use client';

import { useEffect, useState } from 'react';

import CapsuleSwitch from '@/components/CapsuleSwitch';

type SourceMode = 'normal' | 'special';

function readEntryEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const runtime = (
    window as Window & {
      RUNTIME_CONFIG?: { SPECIAL_SOURCE_SEARCH_ENABLED?: boolean };
    }
  ).RUNTIME_CONFIG;
  return runtime?.SPECIAL_SOURCE_SEARCH_ENABLED === true;
}

/**
 * 普通源 / 特殊源切换。
 * 只在服务端判定「站点有特殊源且当前用户能用」之后出现。
 */
export default function SpecialSourceModeSwitch({
  active,
  onChange,
}: {
  active: SourceMode;
  onChange: (next: SourceMode) => void;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readEntryEnabled());
  }, []);

  if (!enabled) return null;

  return (
    <div
      className='mt-4 flex max-w-full justify-center'
      role='group'
      aria-label='切换普通源与特殊源搜索'
    >
      <CapsuleSwitch
        options={[
          { label: '普通源', value: 'normal' },
          { label: '特殊源', value: 'special' },
        ]}
        active={active}
        onChange={(value) => onChange(value as SourceMode)}
      />
    </div>
  );
}
