'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { parseNfeXml, type NfeData } from '@/lib/nfe/parser';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { Upload, CheckCircle, XCircle, AlertCircle, FileText, Boxes, Building2, Receipt } from 'lucide-react';
import type { Usuario, Categoria } from '@/types/database.types';

type Arredondamento = 'nenhum' | '99' | 'inteiro';

interface ImportItem {
  // dados do XML
  codigo: string;
  descricao: string;
  ean: string;
  ncm: string;
  unidade: string;
  quantidade: number;       // qtd na nota (ex.: 5 caixas)
  valorUnitario: number;    // custo da unidade comercial (ex.: da caixa)
  valorTotal: number;
  // casamento
  novo: boolean;
  produtoId?: string;
  auxAtuais: string[];      // codigos_auxiliares já cadastrados (para mesclar EAN)
  // configuração do usuário
  incluir: boolean;
  categoria: string;        // id da categoria ('' = nenhuma)
  fator: number;            // desmembramento (ex.: caixa de 12 -> 12)
  markup: number;           // %
  precoFinal: number;
  precoManual: boolean;
}

const moeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const digits = (s: string) => (s || '').replace(/\D/g, '');

function arredondar(v: number, modo: Arredondamento): number {
  if (v <= 0) return 0;
  if (modo === '99') return Math.floor(v) + 0.99;
  if (modo === 'inteiro') return Math.round(v);
  return Math.round(v * 100) / 100;
}
const custoUnit = (it: ImportItem) => (it.fator > 0 ? it.valorUnitario / it.fator : it.valorUnitario);
const precoSugerido = (it: ImportItem, arred: Arredondamento) =>
  arredondar(custoUnit(it) * (1 + (it.markup || 0) / 100), arred);

