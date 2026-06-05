'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Combobox, type ComboOption } from '@/components/ui/Combobox';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/PermissionsProvider';
import {
  Plus, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, RotateCcw, FileText,
  Smartphone, Banknote, CreditCard, Landmark, Wallet, Ban, CheckCircle2,
  AlertTriangle, ArrowRightLeft, Printer, ShoppingBag,
} from 'lucide-react';
import type { Caixa, MovimentoCaixa, Unidade, ReaberturaCaixa, MovimentoCategoria, ParcelaCliente, CreditoCliente, Comanda, ComandaItem } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Formas de recebimento imediato (entram no caixa).
// `key` = atalho de teclado (F-keys neutras — F1/F5/F11/F12 são reservadas pelo navegador).
const FORMAS = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote, key: 'F2' },
  { value: 'pix', label: 'PIX', icon: Smartphone, key: 'F3' },
  { value: 'debito', label: 'Débito', icon: CreditCard, key: 'F4' },
  { value: 'credito', label: 'Crédito à Vista', icon: CreditCard, key: 'F6' },
  { value: 'transferencia', label: 'Transferência', icon: Landmark, key: 'F7' },
];
const FORMA_LABEL: Record<string, string> = Object.fromEntries(FORMAS.map((f) => [f.value, f.label]));

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberto:         { label: 'Aberto',         cls: 'bg-green-100 text-green-700' },
  em_conferencia: { label: 'Em Conferência', cls: 'bg-amber-100 text-amber-700' },
  encerrado:      { label: 'Encerrado',      cls: 'bg-slate-200 text-slate-600' },
};

const CAT_LABEL: Record<MovimentoCategoria, string> = {
  abertura: 'Abertura', recebimento: 'Recebimento', sangria: 'Sangria', suprimento: 'Suprimento',
};

