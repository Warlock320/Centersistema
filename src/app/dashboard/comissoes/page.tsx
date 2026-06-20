'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/components/PermissionsProvider';
import { Percent, Save, Search } from 'lucide-react';
import type { ComissaoConfig } from '@/types/database.types';

interface VendedorComissao {
  usuario_id: string;
  nome: string;
  percentual: number;
  ativo: boolean;
  config_id: string | null;
}

interface ResumoComissao {
  usuario_id: string;
  nome: string;
  percentual: number;
  faturamento: number;
  comissao: number;
}

export default function ComissoesPage() {
  const supabase = createClient();
  const { can } = usePermissions();

  const [vendedores, setVendedores] = useState<VendedorComissao[]>([]);
  const [resumo, setResumo] = useState<ResumoComissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');

  const fetchVendedores = useCallback(async () => {
    setLoading(true);
    // Buscar todos os usuários ativos
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');

    // Buscar configs de comissão existentes
    const { data: configs } = await supabase
      .from('comissao_config')
      .select('*');

    const configMap = new Map<string, ComissaoConfig>();
    (configs || []).forEach((c: ComissaoConfig) => configMap.set(c.usuario_id, c));

    const lista: VendedorComissao[] = (usuarios || []).map((u: { id: string; nome: string }) => {
      const cfg = configMap.get(u.id);
      return {
        usuario_id: u.id,
        nome: u.nome,
        percentual: cfg?.percentual ?? 5,
        ativo: cfg?.ativo ?? true,
        config_id: cfg?.id ?? null,
      };
    });

    setVendedores(lista);
    setLoading(false);
  }, []);

  const fetchResumo = useCallback(async () => {
    if (!mesSelecionado) return;
    setLoadingResumo(true);

    const [ano, mes] = mesSelecionado.split('-').map(Number);
    const inicio = new Date(ano, mes - 1, 1).toISOString();
    const fim = new Date(ano, mes, 0, 23, 59, 59).toISOString();

    // Buscar pedidos faturados no mês, com os dados do orçamento para saber o vendedor
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, total, orcamento_id, created_at')
      .eq('status', 'faturado')
      .gte('created_at', inicio)
      .lte('created_at', fim);

    if (!pedidos || pedidos.length === 0) {
      setResumo([]);
      setLoadingResumo(false);
      return;
    }

    // Buscar orçamentos associados para pegar o usuario_id (vendedor)
    const orcIds = [...new Set((pedidos || []).map((p: { orcamento_id: string | null }) => p.orcamento_id).filter(Boolean))];
    let orcMap = new Map<string, string>();

    if (orcIds.length > 0) {
      const { data: orcs } = await supabase
        .from('orcamentos')
        .select('id, usuario_id')
        .in('id', orcIds);
      (orcs || []).forEach((o: { id: string; usuario_id: string }) => orcMap.set(o.id, o.usuario_id));
    }

    // Agrupar faturamento por vendedor
    const fatMap = new Map<string, number>();
    (pedidos || []).forEach((p: { total: number; orcamento_id: string | null }) => {
      const vendedorId = p.orcamento_id ? orcMap.get(p.orcamento_id) : null;
      if (vendedorId) {
        fatMap.set(vendedorId, (fatMap.get(vendedorId) || 0) + p.total);
      }
    });

    // Montar resumo
    const lista: ResumoComissao[] = vendedores
      .filter((v) => fatMap.has(v.usuario_id))
      .map((v) => {
        const fat = fatMap.get(v.usuario_id) || 0;
        return {
          usuario_id: v.usuario_id,
          nome: v.nome,
          percentual: v.percentual,
          faturamento: fat,
          comissao: fat * (v.percentual / 100),
        };
      })
      .sort((a, b) => b.faturamento - a.faturamento);

    setResumo(lista);
    setLoadingResumo(false);
  }, [mesSelecionado, vendedores]);

  useEffect(() => { fetchVendedores(); }, [fetchVendedores]);
  useEffect(() => {
    if (vendedores.length > 0) fetchResumo();
  }, [fetchResumo, vendedores]);

  async function handleSave(v: VendedorComissao) {
    setSaving(v.usuario_id);

    // Buscar empresa_id
    const { data: me } = await supabase.from('usuarios').select('empresa_id').limit(1).single();
    const empresaId = me?.empresa_id;
    if (!empresaId) { setSaving(null); return; }

    if (v.config_id) {
      await supabase.from('comissao_config').update({
        percentual: v.percentual,
        ativo: v.ativo,
      }).eq('id', v.config_id);
    } else {
      const { data: inserted } = await supabase.from('comissao_config').insert({
        empresa_id: empresaId,
        usuario_id: v.usuario_id,
        percentual: v.percentual,
        ativo: v.ativo,
      }).select().single();
      if (inserted) {
        setVendedores((prev) =>
          prev.map((x) => x.usuario_id === v.usuario_id ? { ...x, config_id: inserted.id } : x)
        );
      }
    }

    setSaving(null);
  }

  function handlePercentChange(userId: string, val: string) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setVendedores((prev) =>
      prev.map((v) => v.usuario_id === userId ? { ...v, percentual: num } : v)
    );
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const filteredVendedores = vendedores.filter((v) =>
    v.nome.toLowerCase().includes(search.toLowerCase())
  );

  const totalFaturamento = resumo.reduce((s, r) => s + r.faturamento, 0);
  const totalComissao = resumo.reduce((s, r) => s + r.comissao, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comissões de Vendedores</h1>
          <p className="text-sm text-slate-500 mt-1">Configure o percentual de comissão e acompanhe os resultados</p>
        </div>
      </div>

      {/* Configuração de % por vendedor */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Percent size={18} className="text-blue-600" />
            Percentual por Vendedor
          </h2>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400">Carregando...</div>
        ) : filteredVendedores.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">Nenhum vendedor encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comissão (%)</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ativo</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendedores.map((v) => (
                  <tr key={v.usuario_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-800">{v.nome}</td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={v.percentual}
                        onChange={(e) => handlePercentChange(v.usuario_id, e.target.value)}
                        disabled={!can('edit_financeiro')}
                        className="w-20 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() =>
                          setVendedores((prev) =>
                            prev.map((x) =>
                              x.usuario_id === v.usuario_id ? { ...x, ativo: !x.ativo } : x
                            )
                          )
                        }
                        disabled={!can('edit_financeiro')}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                          v.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {v.ativo ? 'Sim' : 'Não'}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-center">
                      {can('edit_financeiro') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={saving === v.usuario_id}
                          onClick={() => handleSave(v)}
                        >
                          <Save size={14} />
                          Salvar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Relatório de comissão mensal */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Relatório de Comissão Mensal</h2>
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {loadingResumo ? (
          <div className="px-6 py-12 text-center text-slate-400">Calculando...</div>
        ) : resumo.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            Nenhum faturamento encontrado para o período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturamento</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">%</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map((r) => (
                  <tr key={r.usuario_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-800">{r.nome}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{fmt(r.faturamento)}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{r.percentual}%</td>
                    <td className="px-6 py-3 text-right font-semibold text-green-700">{fmt(r.comissao)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-6 py-3 font-bold text-slate-900">Total</td>
                  <td className="px-6 py-3 text-right font-bold text-slate-900">{fmt(totalFaturamento)}</td>
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3 text-right font-bold text-green-700">{fmt(totalComissao)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
