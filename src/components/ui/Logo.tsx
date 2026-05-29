'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';

interface Props {
  size?: number;
  rounded?: boolean;
  className?: string;
}

/**
 * Logo da empresa. Usa /public/logo.png.
 * Se o arquivo não existir, mostra um fallback (ícone) para não quebrar o layout.
 */
export function Logo({ size = 40, rounded = true, className = '' }: Props) {
  const [err, setErr] = useState(false);
  const shape = rounded ? 'rounded-full' : 'rounded-lg';

  if (err) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-blue-600 flex items-center justify-center shrink-0 ${shape} ${className}`}
      >
        <Package size={Math.round(size * 0.5)} className="text-white" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Center Auto Peças"
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{ width: size, height: size }}
      className={`object-cover shrink-0 ${shape} ${className}`}
    />
  );
}