export default function CaixaPage() {
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);
  const [reaberturas, setReaberturas] = useState<ReaberturaCaixa[]>([]);
  const [historico, setHistorico] = useState<Caixa[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [clientes, setClientes] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAbrir, setShowAbrir] = useState(false);
  const [showReceb, setShowReceb] = useState(false);
  const [showFluxo, setShowFluxo] = useState<'sangria' | 'suprimento' | null>(null);
  const [showConf, setShowConf] = useState(false);
  const [showReabrir, setShowReabrir] = useState<Caixa | null>(null);
  const [showCancel, setShowCancel] = useState<MovimentoCaixa | null>(null);
  const [showRelatorio, setShowRelatorio] = useState(false);

  // Abertura
  const [aSaldo, setASaldo] = useState(0);
  const [aUnidade, setAUnidade] = useState('');

  // Recebimento
  const [rForma, setRForma] = useState('dinheiro');
  const [rValor, setRValor] = useState(0);
  const [rCliente, setRCliente] = useState('');
  const [rDescricao, setRDescricao] = useState('');

  // Sangria / Suprimento
  const [fValor, setFValor] = useState(0);
  const [fMotivo, setFMotivo] = useState('');

  // Receber crediário (parcela em aberto) pelo caixa
  const [showCrediario, setShowCrediario] = useState(false);
  const [crCliente, setCrCliente] = useState('');
  const [crParcelas, setCrParcelas] = useState<ParcelaCliente[]>([]);
  const [crParcelaId, setCrParcelaId] = useState('');
  const [crValor, setCrValor] = useState(0);
  const [crForma, setCrForma] = useState('dinheiro');

  // Venda no crediário (gera parcelas em Contas a Receber — não entra na gaveta)
  const [showVendaCred, setShowVendaCred] = useState(false);
  const [vcCliente, setVcCliente] = useState('');
  const [vcCred, setVcCred] = useState<CreditoCliente | null>(null);
  const [vcValor, setVcValor] = useState(0);
  const [vcParcelas, setVcParcelas] = useState('2');
  const [vcVenc, setVcVenc] = useState('');
  const [vcDescricao, setVcDescricao] = useState('');
  // override de gestor na venda crediário
  const [vcAprov, setVcAprov] = useState(false);
  const [vcAprovTipo, setVcAprovTipo] = useState<'acima_limite' | 'inadimplente'>('acima_limite');
  const [vcAprovMsg, setVcAprovMsg] = useState('');
  const [vcEmail, setVcEmail] = useState('');
  const [vcSenha, setVcSenha] = useState('');

  // Receber pré-venda (comanda do balcão) pelo caixa
  const [showPreVenda, setShowPreVenda] = useState(false);
  const [pvNumero, setPvNumero] = useState('');
  const [pvComanda, setPvComanda] = useState<Comanda | null>(null);
  const [pvItens, setPvItens] = useState<ComandaItem[]>([]);
  const [pvForma, setPvForma] = useState('dinheiro');
  const [pvParcelas, setPvParcelas] = useState('1');
  const [pvVenc, setPvVenc] = useState('');
  const [pvBuscando, setPvBuscando] = useState(false);
  const [pvPendentes, setPvPendentes] = useState<Comanda[]>([]);
  const [comprovante, setComprovante] = useState<{ comanda: Comanda; itens: ComandaItem[]; forma: string; total: number } | null>(null);
  // override crediário na pré-venda
  const [pvAprov, setPvAprov] = useState(false);
  const [pvAprovTipo, setPvAprovTipo] = useState<'acima_limite' | 'inadimplente'>('acima_limite');
  const [pvAprovMsg, setPvAprovMsg] = useState('');
  const [pvEmail, setPvEmail] = useState('');
  const [pvSenha, setPvSenha] = useState('');

  // Conferência (envio)
  const [cInformado, setCInformado] = useState(0);
  const [cObs, setCObs] = useState('');

  // Reabertura / Cancelamento
  const [motivoTxt, setMotivoTxt] = useState('');
  // Override de gestor no cancelamento
  const [gestorEmail, setGestorEmail] = useState('');
  const [gestorSenha, setGestorSenha] = useState('');

  const supabase = createClient();
  const toast = useToast();
  const { can } = usePermissions();
  const podeOperar = can('operar_caixa');
  const podeGerir = can('gerir_caixa');
  const podeVender = can('registrar_venda');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [ativo, hist, unis, cli] = await Promise.all([
      supabase.from('caixas').select('*').in('status', ['aberto', 'em_conferencia']).order('aberto_em', { ascending: false }).limit(1),
      supabase.from('caixas').select('*').eq('status', 'encerrado').order('encerrado_em', { ascending: false }).limit(15),
      supabase.from('unidades').select('*').eq('ativo', true).order('padrao', { ascending: false }),
      supabase.from('clientes').select('id, nome, telefone').eq('ativo', true).order('nome').limit(500),
    ]);
    const atual = (ativo.data as Caixa[] || [])[0] || null;
    setCaixa(atual);
    setHistorico(hist.data as Caixa[] || []);
    setUnidades(unis.data as Unidade[] || []);
    setClientes((cli.data as { id: string; nome: string; telefone: string | null }[] || []).map((c) => ({
      value: c.id, label: c.nome, sublabel: c.telefone || undefined, keywords: `${c.nome} ${c.telefone || ''}`,
    })));

    if (atual) {
      const [{ data: movs }, { data: reab }] = await Promise.all([
        // desambigua o embed (há 2 FKs p/ usuarios: usuario_id e cancelado_por)
        supabase.from('movimentos_caixa').select('*, clientes(nome), usuarios:usuarios!movimentos_caixa_usuario_id_fkey(nome)').eq('caixa_id', atual.id).order('created_at', { ascending: false }),
        supabase.from('reaberturas_caixa').select('*').eq('caixa_id', atual.id).order('created_at', { ascending: false }),
      ]);
      setMovimentos(movs as MovimentoCaixa[] || []);
      setReaberturas(reab as ReaberturaCaixa[] || []);
    } else {
      setMovimentos([]); setReaberturas([]);
    }
    setLoading(false);
  }

  // ── Helpers de RPC com tratamento de erro (mostra a mensagem do banco) ──
  async function rpc(fn: string, args: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    const { error } = await supabase.rpc(fn, args);
    setSaving(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(okMsg);
    await fetchAll();
    return true;
  }

  async function handleAbrir(e: FormEvent) {
    e.preventDefault();
    const ok = await rpc('abrir_caixa', { p_unidade_id: aUnidade || null, p_saldo_inicial: aSaldo, p_observacao: null }, 'Caixa aberto!');
    if (ok) { setShowAbrir(false); setASaldo(0); }
  }

  async function handleReceb(e: FormEvent) {
    e.preventDefault();
    if (!caixa || rValor <= 0) return;
    const ok = await rpc('lancar_movimento_caixa', {
      p_caixa_id: caixa.id, p_categoria: 'recebimento', p_forma: rForma,
      p_valor: rValor, p_cliente_id: rCliente || null, p_descricao: rDescricao || null,
    }, 'Recebimento registrado!');
    if (ok) { setShowReceb(false); setRValor(0); setRCliente(''); setRDescricao(''); }
  }

  async function handleFluxo(e: FormEvent) {
    e.preventDefault();
    if (!caixa || fValor <= 0 || !showFluxo) return;
    if (!fMotivo.trim()) { toast.error('Informe o motivo.'); return; }
    const ok = await rpc('lancar_movimento_caixa', {
      p_caixa_id: caixa.id, p_categoria: showFluxo, p_forma: 'dinheiro',
      p_valor: fValor, p_cliente_id: null, p_descricao: fMotivo,
    }, showFluxo === 'sangria' ? 'Sangria registrada!' : 'Suprimento registrado!');
    if (ok) { setShowFluxo(null); setFValor(0); setFMotivo(''); }
  }

  async function handleConferencia(e: FormEvent) {
    e.preventDefault();
    if (!caixa) return;
    const ok = await rpc('enviar_conferencia_caixa', { p_caixa_id: caixa.id, p_saldo_informado: cInformado, p_observacao: cObs || null }, 'Caixa enviado para conferência!');
    if (ok) { setShowConf(false); setCInformado(0); setCObs(''); }
  }

  async function handleEncerrar() {
    if (!caixa) return;
    await rpc('encerrar_caixa', { p_caixa_id: caixa.id }, 'Caixa encerrado!');
  }

  async function handleReabrir(e: FormEvent) {
    e.preventDefault();
    if (!showReabrir || !motivoTxt.trim()) { toast.error('Informe o motivo.'); return; }
    const ok = await rpc('reabrir_caixa', { p_caixa_id: showReabrir.id, p_motivo: motivoTxt }, 'Caixa reaberto!');
    if (ok) { setShowReabrir(null); setMotivoTxt(''); }
  }

  async function handleCancelar(e: FormEvent) {
    e.preventDefault();
    if (!showCancel || !motivoTxt.trim()) { toast.error('Informe o motivo.'); return; }
    if (!gestorEmail || !gestorSenha) { toast.error('Informe e-mail e senha do gestor.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/caixa/cancelar-movimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movId: showCancel.id, motivo: motivoTxt, gestorEmail, gestorPassword: gestorSenha }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao cancelar.'); return; }
      toast.success('Movimento cancelado (autorizado pelo gestor)!');
      setShowCancel(null); setMotivoTxt(''); setGestorEmail(''); setGestorSenha('');
      await fetchAll();
    } catch {
      toast.error('Falha de conexão ao cancelar.');
    } finally {
      setSaving(false);
    }
  }

  // ── Totais (ignoram movimentos cancelados) ──
  const ativos = movimentos.filter((m) => !m.cancelado);
  const totaisPorForma: Record<string, number> = {};
  FORMAS.forEach((f) => { totaisPorForma[f.value] = 0; });
  ativos.filter((m) => m.categoria === 'recebimento').forEach((m) => {
    const k = m.forma_pagamento || 'dinheiro';
    totaisPorForma[k] = (totaisPorForma[k] || 0) + Number(m.valor);
  });
  const saldoInicial = Number(caixa?.saldo_inicial || 0);
  const totalRecebimentos = ativos.filter((m) => m.categoria === 'recebimento').reduce((s, m) => s + Number(m.valor), 0);
  const totalSuprimentos = ativos.filter((m) => m.categoria === 'suprimento').reduce((s, m) => s + Number(m.valor), 0);
  const totalSangrias = ativos.filter((m) => m.categoria === 'sangria').reduce((s, m) => s + Number(m.valor), 0);
  const entradasDinheiro = ativos.filter((m) => m.tipo === 'entrada' && m.forma_pagamento === 'dinheiro' && m.categoria !== 'abertura').reduce((s, m) => s + Number(m.valor), 0);
  const dinheiroEsperado = saldoInicial + entradasDinheiro - totalSangrias;
  const resultadoOperacional = totalRecebimentos + totalSuprimentos - totalSangrias;

  const isAberto = caixa?.status === 'aberto';
  const isConf = caixa?.status === 'em_conferencia';
  const difConf = caixa ? Number(caixa.saldo_informado || 0) - Number(caixa.saldo_calculado || 0) : 0;
  // Caixa de dia anterior ainda em aberto/conferência → precisa encerrar antes de abrir o de hoje
  const caixaDiaAnterior = !!caixa && new Date(caixa.aberto_em).toDateString() !== new Date().toDateString();

  function openReceb(forma: string) {
    if (forma === 'credito_parcelado') return; // tratado no banner
    setRForma(forma); setRValor(0); setRCliente(''); setRDescricao(''); setShowReceb(true);
  }

  // Carrega parcelas em aberto do cliente selecionado no modal de crediário
  useEffect(() => {
    if (!crCliente) { setCrParcelas([]); setCrParcelaId(''); return; }
    supabase.from('v_parcelas_cliente').select('*').eq('cliente_id', crCliente).order('data_vencimento')
      .then(({ data }) => setCrParcelas((data as ParcelaCliente[]) || []));
  }, [crCliente]);

  const crParcela = crParcelas.find((p) => p.id === crParcelaId);

  async function handleReceberCrediario(e: FormEvent) {
    e.preventDefault();
    if (!caixa || !crParcelaId || crValor <= 0) { toast.error('Selecione a parcela e o valor.'); return; }
    const ok = await rpc('receber_parcela', {
      p_conta_id: crParcelaId, p_valor: crValor, p_forma: crForma,
      p_data: new Date().toISOString().split('T')[0], p_caixa_id: caixa.id, p_conta_bancaria: null,
    }, 'Recebimento de crediário registrado no caixa!');
    if (ok) { setShowCrediario(false); setCrCliente(''); setCrParcelas([]); setCrParcelaId(''); setCrValor(0); }
  }

  // ── Venda no crediário (gera parcelas em Contas a Receber) ──
  // Busca o crédito do cliente selecionado
  useEffect(() => {
    if (!vcCliente) { setVcCred(null); return; }
    supabase.from('v_credito_cliente').select('*').eq('cliente_id', vcCliente).single()
      .then(({ data }) => setVcCred((data as CreditoCliente) || null));
  }, [vcCliente]);

  async function executarVendaCred() {
    if (!caixa) return;
    const parcelas = Math.max(1, parseInt(vcParcelas) || 1);
    const grupo = crypto.randomUUID();
    const valorParcela = parseFloat((vcValor / parcelas).toFixed(2));
    const cliNome = clientes.find((c) => c.value === vcCliente)?.label || '';
    const base = vcVenc ? new Date(vcVenc + 'T00:00:00') : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();
    const rows = Array.from({ length: parcelas }, (_, i) => {
      const venc = new Date(base); venc.setMonth(venc.getMonth() + i);
      return {
        empresa_id: caixa.empresa_id, unidade_id: caixa.unidade_id, cliente_id: vcCliente,
        forma_pagamento: 'credito_parcelado' as const,
        descricao: `${vcDescricao || 'Venda crediário' + (cliNome ? ' - ' + cliNome : '')} (${i + 1}/${parcelas})`,
        valor: valorParcela, data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: venc.toISOString().split('T')[0], status: 'pendente' as const,
        numero_parcela: i + 1, total_parcelas: parcelas, grupo_parcelas: grupo,
      };
    });
    setSaving(true);
    const { error } = await supabase.from('contas_receber').insert(rows);
    setSaving(false);
    if (error) { toast.error('Erro ao gerar parcelas: ' + error.message); return; }
    toast.success(`Venda no crediário gerada (${parcelas}x)!`);
    setShowVendaCred(false); setVcCliente(''); setVcCred(null); setVcValor(0); setVcParcelas('2'); setVcVenc(''); setVcDescricao('');
    await fetchAll();
  }

  async function handleVendaCred(e: FormEvent) {
    e.preventDefault();
    if (!vcCliente) { toast.error('Selecione o cliente.'); return; }
    if (vcValor <= 0) { toast.error('Informe o valor.'); return; }
    // Validação de limite/status
    if (vcCred) {
      if (vcCred.status_efetivo === 'bloqueado' || vcCred.status_efetivo === 'inadimplente') {
        setVcAprovTipo('inadimplente');
        setVcAprovMsg(`Cliente ${vcCred.status_efetivo === 'bloqueado' ? 'BLOQUEADO' : 'INADIMPLENTE'}. Vencido: ${formatBRL(Number(vcCred.valor_vencido))} · ${vcCred.parcelas_vencidas} parcela(s).`);
        setVcEmail(''); setVcSenha(''); setVcAprov(true); return;
      }
      if (vcValor > Number(vcCred.limite_disponivel)) {
        setVcAprovTipo('acima_limite');
        setVcAprovMsg(`Limite ${formatBRL(Number(vcCred.limite_credito))} · disponível ${formatBRL(Number(vcCred.limite_disponivel))}. Esta venda de ${formatBRL(vcValor)} ultrapassa o limite.`);
        setVcEmail(''); setVcSenha(''); setVcAprov(true); return;
      }
    }
    await executarVendaCred();
  }

  async function handleVcAprovar(e: FormEvent) {
    e.preventDefault();
    if (!vcEmail || !vcSenha) { toast.error('Informe e-mail e senha do gestor.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crediario/autorizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: vcCliente, tipo: vcAprovTipo, valor: vcValor, motivo: vcAprovMsg, gestorEmail: vcEmail, gestorPassword: vcSenha }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro na autorização.'); setSaving(false); return; }
      setVcAprov(false);
      toast.success('Venda autorizada pelo gestor!');
      await executarVendaCred();
    } catch {
      toast.error('Falha de conexão na autorização.'); setSaving(false);
    }
  }

  // ── Receber pré-venda (comanda do balcão) ──
  const PV_SEL = '*, clientes(nome), vendedores:usuarios!comandas_vendedor_id_fkey(nome)';

  async function carregarPendentes() {
    const { data } = await supabase.from('comandas').select(PV_SEL)
      .eq('status', 'aguardando_caixa').order('created_at', { ascending: false });
    setPvPendentes((data as unknown as Comanda[]) || []);
  }

  async function selecionarPendente(c: Comanda) {
    const { data: its } = await supabase.from('comanda_itens').select('*').eq('comanda_id', c.id).order('created_at');
    setPvComanda(c); setPvItens((its as ComandaItem[]) || []);
    setPvForma('dinheiro'); setPvParcelas('1'); setPvVenc('');
  }

  async function buscarPreVenda() {
    if (!pvNumero.trim()) return;
    setPvBuscando(true);
    const { data } = await supabase.from('comandas').select(PV_SEL)
      .eq('numero', Number(pvNumero)).eq('status', 'aguardando_caixa').maybeSingle();
    if (!data) { setPvComanda(null); setPvItens([]); setPvBuscando(false); toast.error('Pré-venda não encontrada ou já faturada.'); return; }
    await selecionarPendente(data as unknown as Comanda);
    setPvBuscando(false);
  }

  const pvTotal = pvItens.reduce((s, i) => s + Number(i.total), 0);

  async function executarFaturarPreVenda() {
    if (!pvComanda || !caixa) return;
    const ok = await rpc('faturar_comanda', {
      p_comanda_id: pvComanda.id, p_forma: pvForma, p_caixa_id: caixa.id,
      p_parcelas: pvForma === 'crediario' ? Math.max(1, parseInt(pvParcelas) || 1) : 1,
      p_cliente_id: pvComanda.cliente_id, p_primeiro_venc: pvVenc || null,
    }, 'Pré-venda faturada!');
    if (ok) {
      setComprovante({ comanda: pvComanda, itens: pvItens, forma: pvForma, total: pvTotal });
      setShowPreVenda(false); setPvComanda(null); setPvItens([]); setPvNumero('');
    }
  }

  async function faturarPreVenda(e: FormEvent) {
    e.preventDefault();
    if (!pvComanda) return;
    if (pvForma === 'crediario') {
      if (!pvComanda.cliente_id) { toast.error('Crediário exige cliente. Volte ao Balcão e vincule um cliente à comanda.'); return; }
      const { data } = await supabase.from('v_credito_cliente').select('*').eq('cliente_id', pvComanda.cliente_id).single();
      const cred = data as CreditoCliente | null;
      if (cred && (cred.status_efetivo === 'bloqueado' || cred.status_efetivo === 'inadimplente')) {
        setPvAprovTipo('inadimplente'); setPvAprovMsg(`Cliente ${cred.status_efetivo === 'bloqueado' ? 'BLOQUEADO' : 'INADIMPLENTE'}. Vencido: ${formatBRL(Number(cred.valor_vencido))}.`);
        setPvEmail(''); setPvSenha(''); setPvAprov(true); return;
      }
      if (cred && pvTotal > Number(cred.limite_disponivel)) {
        setPvAprovTipo('acima_limite'); setPvAprovMsg(`Disponível ${formatBRL(Number(cred.limite_disponivel))}; esta venda de ${formatBRL(pvTotal)} ultrapassa o limite.`);
        setPvEmail(''); setPvSenha(''); setPvAprov(true); return;
      }
    }
    await executarFaturarPreVenda();
  }

  async function pvAprovarFn(e: FormEvent) {
    e.preventDefault();
    if (!pvComanda || !pvComanda.cliente_id) return;
    if (!pvEmail || !pvSenha) { toast.error('Informe e-mail e senha do gestor.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crediario/autorizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: pvComanda.cliente_id, tipo: pvAprovTipo, valor: pvTotal, motivo: pvAprovMsg, gestorEmail: pvEmail, gestorPassword: pvSenha }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro na autorização.'); setSaving(false); return; }
      setPvAprov(false); setSaving(false);
      await executarFaturarPreVenda();
    } catch {
      toast.error('Falha de conexão na autorização.'); setSaving(false);
    }
  }

  // Atalhos de teclado estilo PDV. F1/F5/F11/F12 são reservadas pelo navegador — não usadas.
  // preventDefault anula qualquer ação padrão (ex.: F3=buscar). Só atuam com caixa aberto e sem modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modalAberto = showAbrir || showReceb || !!showFluxo || showConf || !!showReabrir || !!showCancel || showRelatorio;
      if (modalAberto || !caixa || caixa.status !== 'aberto' || !podeOperar) return;
      if (new Date(caixa.aberto_em).toDateString() !== new Date().toDateString()) return; // caixa de dia anterior: bloqueado
      const acoes: Record<string, () => void> = {
        F2: () => openReceb('dinheiro'),
        F3: () => openReceb('pix'),
        F4: () => openReceb('debito'),
        F6: () => openReceb('credito'),
        F7: () => openReceb('transferencia'),
        F8: () => { setFValor(0); setFMotivo(''); setShowFluxo('sangria'); },
        F9: () => { setFValor(0); setFMotivo(''); setShowFluxo('suprimento'); },
        F10: () => { setCInformado(dinheiroEsperado); setCObs(''); setShowConf(true); },
      };
      const fn = acoes[e.key];
      if (fn) { e.preventDefault(); fn(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [caixa, podeOperar, dinheiroEsperado, showAbrir, showReceb, showFluxo, showConf, showReabrir, showCancel, showRelatorio]);

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-5">
      {/* Cabeçalho + estado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Caixa</h1>
            {caixa && <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_META[caixa.status].cls}`}>{STATUS_META[caixa.status].label}</span>}
          </div>
          <p className="text-slate-500 text-sm">
            {caixa ? `Aberto em ${new Date(caixa.aberto_em).toLocaleString('pt-BR')}` : 'Nenhum caixa aberto'}
          </p>
        </div>
        <div className="flex gap-2">
          {!caixa && podeOperar && (
            <Button onClick={() => { setASaldo(0); setAUnidade(unidades.find((u) => u.padrao)?.id || ''); setShowAbrir(true); }}>
              <Unlock size={16} /> Abrir Caixa
            </Button>
          )}
          {isAberto && podeOperar && !caixaDiaAnterior && (
            <Button variant="secondary" size="sm" onClick={() => { setPvNumero(''); setPvComanda(null); setPvItens([]); carregarPendentes(); setShowPreVenda(true); }}>
              <ShoppingBag size={14} /> Receber pré-venda
            </Button>
          )}
          {isAberto && podeVender && !caixaDiaAnterior && (
            <Button variant="secondary" size="sm" onClick={() => { setVcCliente(''); setVcCred(null); setVcValor(0); setVcParcelas('2'); setVcVenc(''); setVcDescricao(''); setShowVendaCred(true); }}>
              <CreditCard size={14} /> Venda Crediário
            </Button>
          )}
          {isAberto && podeOperar && (
            <>
              {!caixaDiaAnterior && <Button variant="secondary" size="sm" onClick={() => { setFValor(0); setFMotivo(''); setShowFluxo('suprimento'); }}><ArrowDownCircle size={14} /> Suprimento <kbd className="ml-1 text-[10px] font-mono opacity-60">F9</kbd></Button>}
              {!caixaDiaAnterior && <Button variant="secondary" size="sm" onClick={() => { setFValor(0); setFMotivo(''); setShowFluxo('sangria'); }}><ArrowUpCircle size={14} /> Sangria <kbd className="ml-1 text-[10px] font-mono opacity-60">F8</kbd></Button>}
              <Button size="sm" onClick={() => { setCInformado(dinheiroEsperado); setCObs(''); setShowConf(true); }}><Lock size={14} /> Fechar <kbd className="ml-1 text-[10px] font-mono opacity-70">F10</kbd></Button>
            </>
          )}
          {isConf && (
            <>
              {podeGerir && <Button size="sm" onClick={handleEncerrar} loading={saving}><CheckCircle2 size={14} /> Conferir e Encerrar</Button>}
              {podeGerir && <Button variant="secondary" size="sm" onClick={() => { setMotivoTxt(''); setShowReabrir(caixa); }}><RotateCcw size={14} /> Reabrir</Button>}
            </>
          )}
        </div>
      </div>

      {/* Alerta: caixa aberto em dia anterior — precisa encerrar antes de abrir o de hoje */}
      {caixaDiaAnterior && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Este caixa foi aberto em {new Date(caixa!.aberto_em).toLocaleDateString('pt-BR')} (dia anterior).</p>
            <p className="text-red-700">
              {isAberto
                ? 'Faça o fechamento total (conferência) e o encerramento deste caixa antes de abrir o caixa de hoje.'
                : 'Conclua a conferência e o encerramento deste caixa antes de abrir o caixa de hoje.'}
            </p>
            <p className="text-red-600 text-xs mt-1 font-medium">Recebimentos, vendas, sangrias e suprimentos estão bloqueados aqui — só é possível encerrar. Assim cada lançamento fica no dia correto.</p>
          </div>
        </div>
      )}

      {/* Bloqueio: nenhum caixa */}
      {!caixa ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <Wallet size={40} className="mx-auto mb-3 opacity-30" />
          <p>{podeOperar ? 'Abra o caixa para começar a registrar as movimentações do dia.' : 'Nenhum caixa aberto no momento.'}</p>
        </div>
      ) : (
        <>
          {/* Em conferência: painel de fechamento */}
          {isConf && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Caixa aguardando conferência</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-slate-500">Esperado</p><p className="text-lg font-bold text-slate-900">{formatBRL(Number(caixa.saldo_calculado || 0))}</p></div>
                <div><p className="text-xs text-slate-500">Conferido</p><p className="text-lg font-bold text-slate-900">{formatBRL(Number(caixa.saldo_informado || 0))}</p></div>
                <div>
                  <p className="text-xs text-slate-500">Diferença</p>
                  <p className={`text-lg font-bold ${difConf === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {difConf === 0 ? 'OK' : `${formatBRL(difConf)} (${difConf > 0 ? 'sobra' : 'falta'})`}
                  </p>
                </div>
              </div>
              {!podeGerir && <p className="text-xs text-amber-700 mt-3 text-center">Aguardando um responsável (Financeiro/Admin) conferir e encerrar.</p>}
            </div>
          )}

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400">Saldo Inicial</p>
              <p className="text-xl font-bold text-slate-900">{formatBRL(saldoInicial)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 flex items-center gap-1"><ArrowDownCircle size={12} className="text-green-500" /> Recebimentos</p>
              <p className="text-xl font-bold text-green-600">{formatBRL(totalRecebimentos)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 flex items-center gap-1"><ArrowUpCircle size={12} className="text-red-500" /> Sangrias</p>
              <p className="text-xl font-bold text-red-600">{formatBRL(totalSangrias)}</p>
            </div>
            <div className="bg-blue-600 rounded-xl p-4 shadow-sm text-white">
              <p className="text-xs text-blue-100">Dinheiro na Gaveta</p>
              <p className="text-xl font-bold">{formatBRL(dinheiroEsperado)}</p>
            </div>
          </div>

          {/* Registrar recebimento (só com caixa aberto do dia) */}
          {isAberto && podeOperar && !caixaDiaAnterior && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-1">Registrar recebimento</p>
              <p className="text-xs text-slate-400 mb-3">Clique na forma de pagamento para lançar</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {FORMAS.map((f) => {
                  const Icon = f.icon;
                  return (
                    <button key={f.value} type="button" onClick={() => openReceb(f.value)}
                      className="relative text-center p-4 rounded-xl border-2 border-slate-100 hover:border-green-400 hover:bg-green-50 transition-colors group">
                      <kbd className="absolute top-2 right-2 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 group-hover:bg-green-100 group-hover:text-green-600 rounded px-1.5 py-0.5">{f.key}</kbd>
                      <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 group-hover:bg-green-100 flex items-center justify-center mb-2 transition-colors">
                        <Icon size={18} className="text-slate-500 group-hover:text-green-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{f.label}</p>
                      <p className="text-base font-bold text-slate-900 mt-1">{formatBRL(totaisPorForma[f.value] || 0)}</p>
                      <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-green-600 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={11} /> lançar</span>
                    </button>
                  );
                })}
              </div>
              {/* Receber parcela de crediário (entra na gaveta) */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-1.5"><CreditCard size={14} /> Cliente veio pagar uma <strong>parcela do crediário</strong>?</span>
                <button type="button" onClick={() => { setCrCliente(''); setCrParcelaId(''); setCrValor(0); setCrForma('dinheiro'); setShowCrediario(true); }}
                  className="text-blue-600 font-medium hover:underline whitespace-nowrap">Receber parcela →</button>
              </div>
              {/* Crédito parcelado → Contas a Receber */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-1.5"><ArrowRightLeft size={14} /> Venda nova no <strong>crédito parcelado</strong>? Gere as parcelas em Contas a Receber.</span>
                <Link href="/dashboard/financeiro/receber" className="text-blue-600 font-medium hover:underline whitespace-nowrap">Abrir Contas a Receber →</Link>
              </div>
            </div>
          )}

          {/* Movimentações */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Movimentações ({ativos.length})</h2>
              <button type="button" onClick={() => setShowRelatorio(true)} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"><FileText size={14} /> Relatório do dia</button>
            </div>
            <div className="divide-y divide-slate-50">
              {movimentos.length === 0 ? (
                <p className="px-6 py-8 text-center text-slate-400 text-sm">Nenhuma movimentação ainda</p>
              ) : movimentos.map((m) => (
                <div key={m.id} className={`px-6 py-3 flex items-center justify-between ${m.cancelado ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    {m.tipo === 'entrada' ? <ArrowDownCircle size={16} className="text-green-500" /> : <ArrowUpCircle size={16} className="text-red-500" />}
                    <div>
                      <p className={`text-sm font-medium text-slate-800 ${m.cancelado ? 'line-through' : ''}`}>
                        {CAT_LABEL[m.categoria]}
                        {m.categoria === 'recebimento' && ` · ${FORMA_LABEL[m.forma_pagamento || ''] || m.forma_pagamento}`}
                        {m.clientes?.nome && ` · ${m.clientes.nome}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {m.descricao ? `${m.descricao} · ` : ''}
                        {m.usuarios?.nome ? `${m.usuarios.nome} · ` : ''}
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {m.cancelado && m.motivo_cancelamento && <span className="text-red-500"> · cancelado: {m.motivo_cancelamento}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${m.cancelado ? 'text-slate-400 line-through' : m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'entrada' ? '+' : '−'} {formatBRL(Number(m.valor))}
                    </span>
                    {isAberto && podeOperar && !m.cancelado && m.categoria !== 'abertura' && (
                      <button type="button" onClick={() => { setMotivoTxt(''); setGestorEmail(''); setGestorSenha(''); setShowCancel(m); }} className="text-slate-300 hover:text-red-500" title="Cancelar"><Ban size={15} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Auditoria de reaberturas */}
          {reaberturas.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-100">
              <div className="px-6 py-3 border-b border-slate-100"><h2 className="font-semibold text-slate-700 text-sm flex items-center gap-1.5"><RotateCcw size={14} /> Reaberturas deste caixa</h2></div>
              <div className="divide-y divide-slate-50">
                {reaberturas.map((r) => (
                  <div key={r.id} className="px-6 py-2.5 text-sm flex justify-between">
                    <span className="text-slate-600">{r.motivo}</span>
                    <span className="text-slate-400 text-xs">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Histórico de caixas encerrados */}
      {historico.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Caixas Anteriores</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Abertura', 'Encerramento', 'Esperado', 'Conferido', 'Diferença', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => {
                  const dif = Number(c.saldo_informado || 0) - Number(c.saldo_calculado || 0);
                  return (
                    <tr key={c.id} className="border-b border-slate-50">
                      <td className="px-6 py-3 text-slate-500">{new Date(c.aberto_em).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-3 text-slate-500">{c.encerrado_em ? new Date(c.encerrado_em).toLocaleString('pt-BR') : '—'}</td>
                      <td className="px-6 py-3">{formatBRL(Number(c.saldo_calculado || 0))}</td>
                      <td className="px-6 py-3">{formatBRL(Number(c.saldo_informado || 0))}</td>
                      <td className={`px-6 py-3 font-medium ${dif === 0 ? 'text-green-600' : 'text-red-600'}`}>{dif === 0 ? 'OK' : formatBRL(dif)}</td>
                      <td className="px-6 py-3">
                        {podeGerir && <button type="button" onClick={() => { setMotivoTxt(''); setShowReabrir(c); }} className="text-blue-600 hover:underline text-xs flex items-center gap-1"><RotateCcw size={12} /> Reabrir</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modais ─── */}

      {/* Abrir */}
      <Modal open={showAbrir} onClose={() => setShowAbrir(false)} title="Abrir Caixa" size="sm">
        <form onSubmit={handleAbrir} className="space-y-4">
          {unidades.length > 1 && (
            <Select label="Empresa (CNPJ)" value={aUnidade} onChange={(e) => setAUnidade(e.target.value)}
              options={unidades.map((u) => ({ value: u.id, label: u.nome_fantasia || u.razao_social }))} />
          )}
          <Input label="Dinheiro inicial (troco) R$" inputMode="numeric"
            value={formatMoedaInput(aSaldo)} onChange={(e) => setASaldo(parseMoedaInput(e.target.value))} placeholder="0,00" />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><Unlock size={14} /> Abrir Caixa</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAbrir(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Recebimento */}
      <Modal open={showReceb} onClose={() => setShowReceb(false)} title={`Recebimento — ${FORMA_LABEL[rForma] || ''}`} size="sm">
        <form onSubmit={handleReceb} className="space-y-4">
          <Combobox label="Cliente (opcional)" value={rCliente} onChange={setRCliente} options={clientes} placeholder="Buscar cliente..." />
          <Input label="Valor (R$) *" inputMode="numeric" autoFocus
            value={formatMoedaInput(rValor)} onChange={(e) => setRValor(parseMoedaInput(e.target.value))} placeholder="0,00" required />
          <Input label="Descrição (opcional)" value={rDescricao} onChange={(e) => setRDescricao(e.target.value)} placeholder="Ex: nº cupom / venda balcão" />
          <div className="flex gap-3">
            <Button type="submit" variant="success" loading={saving} className="flex-1">Registrar Recebimento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowReceb(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Receber pré-venda (comanda do balcão) */}
      <Modal open={showPreVenda} onClose={() => setShowPreVenda(false)} title="Receber pré-venda (balcão)" size="md">
        <div className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); buscarPreVenda(); }} className="flex items-end gap-2">
            <Input label="Nº da pré-venda" inputMode="numeric" value={pvNumero} onChange={(e) => setPvNumero(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 154" autoFocus />
            <Button type="submit" variant="secondary" loading={pvBuscando}>Buscar</Button>
          </form>

          {/* Lista de pré-vendas pendentes (selecionar direto) */}
          {!pvComanda && (
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-1.5">Pré-vendas pendentes ({pvPendentes.length})</p>
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-60 overflow-y-auto">
                {pvPendentes.length === 0 ? (
                  <p className="px-3 py-6 text-center text-slate-400 text-sm">Nenhuma pré-venda aguardando recebimento.</p>
                ) : pvPendentes.map((c) => (
                  <button key={c.id} type="button" onClick={() => selecionarPendente(c)}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-blue-50 text-left">
                    <span className="text-sm">
                      <strong>Nº {c.numero}</strong> {c.clientes?.nome ? `· ${c.clientes.nome}` : '· Consumidor'}
                      <span className="block text-xs text-slate-400">vend.: {c.vendedores?.nome || '—'}</span>
                    </span>
                    <span className="text-sm font-bold text-amber-600">{formatBRL(Number(c.total))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {pvComanda && (
            <>
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-44 overflow-y-auto">
                {pvItens.map((it) => (
                  <div key={it.id} className="px-3 py-2 flex justify-between text-sm">
                    <span className="text-slate-700">{Number(it.quantidade)}x {it.descricao}</span>
                    <span className="font-medium">{formatBRL(Number(it.total))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Nº {pvComanda.numero} · Cliente: {pvComanda.clientes?.nome || '—'} · Vend.: {pvComanda.vendedores?.nome || '—'}</span>
                <span className="font-bold text-slate-900">Total: {formatBRL(pvTotal)}</span>
              </div>
              <form onSubmit={faturarPreVenda} className="space-y-3">
                <Select label="Forma de recebimento" value={pvForma} onChange={(e) => setPvForma(e.target.value)}
                  options={[...FORMAS.map((f) => ({ value: f.value, label: f.label })), { value: 'crediario', label: 'Crediário (parcelado)' }]} />
                {pvForma === 'crediario' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Nº de parcelas" inputMode="numeric" value={pvParcelas} onChange={(e) => setPvParcelas(e.target.value.replace(/\D/g, ''))} />
                    <Input label="1º vencimento" type="date" value={pvVenc} onChange={(e) => setPvVenc(e.target.value)} />
                  </div>
                )}
                <div className="flex gap-3">
                  <Button type="submit" variant="success" loading={saving} className="flex-1"><CheckCircle2 size={14} /> Faturar pré-venda</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowPreVenda(false)}>Cancelar</Button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>

      {/* Override de gestor — pré-venda no crediário */}
      <Modal open={pvAprov} onClose={() => setPvAprov(false)} title={pvAprovTipo === 'inadimplente' ? 'Cliente com pendências' : 'Venda acima do limite'} size="sm">
        <form onSubmit={pvAprovarFn} className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{pvAprovMsg}</div>
          <Input label="E-mail do gestor *" type="email" value={pvEmail} onChange={(e) => setPvEmail(e.target.value)} autoComplete="off" required />
          <Input label="Senha do gestor *" type="password" value={pvSenha} onChange={(e) => setPvSenha(e.target.value)} autoComplete="off" required />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><CheckCircle2 size={14} /> Autorizar e faturar</Button>
            <Button type="button" variant="secondary" onClick={() => setPvAprov(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Comprovante da pré-venda faturada */}
      <Modal open={!!comprovante} onClose={() => setComprovante(null)} title="Comprovante" size="sm">
        {comprovante && (
          <div className="space-y-4" id="comprovante-pv">
            <div className="text-center">
              <p className="font-bold text-slate-900">Pré-venda Nº {comprovante.comanda.numero}</p>
              <p className="text-xs text-slate-400">{new Date().toLocaleString('pt-BR')}</p>
              {comprovante.comanda.clientes?.nome && <p className="text-sm text-slate-600 mt-1">Cliente: {comprovante.comanda.clientes.nome}</p>}
            </div>
            <div className="border-t border-b border-slate-100 py-2 divide-y divide-slate-50">
              {comprovante.itens.map((it) => (
                <div key={it.id} className="py-1.5 flex justify-between text-sm">
                  <span className="text-slate-700">{Number(it.quantidade)}x {it.descricao}</span>
                  <span>{formatBRL(Number(it.total))}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 capitalize">{comprovante.forma === 'crediario' ? 'Crediário' : comprovante.forma}</span>
              <span className="font-bold text-lg text-slate-900">{formatBRL(comprovante.total)}</span>
            </div>
            <div className="flex gap-3">
              <Button type="button" onClick={() => window.print()} className="flex-1"><Printer size={14} /> Imprimir</Button>
              <Button type="button" variant="secondary" onClick={() => setComprovante(null)}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Venda no crediário (gera parcelas em Contas a Receber) */}
      <Modal open={showVendaCred} onClose={() => setShowVendaCred(false)} title="Venda no Crediário" size="sm">
        <form onSubmit={handleVendaCred} className="space-y-4">
          <Combobox label="Cliente *" value={vcCliente} onChange={setVcCliente} options={clientes} placeholder="Buscar cliente..." />
          {vcCred && (
            <div className={`text-xs rounded-lg p-2 ${vcCred.status_efetivo === 'ativo' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
              Limite {formatBRL(Number(vcCred.limite_credito))} · disponível <strong>{formatBRL(Number(vcCred.limite_disponivel))}</strong>
              {vcCred.status_efetivo !== 'ativo' && ` · status: ${vcCred.status_efetivo}`}
            </div>
          )}
          <Input label="Valor total (R$) *" inputMode="numeric" value={formatMoedaInput(vcValor)} onChange={(e) => setVcValor(parseMoedaInput(e.target.value))} placeholder="0,00" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nº de parcelas *" inputMode="numeric" value={vcParcelas} onChange={(e) => setVcParcelas(e.target.value.replace(/\D/g, ''))} placeholder="2" required />
            <Input label="1º vencimento" type="date" value={vcVenc} onChange={(e) => setVcVenc(e.target.value)} />
          </div>
          {vcValor > 0 && parseInt(vcParcelas) > 0 && (
            <p className="text-xs text-slate-400">{vcParcelas}x de {formatBRL(vcValor / Math.max(1, parseInt(vcParcelas)))} · 1º venc.: {vcVenc ? new Date(vcVenc + 'T00:00:00').toLocaleDateString('pt-BR') : 'em ~30 dias'}</p>
          )}
          <Input label="Descrição (opcional)" value={vcDescricao} onChange={(e) => setVcDescricao(e.target.value)} placeholder="Ex: produtos vendidos" />
          <p className="text-[11px] text-slate-400">A venda no crediário não entra no caixa — gera as parcelas em Contas a Receber. Os recebimentos depois caem no caixa.</p>
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><CreditCard size={14} /> Gerar venda no crediário</Button>
            <Button type="button" variant="secondary" onClick={() => setShowVendaCred(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Aprovação da venda crediário (override de gestor) */}
      <Modal open={vcAprov} onClose={() => setVcAprov(false)} title={vcAprovTipo === 'inadimplente' ? 'Cliente com pendências' : 'Venda acima do limite'} size="sm">
        <form onSubmit={handleVcAprovar} className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{vcAprovMsg}</div>
          <p className="text-xs text-slate-500">Um gestor/admin precisa autorizar — fica registrado quem autorizou.</p>
          <Input label="E-mail do gestor *" type="email" value={vcEmail} onChange={(e) => setVcEmail(e.target.value)} autoComplete="off" required />
          <Input label="Senha do gestor *" type="password" value={vcSenha} onChange={(e) => setVcSenha(e.target.value)} autoComplete="off" required />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><CheckCircle2 size={14} /> Autorizar e vender</Button>
            <Button type="button" variant="secondary" onClick={() => setVcAprov(false)}>Cancelar venda</Button>
          </div>
        </form>
      </Modal>

      {/* Receber parcela de crediário (cai na gaveta) */}
      <Modal open={showCrediario} onClose={() => setShowCrediario(false)} title="Receber parcela de crediário" size="sm">
        <form onSubmit={handleReceberCrediario} className="space-y-4">
          <Combobox label="Cliente *" value={crCliente} onChange={setCrCliente} options={clientes} placeholder="Buscar cliente..." />
          {crCliente && (
            crParcelas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma parcela em aberto para este cliente.</p>
            ) : (
              <Select label="Parcela *" value={crParcelaId}
                onChange={(e) => {
                  const p = crParcelas.find((x) => x.id === e.target.value);
                  setCrParcelaId(e.target.value);
                  setCrValor(p ? Number(p.saldo) : 0);
                }}
                options={[
                  { value: '', label: 'Selecione...' },
                  ...crParcelas.map((p) => ({
                    value: p.id,
                    label: `${p.descricao} · vence ${new Date(p.data_vencimento).toLocaleDateString('pt-BR')} · saldo ${formatBRL(Number(p.saldo))}${p.dias_atraso > 0 ? ` (${p.dias_atraso}d atraso)` : ''}`,
                  })),
                ]} />
            )
          )}
          {crParcela && (
            <>
              <Input label="Valor recebido R$ *" inputMode="numeric"
                value={formatMoedaInput(crValor)} onChange={(e) => setCrValor(parseMoedaInput(e.target.value))} placeholder="0,00" required />
              {crValor > 0 && crValor < Number(crParcela.saldo) && (
                <div className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2">Parcial — saldo restante: {formatBRL(Number(crParcela.saldo) - crValor)}</div>
              )}
              <Select label="Forma" value={crForma} onChange={(e) => setCrForma(e.target.value)}
                options={FORMAS.map((f) => ({ value: f.value, label: f.label }))} />
            </>
          )}
          <div className="flex gap-3">
            <Button type="submit" variant="success" loading={saving} className="flex-1" disabled={!crParcela}>Receber no Caixa</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCrediario(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Sangria / Suprimento */}
      <Modal open={!!showFluxo} onClose={() => setShowFluxo(null)} title={showFluxo === 'sangria' ? 'Sangria (retirada)' : 'Suprimento (reforço)'} size="sm">
        <form onSubmit={handleFluxo} className="space-y-4">
          <Input label="Valor (R$) *" inputMode="numeric" autoFocus
            value={formatMoedaInput(fValor)} onChange={(e) => setFValor(parseMoedaInput(e.target.value))} placeholder="0,00" required />
          <Input label="Motivo *" value={fMotivo} onChange={(e) => setFMotivo(e.target.value)}
            placeholder={showFluxo === 'sangria' ? 'Ex: Depósito bancário' : 'Ex: Reforço de troco'} required />
          <p className="text-xs text-slate-400">Responsável: você (registrado automaticamente).</p>
          <div className="flex gap-3">
            <Button type="submit" variant={showFluxo === 'sangria' ? 'danger' : 'success'} loading={saving} className="flex-1">
              {showFluxo === 'sangria' ? 'Registrar Sangria' : 'Registrar Suprimento'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowFluxo(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Enviar para conferência */}
      <Modal open={showConf} onClose={() => setShowConf(false)} title="Fechar caixa (enviar para conferência)" size="sm">
        <form onSubmit={handleConferencia} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Saldo inicial</span><span>{formatBRL(saldoInicial)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">+ Entradas em dinheiro</span><span className="text-green-600">{formatBRL(entradasDinheiro)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">− Sangrias</span><span className="text-red-600">{formatBRL(totalSangrias)}</span></div>
            <div className="flex justify-between font-bold border-t border-slate-200 pt-1 mt-1"><span>Dinheiro esperado</span><span>{formatBRL(dinheiroEsperado)}</span></div>
          </div>
          <Input label="Dinheiro conferido na gaveta R$ *" inputMode="numeric"
            value={formatMoedaInput(cInformado)} onChange={(e) => setCInformado(parseMoedaInput(e.target.value))} placeholder="0,00" required />
          {cInformado > 0 && (() => {
            const dif = cInformado - dinheiroEsperado;
            return <div className={`p-2 rounded-lg text-sm text-center ${dif === 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{dif === 0 ? '✓ Caixa bate certinho' : `Diferença de ${formatBRL(dif)} (${dif > 0 ? 'sobra' : 'falta'})`}</div>;
          })()}
          <Input label="Observação" value={cObs} onChange={(e) => setCObs(e.target.value)} />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><Lock size={14} /> Enviar para conferência</Button>
            <Button type="button" variant="secondary" onClick={() => setShowConf(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-slate-400 text-center">Após o envio, um responsável confere a diferença e encerra o caixa.</p>
        </form>
      </Modal>

      {/* Reabrir */}
      <Modal open={!!showReabrir} onClose={() => setShowReabrir(null)} title="Reabrir Caixa" size="sm">
        <form onSubmit={handleReabrir} className="space-y-4">
          <p className="text-sm text-slate-500">A reabertura fica registrada na auditoria (quem, quando e por quê).</p>
          <Input label="Motivo *" value={motivoTxt} onChange={(e) => setMotivoTxt(e.target.value)} placeholder="Ex: lançamento esquecido" autoFocus required />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><RotateCcw size={14} /> Reabrir</Button>
            <Button type="button" variant="secondary" onClick={() => setShowReabrir(null)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Cancelar movimento */}
      <Modal open={!!showCancel} onClose={() => setShowCancel(null)} title="Cancelar Movimento" size="sm">
        <form onSubmit={handleCancelar} className="space-y-4">
          {showCancel && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm flex justify-between">
              <span className="text-slate-600">{CAT_LABEL[showCancel.categoria]}{showCancel.descricao ? ` · ${showCancel.descricao}` : ''}</span>
              <span className="font-bold">{formatBRL(Number(showCancel.valor))}</span>
            </div>
          )}
          <p className="text-xs text-slate-400">O movimento não é excluído — fica registrado como cancelado.</p>
          <Input label="Motivo do cancelamento *" value={motivoTxt} onChange={(e) => setMotivoTxt(e.target.value)} autoFocus required />
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5"><Lock size={13} /> Autorização do gestor</p>
            <Input label="E-mail do gestor *" type="email" value={gestorEmail} onChange={(e) => setGestorEmail(e.target.value)} placeholder="gestor@empresa.com" autoComplete="off" required />
            <Input label="Senha do gestor *" type="password" value={gestorSenha} onChange={(e) => setGestorSenha(e.target.value)} placeholder="••••••" autoComplete="off" required />
            <p className="text-[11px] text-amber-700">Um gestor/admin precisa autorizar. Fica registrado quem autorizou.</p>
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" loading={saving} className="flex-1"><Ban size={14} /> Cancelar Movimento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCancel(null)}>Voltar</Button>
          </div>
        </form>
      </Modal>

      {/* Relatório do dia */}
      <Modal open={showRelatorio} onClose={() => setShowRelatorio(false)} title="Relatório do Caixa" size="md">
        <div className="space-y-4" id="relatorio-caixa">
          <div className="text-sm">
            <p className="font-semibold text-slate-800">Resumo do dia</p>
            <p className="text-xs text-slate-400">{caixa ? `Aberto em ${new Date(caixa.aberto_em).toLocaleString('pt-BR')}` : ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Receitas por forma</p>
            <div className="space-y-1 text-sm">
              {FORMAS.map((f) => (
                <div key={f.value} className="flex justify-between"><span className="text-slate-500">{f.label}</span><span className="font-medium">{formatBRL(totaisPorForma[f.value] || 0)}</span></div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-1 font-bold"><span>Total recebido</span><span className="text-green-600">{formatBRL(totalRecebimentos)}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Saldo inicial</span><span>{formatBRL(saldoInicial)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Suprimentos</span><span className="text-green-600">{formatBRL(totalSuprimentos)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sangrias</span><span className="text-red-600">{formatBRL(totalSangrias)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Dinheiro esperado</span><span>{formatBRL(dinheiroEsperado)}</span></div>
          </div>
          {caixa && caixa.status !== 'aberto' && (
            <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 rounded-lg p-3 text-sm">
              <div><p className="text-xs text-slate-500">Esperado</p><p className="font-bold">{formatBRL(Number(caixa.saldo_calculado || 0))}</p></div>
              <div><p className="text-xs text-slate-500">Conferido</p><p className="font-bold">{formatBRL(Number(caixa.saldo_informado || 0))}</p></div>
              <div><p className="text-xs text-slate-500">Diferença</p><p className={`font-bold ${difConf === 0 ? 'text-green-600' : 'text-red-600'}`}>{difConf === 0 ? 'OK' : formatBRL(difConf)}</p></div>
            </div>
          )}
          <div className="flex justify-between bg-blue-600 text-white rounded-lg p-3 text-sm">
            <span className="font-semibold">Resultado operacional</span>
            <span className="font-bold">{formatBRL(resultadoOperacional)}</span>
          </div>
          <div className="flex gap-3">
            <Button type="button" onClick={() => window.print()} className="flex-1"><Printer size={14} /> Imprimir</Button>
            <Button type="button" variant="secondary" onClick={() => setShowRelatorio(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
