'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Combobox, type ComboOption } from '@/components/ui/Combobox';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/PermissionsProvider';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import {
  Store, Plus, Search, Trash2, Check, X, MapPin, Package, ShoppingBag, CheckCircle2, Ban, Printer, FileText, ArrowRight,
} from 'lucide-react';
import type { Comanda, ComandaItem, Produto } from '@/types/database.types';

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

type ProdBusca = Pick<Produto, 'id' | 'codigo' | 'ref' | 'nome' | 'aplicacoes' | 'localizacao' | 'estoque' | 'preco' | 'codigos_auxiliares'>;

export default function BalcaoPage() {
  const supabase = createClient();
  const toast = useToast();
  const { can } = usePermissions();
  const podeOperar = can('operar_balcao');

  const [empresaId, setEmpresaId] = useState('');
  const [empresa, setEmpresa] = useState<{ nome: string | null; razao_social: string | null; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null; telefone: string | null } | null>(null);
  const [meuNome, setMeuNome] = useState('');
  const [unidadePadrao, setUnidadePadrao] = useState<string | null>(null);
  const [cupom, setCupom] = useState<{ numero: number; cliente: string | null; itens: ComandaItem[]; total: number } | null>(null);
  const [abertas, setAbertas] = useState<Comanda[]>([]);
  const [pendentes, setPendentes] = useState<Comanda[]>([]);
  const [orcamentos, setOrcamentos] = useState<Comanda[]>([]);
  const [clientes, setClientes] = useState<ComboOption[]>([]);
  const [produtos, setProdutos] = useState<ProdBusca[]>([]);
  const [loading, setLoading] = useState(true);

  // Comanda em edição
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [itens, setItens] = useState<ComandaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [ultima, setUltima] = useState<number | null>(null);

  // Busca de produto (F7)
  const [showBusca, setShowBusca] = useState(false);
  const [busca, setBusca] = useState('');

  const getEmpresaId = useCallback(async () => {
    if (empresaId) return empresaId;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const eid = (data as { empresa_id: string })?.empresa_id || '';
    setEmpresaId(eid);
    return eid;
  }, [empresaId]);

  const fetchBase = useCallback(async () => {
    setLoading(true);
    const sel = '*, clientes(nome), vendedores:usuarios!comandas_vendedor_id_fkey(nome)';
    const [ab, pe, orc, cli, prod, uni] = await Promise.all([
      supabase.from('comandas').select(sel).eq('status', 'aberta').order('created_at', { ascending: false }),
      supabase.from('comandas').select(sel).eq('status', 'aguardando_caixa').order('created_at', { ascending: false }),
      supabase.from('comandas').select(sel).eq('status', 'orcamento').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome, telefone').eq('ativo', true).order('nome').limit(500),
      supabase.from('produtos').select('id, codigo, ref, nome, aplicacoes, localizacao, estoque, preco, codigos_auxiliares').eq('ativo', true).order('nome').limit(2000),
      supabase.from('unidades').select('id').eq('ativo', true).order('padrao', { ascending: false }).limit(1),
    ]);
    setUnidadePadrao(((uni.data as { id: string }[]) || [])[0]?.id || null);
    setAbertas((ab.data as unknown as Comanda[]) || []);
    setPendentes((pe.data as unknown as Comanda[]) || []);
    setOrcamentos((orc.data as unknown as Comanda[]) || []);
    setClientes(((cli.data as { id: string; nome: string; telefone: string | null }[]) || []).map((c) => ({ value: c.id, label: c.nome, sublabel: c.telefone || undefined, keywords: `${c.nome} ${c.telefone || ''}` })));
    setProdutos((prod.data as ProdBusca[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { getEmpresaId(); fetchBase(); fetchCabecalho(); }, []);

  async function fetchCabecalho() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: u } = await supabase.from('usuarios').select('nome, empresa_id').eq('id', user.id).single();
    setMeuNome((u as { nome?: string })?.nome || '');
    const eid = (u as { empresa_id?: string })?.empresa_id;
    if (eid) {
      const { data: e } = await supabase.from('empresas').select('nome, razao_social, endereco, cidade, estado, cep, telefone').eq('id', eid).single();
      setEmpresa(e as typeof empresa);
    }
  }

  // Monta o texto do cupom (80mm, ~48 colunas) e abre a janela de impressão
  function montarCupom(numero: number, clienteNome: string | null, its: ComandaItem[], tot: number) {
    const W = 48;
    const linha = (c = '=') => c.repeat(W);
    const dois = (a: string, b: string) => { const s = Math.max(1, W - a.length - b.length); return a + ' '.repeat(s) + b; };
    const dinheiro = (v: number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const L: string[] = [];
    L.push((empresa?.razao_social || empresa?.nome || 'EMPRESA').toUpperCase());
    if (empresa?.endereco) L.push(empresa.endereco.toUpperCase());
    const loc = [empresa?.cep, [empresa?.cidade, empresa?.estado].filter(Boolean).join('/')].filter(Boolean).join(' - ');
    if (loc) L.push(loc.toUpperCase());
    if (empresa?.telefone) L.push('FONE: ' + empresa.telefone);
    L.push(linha('='));
    L.push(dois('ORCAMENTO / PRE-VENDA', new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })));
    L.push(dois('NUMERO: PREV.' + String(numero).padStart(6, '0'), (meuNome || '').toUpperCase().slice(0, 18)));
    L.push(linha('-'));
    L.push('CLIENTE: ' + (clienteNome || 'CONSUMIDOR FINAL').toUpperCase());
    L.push(linha('-'));
    L.push('CODIGO PROD.  DESCRICAO DO PRODUTO');
    L.push(linha('-'));
    its.forEach((it) => {
      const cod = produtos.find((p) => p.id === it.produto_id)?.codigo || '';
      L.push(((cod ? cod + ' ' : '') + it.descricao.toUpperCase()).slice(0, W));
      L.push(dois('', 'R$' + dinheiro(Number(it.preco_unitario)) + ' X ' + Number(it.quantidade) + ' UN = R$' + dinheiro(Number(it.total))));
    });
    L.push(linha('-'));
    L.push(dois('', '$ TOTAL DA PRE-VENDA: ' + dinheiro(tot)));
    L.push('');
    L.push('ASSINATURA DO RECEBEDOR:');
    L.push('');
    L.push(linha('='));
    return L.join('\n');
  }

  function imprimirCupom(texto: string) {
    const w = window.open('', '_blank', 'width=400,height=640');
    if (!w) { toast.error('Permita pop-ups para imprimir o cupom.'); return; }
    const esc = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    w.document.write(`<html><head><title>Cupom Pré-venda</title><style>
      @page { size: 80mm auto; margin: 0; }
      * { margin: 0; padding: 0; }
      body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.3; width: 80mm; padding: 4px 6px; color: #000; }
      pre { white-space: pre-wrap; word-break: break-word; font: inherit; }
    </style></head><body><pre>${esc}</pre>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},300);};<\/script>
    </body></html>`);
    w.document.close();
  }

  // Atalho F7 abre a busca de produto (quando há comanda aberta)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2' && !comanda) { e.preventDefault(); novaComanda(); }
      if (e.key === 'F7' && comanda && !showBusca) { e.preventDefault(); setBusca(''); setShowBusca(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [comanda, showBusca]);

  async function carregarItens(comandaId: string) {
    const { data } = await supabase.from('comanda_itens').select('*').eq('comanda_id', comandaId).order('created_at');
    setItens((data as ComandaItem[]) || []);
  }

  async function novaComanda() {
    const eid = await getEmpresaId();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('comandas')
      .insert({ empresa_id: eid, vendedor_id: user?.id || null, unidade_id: unidadePadrao, status: 'aberta' })
      .select('*, clientes(nome), vendedores:usuarios!comandas_vendedor_id_fkey(nome)').single();
    if (error) { toast.error('Erro ao abrir comanda: ' + error.message); return; }
    setComanda(data as unknown as Comanda); setItens([]); setUltima(null);
    fetchBase();
  }

  async function abrirComanda(c: Comanda) {
    setComanda(c); setUltima(null);
    await carregarItens(c.id);
  }

  async function setCliente(clienteId: string) {
    if (!comanda) return;
    await supabase.from('comandas').update({ cliente_id: clienteId || null }).eq('id', comanda.id);
    setComanda({ ...comanda, cliente_id: clienteId || null });
  }

  async function addProduto(p: ProdBusca) {
    if (!comanda) return;
    const eid = await getEmpresaId();
    await supabase.from('comanda_itens').insert({
      empresa_id: eid, comanda_id: comanda.id, produto_id: p.id,
      descricao: p.nome, quantidade: 1, preco_unitario: Number(p.preco), desconto: 0, total: Number(p.preco),
    });
    setShowBusca(false);
    await carregarItens(comanda.id);
  }

  async function atualizarItem(it: ComandaItem, campos: Partial<Pick<ComandaItem, 'quantidade' | 'desconto'>>) {
    const qtd = campos.quantidade ?? it.quantidade;
    const desc = campos.desconto ?? it.desconto;
    const total = Math.max(0, Number(qtd) * Number(it.preco_unitario) - Number(desc));
    await supabase.from('comanda_itens').update({ quantidade: qtd, desconto: desc, total }).eq('id', it.id);
    if (comanda) carregarItens(comanda.id);
  }

  async function removerItem(id: string) {
    await supabase.from('comanda_itens').delete().eq('id', id);
    if (comanda) carregarItens(comanda.id);
  }

  // destino: 'venda' (vai ao caixa) ou 'orcamento' (fica guardado)
  async function finalizar(destino: 'venda' | 'orcamento') {
    if (!comanda) return;
    if (itens.length === 0) { toast.error('Adicione ao menos um item.'); return; }
    setSaving(true);
    const rpc = destino === 'venda' ? 'enviar_comanda_caixa' : 'salvar_orcamento';
    const { data, error } = await supabase.rpc(rpc, { p_comanda_id: comanda.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const num = Number(data);
    const clienteNome = clientes.find((c) => c.value === comanda.cliente_id)?.label || null;
    setCupom({ numero: num, cliente: clienteNome, itens: [...itens], total });
    setUltima(num);
    setComanda(null); setItens([]);
    toast.success(destino === 'venda' ? `Pré-venda Nº ${num} enviada ao caixa!` : `Orçamento Nº ${num} salvo!`);
    fetchBase();
  }

  // Converte um orçamento em venda (envia ao caixa)
  async function enviarOrcamentoAoCaixa(c: Comanda) {
    const { error } = await supabase.rpc('enviar_comanda_caixa', { p_comanda_id: c.id });
    if (error) { toast.error(error.message); return; }
    toast.success(`Orçamento Nº ${c.numero} virou venda e foi ao caixa!`);
    fetchBase();
  }

  async function cancelar() {
    if (!comanda) return;
    if (!confirm('Cancelar esta comanda?')) return;
    setSaving(true);
    const { error } = await supabase.rpc('cancelar_comanda', { p_comanda_id: comanda.id, p_motivo: null });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setComanda(null); setItens([]);
    toast.success('Comanda cancelada.');
    fetchBase();
  }

  const total = itens.reduce((s, i) => s + Number(i.total), 0);
  const q = busca.toLowerCase().trim();
  // Mostra TODO o catálogo e vai filtrando ao vivo conforme digita
  const prodFiltrados = !q ? produtos : produtos.filter((p) =>
    (p.nome || '').toLowerCase().includes(q) ||
    (p.codigo || '').toLowerCase().includes(q) ||
    (p.ref || '').toLowerCase().includes(q) ||
    (p.aplicacoes || []).some((a) => a.toLowerCase().includes(q)) ||
    (p.codigos_auxiliares || []).some((c) => c.toLowerCase().includes(q))
  );

  if (!podeOperar) return <div className="py-16 text-center text-slate-400 dark:text-slate-500">Você não tem permissão para o balcão.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Balcão</h1>
          <p className="text-slate-500 text-sm">Monte a pré-venda e envie ao caixa para o recebimento.</p>
        </div>
        {!comanda && <Button onClick={novaComanda}><Plus size={16} /> Nova venda <kbd className="ml-1 text-[10px] font-mono opacity-70">F2</kbd></Button>}
      </div>

      {/* Mensagem da última pré-venda enviada */}
      {ultima !== null && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 flex-wrap">
          <CheckCircle2 size={20} className="shrink-0" />
          <p className="text-sm flex-1">Pré-venda <strong>Nº {ultima}</strong> enviada ao caixa. Informe esse número no caixa para receber.</p>
          {cupom && (
            <Button size="sm" variant="secondary" onClick={() => imprimirCupom(montarCupom(cupom.numero, cupom.cliente, cupom.itens, cupom.total))}>
              <Printer size={14} /> Imprimir cupom
            </Button>
          )}
        </div>
      )}

      {comanda ? (
        /* ─── Comanda em edição ─── */
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><ShoppingBag size={18} /> Comanda Nº {comanda.numero}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Vendedor: <strong className="text-slate-600">{comanda.vendedores?.nome || meuNome || '—'}</strong></p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setBusca(''); setShowBusca(true); }}><Search size={14} /> Produto <kbd className="ml-1 text-[10px] font-mono opacity-60">F7</kbd></Button>
            </div>
          </div>

          <div className="max-w-sm">
            <Combobox label="Cliente (opcional — obrigatório no crediário)" value={comanda.cliente_id || ''} onChange={setCliente} options={clientes} placeholder="Buscar cliente..." />
          </div>

          {/* Itens */}
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50">
                  {['Produto', 'Qtd', 'Preço', 'Desc.', 'Total', ''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {itens.map((it) => (
                    <tr key={it.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{it.descricao}</td>
                      <td className="px-3 py-2">
                        <input type="number" min={1} step={1} value={it.quantidade}
                          onChange={(e) => atualizarItem(it, { quantidade: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{brl(Number(it.preco_unitario))}</td>
                      <td className="px-3 py-2">
                        <input inputMode="numeric" value={formatMoedaInput(Number(it.desconto))}
                          onChange={(e) => atualizarItem(it, { desconto: parseMoedaInput(e.target.value) })}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm" />
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900">{brl(Number(it.total))}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removerItem(it.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                  {itens.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Nenhum item. Use <strong>F7</strong> para buscar produtos.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-lg font-bold text-slate-900">Total: {brl(total)}</span>
            <div className="flex gap-2 flex-wrap">
              <Button variant="danger" size="sm" onClick={cancelar} loading={saving}><Ban size={14} /> Cancelar</Button>
              <Button variant="secondary" onClick={() => finalizar('orcamento')} loading={saving} disabled={itens.length === 0}><FileText size={15} /> Salvar Orçamento</Button>
              <Button onClick={() => finalizar('venda')} loading={saving} disabled={itens.length === 0}><Check size={16} /> Enviar ao Caixa (Venda)</Button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Listas ─── */
        loading ? <div className="py-16 text-center text-slate-400">Carregando...</div> : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Em atendimento (reabrir) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-5 py-3 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Em atendimento ({abertas.length})</h2></div>
              <div className="divide-y divide-slate-50">
                {abertas.length === 0 ? <p className="px-5 py-6 text-center text-slate-400 text-sm">Nenhuma comanda aberta.</p> :
                  abertas.map((c) => (
                    <button key={c.id} type="button" onClick={() => abrirComanda(c)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 text-left">
                      <span className="text-sm">
                        <strong>Nº {c.numero}</strong> {c.clientes?.nome ? `· ${c.clientes.nome}` : ''}
                        <span className="block text-xs text-slate-400">vend.: {c.vendedores?.nome || '—'}</span>
                      </span>
                      <span className="text-sm font-bold text-slate-700">{brl(Number(c.total))}</span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Orçamentos (guardados — podem virar venda) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-5 py-3 border-b border-slate-100"><h2 className="font-semibold text-slate-900 flex items-center gap-1.5"><FileText size={15} /> Orçamentos ({orcamentos.length})</h2></div>
              <div className="divide-y divide-slate-50">
                {orcamentos.length === 0 ? <p className="px-5 py-6 text-center text-slate-400 text-sm">Nenhum orçamento.</p> :
                  orcamentos.map((c) => (
                    <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-2">
                      <button type="button" onClick={() => abrirComanda(c)} className="text-sm text-left flex-1 hover:text-blue-600">
                        <strong>Nº {c.numero}</strong> {c.clientes?.nome ? `· ${c.clientes.nome}` : ''}
                        <span className="block text-xs text-slate-400">vend.: {c.vendedores?.nome || '—'} · {brl(Number(c.total))}</span>
                      </button>
                      <Button size="sm" variant="secondary" onClick={() => enviarOrcamentoAoCaixa(c)} title="Transformar em venda e enviar ao caixa">
                        <ArrowRight size={13} /> Caixa
                      </Button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Aguardando caixa */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-5 py-3 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Aguardando caixa ({pendentes.length})</h2></div>
              <div className="divide-y divide-slate-50">
                {pendentes.length === 0 ? <p className="px-5 py-6 text-center text-slate-400 text-sm">Nada aguardando recebimento.</p> :
                  pendentes.map((c) => (
                    <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm">
                        <strong>Nº {c.numero}</strong> {c.clientes?.nome ? `· ${c.clientes.nome}` : ''}
                        <span className="block text-xs text-slate-400">vend.: {c.vendedores?.nome || '—'}</span>
                      </span>
                      <span className="text-sm font-bold text-amber-600">{brl(Number(c.total))}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* Busca de produto (F7) */}
      <Modal open={showBusca} onClose={() => setShowBusca(false)} title="Buscar produto (F7)" size="xl">
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, descrição, código de barras, referência ou aplicação..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            {busca && <button type="button" onClick={() => setBusca('')} className="absolute right-3 top-3 text-slate-400"><X size={14} /></button>}
          </div>
          <p className="text-xs text-slate-400">{prodFiltrados.length} produto(s){busca ? ` para "${busca}"` : ' no catálogo'}</p>
          <div className="max-h-[65vh] overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-lg">
            {prodFiltrados.length === 0 ? <p className="px-4 py-8 text-center text-slate-400 text-sm">Nenhum produto encontrado.</p> :
              prodFiltrados.map((p) => {
                const semEstoque = Number(p.estoque) <= 0;
                return (
                  <button key={p.id} type="button" onClick={() => addProduto(p)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 text-left">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.nome}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        {p.codigo && <span>cód {p.codigo}</span>}
                        {p.ref && <span>ref {p.ref}</span>}
                        {(p.aplicacoes || []).length > 0 && <span>· {p.aplicacoes.join(', ')}</span>}
                        {p.localizacao && <span className="flex items-center gap-0.5"><MapPin size={10} /> {p.localizacao}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-slate-900">{brl(Number(p.preco))}</p>
                      <p className={`text-xs ${semEstoque ? 'text-red-500' : 'text-slate-400'}`}><Package size={10} className="inline mr-0.5" />{Number(p.estoque).toFixed(0)} un</p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
