'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Building2, Save } from 'lucide-react';
import type { Empresa } from '@/types/database.types';

const REGIMES = [
  { value: 1, label: '1 — Simples Nacional' },
  { value: 2, label: '2 — Simples Nacional (excesso)' },
  { value: 3, label: '3 — Regime Normal (Lucro Presumido/Real)' },
];

const AMBIENTES = [
  { value: 2, label: 'Homologação (testes)' },
  { value: 1, label: 'Produção' },
];

export default function FiscalSection() {
  const toast = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    inscricao_estadual: '',
    inscricao_municipal: '',
    regime_tributario: 1,
    codigo_municipio: '',
    codigo_uf: '',
    cnae: '',
    numero: '',
    bairro: '',
    complemento: '',
    nfe_serie: 1,
    nfe_ambiente: 2,
    nfe_proximo_numero: 1,
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      if (!usr) return;
      const { data: emp } = await supabase.from('empresas').select('*').eq('id', (usr as { empresa_id: string }).empresa_id).single();
      if (emp) {
        const e = emp as Empresa;
        setForm({
          inscricao_estadual: e.inscricao_estadual || '',
          inscricao_municipal: e.inscricao_municipal || '',
          regime_tributario: e.regime_tributario || 1,
          codigo_municipio: e.codigo_municipio || '',
          codigo_uf: e.codigo_uf || '',
          cnae: e.cnae || '',
          numero: e.numero || '',
          bairro: e.bairro || '',
          complemento: e.complemento || '',
          nfe_serie: e.nfe_serie || 1,
          nfe_ambiente: e.nfe_ambiente || 2,
          nfe_proximo_numero: e.nfe_proximo_numero || 1,
        });
      }
      setLoading(false);
    })();
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      if (!usr) throw new Error('Usuário não encontrado');

      const { error } = await supabase.from('empresas').update({
        inscricao_estadual: form.inscricao_estadual || null,
        inscricao_municipal: form.inscricao_municipal || null,
        regime_tributario: form.regime_tributario,
        codigo_municipio: form.codigo_municipio || null,
        codigo_uf: form.codigo_uf || null,
        cnae: form.cnae || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        complemento: form.complemento || null,
        nfe_serie: form.nfe_serie,
        nfe_ambiente: form.nfe_ambiente,
        nfe_proximo_numero: form.nfe_proximo_numero,
      }).eq('id', (usr as { empresa_id: string }).empresa_id);

      if (error) throw error;
      toast.success('Configurações fiscais salvas.');
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-slate-400">Carregando...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <Building2 size={18} className="text-blue-500" />
        <h2 className="font-semibold text-slate-900">Dados Fiscais (NF-e)</h2>
      </div>

      <div className="px-6 py-6 space-y-5">
        <p className="text-sm text-slate-500">
          Configure os dados fiscais obrigatórios para emissão de NF-e.
          Estes dados aparecem no XML da nota e precisam estar corretos conforme a SEFAZ.
        </p>

        {/* Inscrições e regime */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Inscrição Estadual (IE) *</span>
            <input value={form.inscricao_estadual} onChange={(e) => setForm((p) => ({ ...p, inscricao_estadual: e.target.value }))}
              placeholder="123456789" className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Inscrição Municipal</span>
            <input value={form.inscricao_municipal} onChange={(e) => setForm((p) => ({ ...p, inscricao_municipal: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Regime Tributário *</span>
            <select value={form.regime_tributario} onChange={(e) => setForm((p) => ({ ...p, regime_tributario: Number(e.target.value) }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
              {REGIMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>

        {/* IBGE e endereço complementar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Código Município IBGE *</span>
            <input value={form.codigo_municipio} onChange={(e) => setForm((p) => ({ ...p, codigo_municipio: e.target.value }))}
              placeholder="3106200" maxLength={7} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
            <span className="text-[10px] text-slate-400">7 dígitos — consulte no site do IBGE</span>
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Código UF IBGE *</span>
            <input value={form.codigo_uf} onChange={(e) => setForm((p) => ({ ...p, codigo_uf: e.target.value }))}
              placeholder="31" maxLength={2} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
            <span className="text-[10px] text-slate-400">2 dígitos (ex: 31 = MG, 35 = SP)</span>
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs">CNAE</span>
            <input value={form.cnae} onChange={(e) => setForm((p) => ({ ...p, cnae: e.target.value }))}
              placeholder="4530703" maxLength={7} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Número (endereço)</span>
            <input value={form.numero} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
              placeholder="123" className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Bairro</span>
            <input value={form.bairro} onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
          </label>
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Complemento</span>
            <input value={form.complemento} onChange={(e) => setForm((p) => ({ ...p, complemento: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
          </label>
        </div>

        {/* NF-e */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Configurações da NF-e</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="text-slate-500 text-xs">Série</span>
              <input type="number" min={1} value={form.nfe_serie}
                onChange={(e) => setForm((p) => ({ ...p, nfe_serie: Number(e.target.value) || 1 }))}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
            </label>
            <label className="text-sm">
              <span className="text-slate-500 text-xs">Próximo número</span>
              <input type="number" min={1} value={form.nfe_proximo_numero}
                onChange={(e) => setForm((p) => ({ ...p, nfe_proximo_numero: Number(e.target.value) || 1 }))}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
            </label>
            <label className="text-sm">
              <span className="text-slate-500 text-xs">Ambiente *</span>
              <select value={form.nfe_ambiente} onChange={(e) => setForm((p) => ({ ...p, nfe_ambiente: Number(e.target.value) }))}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                {AMBIENTES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
          </div>
          {form.nfe_ambiente === 1 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Atenção:</strong> Ambiente de produção — as notas emitidas terão valor fiscal real.
            </div>
          )}
          {form.nfe_ambiente === 2 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Ambiente de homologação — as notas emitidas <strong>não têm valor fiscal</strong> (apenas testes).
            </div>
          )}
        </div>

        <Button onClick={handleSave} loading={saving}>
          <Save size={15} /> Salvar configurações fiscais
        </Button>
      </div>
    </div>
  );
}
