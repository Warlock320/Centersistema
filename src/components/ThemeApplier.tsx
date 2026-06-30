'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ThemeApplier({ empresaId }: { empresaId: string | null }) {
  useEffect(() => {
    if (!empresaId) return;
    const supabase = createClient();
    supabase.from('empresas')
      .select('tema_cor_primaria, tema_cor_secundaria')
      .eq('id', empresaId).single()
      .then(({ data }) => {
        if (!data) return;
        const emp = data as { tema_cor_primaria: string | null; tema_cor_secundaria: string | null };
        if (emp.tema_cor_primaria) {
          document.documentElement.style.setProperty('--cor-primaria', emp.tema_cor_primaria);
          const hex = emp.tema_cor_primaria.replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          document.documentElement.style.setProperty('--cor-primaria-rgb', `${r}, ${g}, ${b}`);
        }
        if (emp.tema_cor_secundaria) {
          document.documentElement.style.setProperty('--cor-secundaria', emp.tema_cor_secundaria);
        }
      });
  }, [empresaId]);
  return null;
}
