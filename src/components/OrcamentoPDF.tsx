'use client';

import dynamic from 'next/dynamic';
import { Button } from './ui/Button';
import { FileDown } from 'lucide-react';
import type { Orcamento } from '@/types/database.types';

interface Props {
  orcamento: Orcamento;
  empresaNome?: string;
}

const OrcamentoPDFButtonInner = dynamic(
  () => import('./OrcamentoPDFDocument'),
  {
    ssr: false,
    loading: () => (
      <Button variant="secondary" size="sm" disabled>
        <FileDown size={14} /> PDF
      </Button>
    ),
  }
);

export function OrcamentoPDFButton({ orcamento, empresaNome }: Props) {
  return <OrcamentoPDFButtonInner orcamento={orcamento} empresaNome={empresaNome} />;
}
