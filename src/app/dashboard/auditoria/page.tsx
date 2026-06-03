'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePermissions } from '@/components/PermissionsProvider';
import { ShieldAlert, Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import type { AuditLog } from '@/types/database.types';

const TABELA_LABEL: Record<string, string> = {
  clientes: 'Clientes', produtos: 'Produtos', fornecedores: 'Fornecedores', veiculos: 'Veículos',
  categorias: 'Categorias', tabelas_preco: 'Tabelas de Preço', precos_produto: 'Preços de Produto',
  contas_receber: 'Contas a Receber', contas_pagar: 'Contas a Pagar', contas_bancarias: 'Contas Bancárias',
  plano_contas: 'Plano de Contas', centros_custo: 'Centros de Custo',
  caixas: 'Caixa', movimentos_caixa: 'Movimentos de Caixa', reaberturas_caixa: 'Reaberturas de Caixa',
  aprovacoes_credito: 'Aprovações de Crédito', orcamentos: 'Orçamentos', orcamento_itens: 'Itens de Orçamento',
  pedidos: 'Pedidos', pedido_itens: 'Itens de Pedido', ordens_servico: 'Ordens de Serviço', os_itens: 'Itens de OS',
  movimentacoes_estoque: 'Movimentações de Estoque', nfe_importadas: 'NF-e', historico_cobrancas: 'Cobranças',
  usuarios: 'Usuários', permissoes_papel: 'Permissões', empresas: 'Empresa', unidades: 'Unidades', convites: 'Convites',
};
const OP_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  INSERT: { label: 'Criação', cls: 'bg-green-100 text-green-700', icon: Plus },
  UPDATE: { label: 'Alteração', cls: 'bg-blue-100 text-blue-700', icon: Pencil },
  DELETE: { label: 'Exclusão', cls: 'bg-red-100 text-red-700', icon: Trash2 },
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function AuditoriaPage() {
  const { can } = usePermissions();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  const [fTabela, setFTabela] = useState('');
  const [fOperacao, setFOperacao] = useState('');
  const [fDe, setFDe] = useState('');
  const [fAte, setFAte] = useState('');
  const [busca, setBusca] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchLogs(); }, [fTabela, fOperacao, fDe, fAte]);

  async function fetchLogs() {
    setLoading(true);
    let query = supabase
      .from('audit_log')
      .select('*, usuarios(nome)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (fTabela) query = query.eq('tabela', fTabela);
    if (fOperacao) query = query.eq('operacao', fOperacao);
    if (fDe) query = query.gte('created_at', fDe);
    if (fAte) query = query.lte('created_at', fAte + 'T23:59:59');
    const { data } = await query;
    setLogs((data as AuditLog[]) || []);
    setLoading(false);
  }

  if (!can('view_auditoria')) {
    return (
      <div className="py-16 text-center text-slate-400">
        <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
        <p>Área restrita ao administrador.</p>
      </div>
    );
  }

  const q = busca.toLowerCase();
  const filtrados = logs.filter((l) =>
    !q || (l.usuarios?.nome || '').toLowerCase().includes(q) ||
    (l.registro_id || '').toLowerCase().includes(q) ||
    (l.campos || []).join(',').toLowerCase().includes(q)
  );

  const tabelasUnicas = Array.from(new Set(logs.map((l) => l.tabela))).sort();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ShieldAlert size={22} /> Auditoria do Sistema</h1>
        <p className="text-slate-500 text-sm">Registro imutável de tudo que é criado, alterado e excluído — acesso exclusivo do administrador.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-44">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por usuário, registro ou campo..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <select value={fTabela} onChange={(e) => setFTabela(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg">
          <option value="">Todos os módulos</option>
          {tabelasUnicas.map((t) => <option key={t} value={t}>{TABELA_LABEL[t] || t}</option>)}
        </select>
        <select value={fOperacao} onChange={(e) => setFOperacao(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg">
          <option value="">Todas as ações</option>
          <option value="INSERT">Criação</option>
          <option value="UPDATE">Alteração</option>
          <option value="DELETE">Exclusão</option>
        </select>
        <div className="flex items-center gap-1 text-sm">
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="px-2 py-2 border border-slate-200 rounded-lg" />
          <span className="text-slate-400">até</span>
          <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="px-2 py-2 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-3 border-b border-slate-100 text-sm text-slate-500">{filtrados.length} registro(s) {logs.length >= 300 && '(mostrando os 300 mais recentes)'}</div>
          <div className="divide-y divide-slate-50">
            {filtrados.length === 0 ? (
              <p className="px-6 py-10 text-center text-slate-400 text-sm">Nenhum registro de auditoria.</p>
            ) : filtrados.map((l) => {
              const op = OP_META[l.operacao];
              const Icon = op.icon;
              const aberto = expandido === l.id;
              return (
                <div key={l.id}>
                  <button type="button" onClick={() => setExpandido(aberto ? null : l.id)}
                    className="w-full px-6 py-3 flex items-center gap-3 hover:bg-slate-50 text-left">
                    {aberto ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${op.cls}`}><Icon size={11} /> {op.label}</span>
                    <span className="text-sm font-medium text-slate-800 shrink-0">{TABELA_LABEL[l.tabela] || l.tabela}</span>
                    <span className="text-xs text-slate-400 truncate flex-1">
                      {l.operacao === 'UPDATE' && l.campos ? `alterou: ${l.campos.join(', ')}` : (l.registro_id ? `registro ${l.registro_id.slice(0, 8)}…` : '')}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0">{l.usuarios?.nome || (l.usuario_id ? '—' : 'sistema')}</span>
                    <span className="text-xs text-slate-400 shrink-0 w-36 text-right">{new Date(l.created_at).toLocaleString('pt-BR')}</span>
                  </button>
                  {aberto && (
                    <div className="px-12 pb-4 text-xs">
                      <DiffTable log={l} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffTable({ log }: { log: AuditLog }) {
  const antes = log.dados_antes || {};
  const depois = log.dados_depois || {};
  // Campos a exibir: alterados (UPDATE) ou todas as chaves (INSERT/DELETE)
  const keys = log.operacao === 'UPDATE'
    ? (log.campos || [])
    : Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]));
  const ocultar = ['updated_at', 'created_at'];
  const visiveis = keys.filter((k) => !ocultar.includes(k));

  if (visiveis.length === 0) return <p className="text-slate-400">Sem detalhes de campos.</p>;

  return (
    <table className="w-full border border-slate-100 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-slate-50 text-slate-400">
          <th className="px-3 py-1.5 text-left font-semibold">Campo</th>
          {log.operacao !== 'INSERT' && <th className="px-3 py-1.5 text-left font-semibold">Antes</th>}
          {log.operacao !== 'DELETE' && <th className="px-3 py-1.5 text-left font-semibold">Depois</th>}
        </tr>
      </thead>
      <tbody>
        {visiveis.map((k) => (
          <tr key={k} className="border-t border-slate-50">
            <td className="px-3 py-1.5 font-medium text-slate-600">{k}</td>
            {log.operacao !== 'INSERT' && <td className="px-3 py-1.5 text-red-600">{fmtVal((antes as Record<string, unknown>)[k])}</td>}
            {log.operacao !== 'DELETE' && <td className="px-3 py-1.5 text-green-700">{fmtVal((depois as Record<string, unknown>)[k])}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
