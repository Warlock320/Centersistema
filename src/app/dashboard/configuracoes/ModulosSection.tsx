'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useModules } from '@/components/ModulesProvider';
import { Puzzle, Save } from 'lucide-react';
import { MODULO_INFO, DEFAULT_MODULOS, type ModulosEmpresa } from '@/lib/modules';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function ModulosSection() {
  const toast = useToast();
  const supabase = createClient();
  const { reload: reloadModules } = useModules();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ModulosEmpresa>({ ...DEFAULT_MODULOS });
  const [empresaId, setEmpresaId] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      if (!usr) return;
      const eid = (usr as { empresa_id: string }).empresa_id;
      setEmpresaId(eid);

      const { data: mod } = await supabase.from('modulos_empresa').select('*').eq('empresa_id', eid).maybeSingle();
      if (mod) {
        const m = { ...DEFAULT_MODULOS };
        for (const key of Object.keys(DEFAULT_MODULOS) as (keyof ModulosEmpresa)[]) {
          if (key in mod) m[key] = Boolean((mod as Record<string, unknown>)[key]);
        }
        setForm(m);
      }
      setLoading(false);
    })();
  }, [supabase]);

  async function handleSave() {
    if (!empresaId) return;
    setSaving(true);
    const { error } = await supabase.from('modulos_empresa').upsert({
      empresa_id: empresaId,
      ...form,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });

    if (error) toast.error('Erro ao salvar: ' + error.message);
    else { toast.success('Módulos atualizados! Recarregando menu...'); reloadModules(); }
    setSaving(false);
  }

  const ativos = Object.values(form).filter(Boolean).length;
  const total = Object.keys(form).length;

  if (loading) return <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-slate-400">Carregando...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Módulos do Sistema</h2>
        </div>
        <span className="text-xs text-slate-400">{ativos}/{total} ativos</span>
      </div>

      <div className="px-6 py-4">
        <p className="text-sm text-slate-500 mb-4">
          Ative apenas os módulos que sua empresa utiliza. Módulos desligados desaparecem do menu e das configurações.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(MODULO_INFO) as (keyof ModulosEmpresa)[]).map((key) => {
            const info = MODULO_INFO[key];
            const ativo = form[key];
            return (
              <div key={key} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                ativo ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl">{info.icone}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${ativo ? 'text-blue-800' : 'text-slate-500'}`}>{info.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{info.descricao}</p>
                  </div>
                </div>
                <Toggle checked={ativo} onChange={(v) => setForm((p) => ({ ...p, [key]: v }))} />
              </div>
            );
          })}
        </div>

        <Button onClick={handleSave} loading={saving} className="mt-4">
          <Save size={15} /> Salvar módulos
        </Button>
      </div>
    </div>
  );
}