export default function NfePage() {
  const [nfeData, setNfeData] = useState<(NfeData & { xml_conteudo: string }) | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [empresaId, setEmpresaId] = useState<string>('');

  // globais
  const [markupGlobal, setMarkupGlobal] = useState(30);
  const [arred, setArred] = useState<Arredondamento>('nenhum');
  const [categoriaGlobal, setCategoriaGlobal] = useState('');
  const [gerarContaPagar, setGerarContaPagar] = useState(true);

  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      if (usr) setEmpresaId((usr as Usuario).empresa_id);
      const { data: cats } = await supabase.from('categorias').select('*').order('nome');
      if (cats) setCategorias(cats as Categoria[]);
    })();
  }, [supabase]);

  const catOptions = categorias.map((c) => ({ value: c.id, label: c.nome }));

  async function criarCategoria(nome: string, aplicarItem?: number) {
    const nm = nome.trim();
    if (!nm || !empresaId) return;
    const { data } = await supabase.from('categorias').insert({ nome: nm, empresa_id: empresaId }).select().single();
    const { data: cats } = await supabase.from('categorias').select('*').order('nome');
    if (cats) setCategorias(cats as Categoria[]);
    const novaId = (data as Categoria)?.id;
    if (novaId && aplicarItem !== undefined) updateItem(aplicarItem, { categoria: novaId });
    if (novaId && aplicarItem === undefined) setCategoriaGlobal(novaId);
  }

  function updateItem(i: number, patch: Partial<ImportItem>) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const merged = { ...it, ...patch };
        // recalcula preço se mexeu em fator/markup e o preço não foi editado à mão
        const mexeuPreco = 'fator' in patch || 'markup' in patch;
        if (mexeuPreco && !merged.precoManual) merged.precoFinal = precoSugerido(merged, arred);
        return merged;
      })
    );
  }

  // Recalcula todos os preços (usado ao mudar arredondamento global)
  function recalcularTodos(novoArred: Arredondamento) {
    setItems((prev) => prev.map((it) => (it.precoManual ? it : { ...it, precoFinal: precoSugerido(it, novoArred) })));
  }

  // Aplica markup/categoria globais a todos os itens (reseta preço manual)
  function aplicarGlobais() {
    setItems((prev) =>
      prev.map((it) => {
        const merged = { ...it, markup: markupGlobal, categoria: categoriaGlobal || it.categoria, precoManual: false };
        merged.precoFinal = precoSugerido(merged, arred);
        return merged;
      })
    );
  }

  async function processFile(file: File) {
    setError(''); setWarning(''); setSuccess(''); setNfeData(null); setItems([]);

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setError('Selecione um arquivo .xml de NF-e');
      return;
    }
    const text = await file.text();

    let parsed: NfeData;
    try {
      parsed = parseNfeXml(text);
    } catch (e) {
      setError('Erro ao processar XML: ' + (e instanceof Error ? e.message : String(e)));
      return;
    }

    // Duplicidade
    const { data: dup } = await supabase
      .from('nfe_importadas').select('id').eq('chave_acesso', parsed.chaveAcesso).maybeSingle();
    if (dup) {
      setWarning(`NF-e #${parsed.numeroNota} já foi importada anteriormente (chave duplicada).`);
      return;
    }

    // Casamento de produtos (anti-duplicação): cada chave da nota (código e EAN)
    // é comparada contra codigo, ref e codigos_auxiliares do produto.
    const novos: ImportItem[] = await Promise.all(
      parsed.produtos.map(async (p) => {
        let produtoId: string | undefined;
        let auxAtuais: string[] = [];

        const keys = Array.from(new Set([p.codigo, p.ean].filter(Boolean)));
        if (keys.length) {
          const conds = keys.flatMap((k) => {
            const q = String(k).replace(/["{}(),]/g, ''); // sanitiza p/ o filtro PostgREST
            return [`codigo.eq."${q}"`, `ref.eq."${q}"`, `codigos_auxiliares.cs.{"${q}"}`];
          });
          const { data } = await supabase.from('produtos')
            .select('id, codigos_auxiliares').or(conds.join(',')).limit(1);
          if (data && data.length) { produtoId = data[0].id; auxAtuais = data[0].codigos_auxiliares || []; }
        }

        const base: ImportItem = {
          codigo: p.codigo, descricao: p.descricao, ean: p.ean, ncm: p.ncm, unidade: p.unidade,
          quantidade: p.quantidade, valorUnitario: p.valorUnitario, valorTotal: p.valorTotal,
          novo: !produtoId, produtoId, auxAtuais,
          incluir: true, categoria: '', fator: p.fatorSugerido || 1, markup: markupGlobal,
          precoFinal: 0, precoManual: false,
        };
        base.precoFinal = precoSugerido(base, arred);
        return base;
      })
    );

    setNfeData({ ...parsed, xml_conteudo: text });
    setItems(novos);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function handleImport() {
    if (!nfeData || !empresaId) return;
    const incluidos = items.filter((i) => i.incluir);
    if (incluidos.length === 0) { setError('Selecione ao menos um item para importar.'); return; }

    setImporting(true); setError('');
    try {
      // 1) Fornecedor (emitente): busca por CNPJ, cria se não existir
      let fornecedorId: string | null = null;
      const cnpj = digits(nfeData.emitenteCnpj);
      if (cnpj) {
        const { data: forn } = await supabase.from('fornecedores')
          .select('id').eq('empresa_id', empresaId).eq('cnpj_cpf', cnpj).maybeSingle();
        if (forn) {
          fornecedorId = forn.id;
        } else {
          const { data: novoForn } = await supabase.from('fornecedores').insert({
            empresa_id: empresaId, nome: nfeData.emitenteNome, razao_social: nfeData.emitenteNome,
            cnpj_cpf: cnpj, tipo: 'juridica', ativo: true,
          }).select('id').single();
          fornecedorId = novoForn?.id || null;
        }
      }

      // 2) Histórico da NF-e
      const { data: nfeRecord, error: nfeError } = await supabase.from('nfe_importadas').insert({
        empresa_id: empresaId,
        chave_acesso: nfeData.chaveAcesso,
        numero_nota: nfeData.numeroNota,
        emitente_nome: nfeData.emitenteNome,
        valor_total: nfeData.valorTotal,
        xml_conteudo: nfeData.xml_conteudo,
      }).select('id').single();
      if (nfeError) throw nfeError;
      const nfeId = nfeRecord?.id || null;

      const criadosSet = new Set<string>();
      const atualizadosSet = new Set<string>();
      const mapRun = new Map<string, string>(); // chaves desta nota já resolvidas -> produtoId

      // 3) Produtos + entrada de estoque (com desmembramento)
      for (const it of incluidos) {
        const fator = Math.max(1, Math.floor(it.fator) || 1);
        const custoU = it.valorUnitario / fator;
        const qtdEntrada = it.quantidade * fator;
        const keys = [it.codigo, it.ean].filter(Boolean) as string[];

        // se um item anterior da MESMA nota já resolveu este produto, reaproveita
        const jaNoRun = keys.map((k) => mapRun.get(k)).find(Boolean);
        let produtoId = jaNoRun || it.produtoId;

        if (!produtoId) {
          const { data: novoProd, error: prodErr } = await supabase.from('produtos').insert({
            empresa_id: empresaId,
            codigo: it.codigo || null,
            nome: it.descricao,
            ncm: it.ncm || null,
            categoria: it.categoria || null,
            fornecedor_id: fornecedorId,
            codigos_auxiliares: it.ean ? [it.ean] : [],
            preco: it.precoFinal,
            custo: custoU,
            estoque: 0,
          }).select('id').single();
          if (prodErr) throw prodErr;
          produtoId = novoProd?.id;
          if (produtoId) criadosSet.add(produtoId);
        } else {
          const aux = new Set(jaNoRun ? [] : it.auxAtuais);
          if (it.ean) aux.add(it.ean);
          const update: Record<string, unknown> = {
            custo: custoU,
            preco: it.precoFinal,
            codigos_auxiliares: Array.from(aux),
          };
          if (fornecedorId) update.fornecedor_id = fornecedorId;
          if (it.ncm) update.ncm = it.ncm;
          if (it.categoria) update.categoria = it.categoria;
          await supabase.from('produtos').update(update).eq('id', produtoId);
          if (!criadosSet.has(produtoId)) atualizadosSet.add(produtoId);
        }

        if (produtoId) {
          keys.forEach((k) => mapRun.set(k, produtoId!));
          await supabase.from('movimentacoes_estoque').insert({
            empresa_id: empresaId,
            produto_id: produtoId,
            tipo: 'entrada',
            quantidade: qtdEntrada,
            custo_unitario: custoU,
            referencia_tipo: 'nfe',
            referencia_id: nfeId,
            observacao: `NF-e #${nfeData.numeroNota} — ${nfeData.emitenteNome}`,
          });
        }
      }

      // 4) Conta(s) a pagar a partir das duplicatas
      let contasGeradas = 0;
      if (gerarContaPagar) {
        const hoje = new Date().toISOString().slice(0, 10);
        const dups = nfeData.duplicatas.length > 0
          ? nfeData.duplicatas
          : [{ numero: '', vencimento: hoje, valor: nfeData.valorTotal }];
        const total = dups.length;
        for (let p = 0; p < dups.length; p++) {
          const d = dups[p];
          const venc = (d.vencimento || hoje).slice(0, 10);
          await supabase.from('contas_pagar').insert({
            empresa_id: empresaId,
            fornecedor_id: fornecedorId,
            nfe_id: nfeId,
            descricao: `NF-e #${nfeData.numeroNota} — ${nfeData.emitenteNome}${total > 1 ? ` (parc ${p + 1}/${total})` : ''}`,
            valor: d.valor,
            data_emissao: hoje,
            data_vencimento: venc,
            status: d.valor <= 500 ? 'aprovado' : 'pendente',
            numero_parcela: p + 1,
            total_parcelas: total,
          });
          contasGeradas++;
        }
      }

      const partes = [`${criadosSet.size} criado(s)`, `${atualizadosSet.size} atualizado(s)`];
      if (contasGeradas) partes.push(`${contasGeradas} conta(s) a pagar`);
      setSuccess(`NF-e #${nfeData.numeroNota} importada! ${partes.join(', ')}.`);
      setNfeData(null); setItems([]);
    } catch (e) {
      setError('Erro na importação: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  }

  const totalDup = nfeData?.duplicatas.reduce((s, d) => s + d.valor, 0) || 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar NF-e XML</h1>
        <p className="text-slate-500 text-sm">Cadastra produtos, alimenta estoque e gera contas a pagar a partir da nota</p>
      </div>

      {/* Drop Zone */}
      {!nfeData && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <input ref={inputRef} type="file" accept=".xml" className="hidden" onChange={handleFileChange} />
          <Upload size={36} className="text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">Arraste o arquivo XML ou clique para selecionar</p>
          <p className="text-slate-400 text-sm mt-1">Apenas arquivos NF-e (.xml)</p>
        </div>
      )}

      {/* Alerts */}
      {error && <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl"><XCircle size={20} />{error}</div>}
      {warning && <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl"><AlertCircle size={20} />{warning}</div>}
      {success && <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl"><CheckCircle size={20} />{success}</div>}

      {nfeData && (
        <>
          {/* Cabeçalho da nota */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-4">
            <div className="flex items-start gap-3">
              <FileText size={20} className="text-blue-500 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">NF-e #{nfeData.numeroNota} — {nfeData.emitenteNome}</h2>
                <p className="text-xs text-slate-400 break-all">Chave: {nfeData.chaveAcesso}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1"><Building2 size={13} /> Fornecedor: <b>{nfeData.emitenteNome}</b> {nfeData.emitenteCnpj && `(${nfeData.emitenteCnpj})`}</span>
                  <span>Total: <b>{moeda(nfeData.valorTotal)}</b></span>
                  {nfeData.duplicatas.length > 0 && (
                    <span className="inline-flex items-center gap-1"><Receipt size={13} /> {nfeData.duplicatas.length} duplicata(s): {moeda(totalDup)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Parâmetros globais */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Precificação em massa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <label className="text-sm">
                <span className="text-slate-500 text-xs">Markup padrão (%)</span>
                <input type="number" value={markupGlobal} min={0}
                  onChange={(e) => setMarkupGlobal(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm">
                <span className="text-slate-500 text-xs">Arredondamento</span>
                <select value={arred}
                  onChange={(e) => { const v = e.target.value as Arredondamento; setArred(v); recalcularTodos(v); }}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                  <option value="nenhum">Valor aberto (exato)</option>
                  <option value="99">Final ,99</option>
                  <option value="inteiro">Inteiro (sem centavos)</option>
                </select>
              </label>
              <div className="text-sm">
                <span className="text-slate-500 text-xs">Categoria padrão</span>
                <Combobox value={categoriaGlobal} onChange={setCategoriaGlobal} options={catOptions}
                  placeholder="Buscar ou criar..." createLabel="Nova categoria" onCreate={(t) => criarCategoria(t)} />
              </div>
              <Button variant="secondary" onClick={aplicarGlobais}>Aplicar a todos</Button>
            </div>
            <label className="flex items-center gap-2 mt-4 text-sm text-slate-700">
              <input type="checkbox" checked={gerarContaPagar} onChange={(e) => setGerarContaPagar(e.target.checked)} className="rounded" />
              Gerar conta(s) a pagar a partir da nota
              {nfeData.duplicatas.length > 0
                ? <span className="text-slate-400 text-xs">({nfeData.duplicatas.length} parcela(s), total {moeda(totalDup)})</span>
                : <span className="text-slate-400 text-xs">(à vista — 1 conta de {moeda(nfeData.valorTotal)})</span>}
            </label>
          </div>

          {/* Itens */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">{items.length} item(ns) na nota</h3>
            {items.map((it, i) => {
              const fator = Math.max(1, Math.floor(it.fator) || 1);
              const custoU = it.valorUnitario / fator;
              const qtdEntrada = it.quantidade * fator;
              return (
                <div key={i} className={`bg-white rounded-xl border shadow-sm px-4 py-3 ${it.incluir ? 'border-slate-100' : 'border-slate-100 opacity-50'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={it.incluir} onChange={(e) => updateItem(i, { incluir: e.target.checked })} className="mt-1 rounded" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${it.novo ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{it.novo ? 'NOVO' : 'JÁ EXISTE'}</span>
                        <span className="font-medium text-slate-800 text-sm">{it.descricao}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                        {it.codigo && <span>Cód: {it.codigo}</span>}
                        {it.ean && <span>EAN: {it.ean}</span>}
                        {it.ncm && <span>NCM: {it.ncm}</span>}
                        <span>Un: {it.unidade}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
                        <div className="text-xs">
                          <span className="text-slate-400">Qtd nota</span>
                          <div className="font-medium text-slate-700 py-1.5">{it.quantidade} {it.unidade}</div>
                        </div>
                        <label className="text-xs">
                          <span className="text-slate-400 inline-flex items-center gap-1"><Boxes size={12} /> Fator (desmembrar)</span>
                          <input type="number" min={1} value={it.fator}
                            onChange={(e) => updateItem(i, { fator: Number(e.target.value) })}
                            className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg" />
                        </label>
                        <div className="text-xs">
                          <span className="text-slate-400">Entra no estoque</span>
                          <div className="font-semibold text-green-600 py-1.5">{qtdEntrada} un</div>
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-400">Custo un.</span>
                          <div className="font-medium text-slate-700 py-1.5">{moeda(custoU)}<span className="text-slate-300"> /{moeda(it.valorUnitario)}</span></div>
                        </div>
                        <label className="text-xs">
                          <span className="text-slate-400">Markup %</span>
                          <input type="number" min={0} value={it.markup}
                            onChange={(e) => updateItem(i, { markup: Number(e.target.value) })}
                            className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg" />
                        </label>
                        <label className="text-xs">
                          <span className="text-slate-400">Preço venda</span>
                          <input type="text" inputMode="numeric" value={formatMoedaInput(it.precoFinal)} placeholder="0,00"
                            onChange={(e) => updateItem(i, { precoFinal: parseMoedaInput(e.target.value), precoManual: true })}
                            className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg font-medium" />
                        </label>
                      </div>

                      <div className="mt-3 max-w-xs">
                        <Combobox label="Categoria" value={it.categoria} onChange={(v) => updateItem(i, { categoria: v })}
                          options={catOptions} placeholder="Buscar ou criar..." createLabel="Nova categoria"
                          onCreate={(t) => criarCategoria(t, i)} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-3 sticky bottom-0 bg-white/80 backdrop-blur py-3 -mx-4 px-4 border-t border-slate-100">
            <Button onClick={handleImport} loading={importing}>Confirmar importação ({items.filter((i) => i.incluir).length})</Button>
            <Button variant="secondary" onClick={() => { setNfeData(null); setItems([]); }}>Cancelar</Button>
          </div>
        </>
      )}
    </div>
  );
}
