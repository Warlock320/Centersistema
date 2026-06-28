'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';

interface Props {
  size?: number;
  rounded?: boolean;
  className?: string;
  src?: string | null;
}

export function Logo({ size = 40, rounded = true, className = '', src }: Props) {
  const [err, setErr] = useState(false);
  const shape = rounded ? 'rounded-full' : 'rounded-lg';

  // Sem logo definido ou erro ao carregar → ícone genérico
  if (!src || err) {
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
      src={src}
      alt="Logo"
      width={size}
      height={size}
      onError={() => setErr(true)}
      style={{ width: size, height: size }}
      className={`object-cover shrink-0 ${shape} ${className}`}
    />
  );
}
