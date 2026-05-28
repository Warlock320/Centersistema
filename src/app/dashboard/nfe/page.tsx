'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { parseNfeXml, type NfeData } from '@/lib/nfe/parser';
import { Upload, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import type { Usuario } from '@/types/database.types';

type ItemStatus = 'novo' | 'atualizado' | 'existente';

interface ProcessItem {
  descricao: string;
  codigo: string;
  quantidade: number;
  custo: number;
  status: ItemStatus;
  produtoId?: string;
}

export default function NfePage() {
  const [nfeData, setNfeData] = useState<NfeData | null>(null);
  const [processItems, setProcessItems] = useState<ProcessItem[]>([]);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  async function processFile(file: File) {
    setError('');
    setWarning('');
    setSuccess('');
    setNfeData(null);
    setProcessItems([]);

    if (!file.name.endsWith('.xml')) {
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

    // Checa duplicidade
    const { data: dup } = await supabase
      .from('nfe_importadas')
      .select('id')
      .eq('chave_acesso', parsed.chaveAcesso)
      .single();

    if (dup) {
      setWarning(`NF-e #${parsed.numeroNota} já foi importada anteriormente (chave duplicada).`);
      return;
    }

    // Fuzzy matching de produtos
    const items: ProcessItem[] = await Promise.all(
      parsed.produtos.map(async (prod) => {
        // 1) Busca exata por código
        const { data: exact } = await supabase
          .from('produtos')
          .select('id')
          .eq('codigo', prod.codigo)
          .single();

        if (exact) {
          return { descricao: prod.descricao, codigo: prod.codigo, quantidade: prod.quantidade, custo: prod.valorUnitario, status: 'existente' as ItemStatus, produtoId: exact.id };
        }

        // 2) ilike por nome
        const { data: fuzzy } = await supabase
          .from('produtos')
          .select('id')
          .ilike('nome', `%${prod.descricao}%`)
          .limit(1)
          .single();

        if (fuzzy) {
          return { descricao: prod.descricao, codigo: prod.codigo, quantidade: prod.quantidade, custo: prod.valorUnitario, status: 'atualizado' as ItemStatus, produtoId: fuzzy.id };
        }

        return { descricao: prod.descricao, codigo: prod.codigo, quantidade: prod.quantidade, custo: prod.valorUnitario, status: 'novo' as ItemStatus };
      })
    );

    setNfeData({ ...parsed, xml_conteudo: text } as NfeData & { xml_conteudo: string });
    setProcessItems(items);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  async function handleImport() {
    if (!nfeData) return;
    setImporting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      const empresaId = (usr as Usuario)!.empresa_id;

      // Salva NF-e no histórico
      const { data: nfeRecord, error: nfeError } = await supabase
        .from('nfe_importadas')
        .insert({
          empresa_id: empresaId,
          chave_acesso: nfeData.chaveAcesso,
          numero_nota: nfeData.numeroNota,
          emitente_nome: nfeData.emitenteNome,
          valor_total: nfeData.valorTotal,
          xml_conteudo: (nfeData as NfeData & { xml_conteudo: string }).xml_conteudo,
        })
        .select()
        .single();

      if (nfeError) throw nfeError;

      // Processa cada item
      for (let i = 0; i < processItems.length; i++) {
        const item = processItems[i];
        const prod = nfeData.produtos[i];

        if (item.status === 'novo') {
          // Cria produto + movimentação de entrada
          const { data: newProd } = await supabase
            .from('produtos')
            .insert({
              empresa_id: empresaId,
              codigo: prod.codigo,
              nome: prod.descricao,
              preco: prod.valorUnitario * 1.3,
              custo: prod.valorUnitario,
              estoque: 0,
            })
            .select()
            .single();

          if (newProd) {
            await supabase.from('movimentacoes_estoque').insert({
              empresa_id: empresaId,
              produto_id: newProd.id,
              tipo: 'entrada',
              quantidade: prod.quantidade,
              custo_unitario: prod.valorUnitario,
              referencia_tipo: 'nfe',
              referencia_id: nfeRecord?.id || null,
              observacao: `NF-e #${nfeData.numeroNota} — ${nfeData.emitenteNome}`,
            });
          }
        } else if (item.produtoId) {
          // Atualiza custo e adiciona movimentação de entrada
          await supabase.from('produtos').update({ custo: prod.valorUnitario }).eq('id', item.produtoId);
          await supabase.from('movimentacoes_estoque').insert({
            empresa_id: empresaId,
            produto_id: item.produtoId,
            tipo: 'entrada',
            quantidade: prod.quantidade,
            custo_unitario: prod.valorUnitario,
            referencia_tipo: 'nfe',
            referencia_id: nfeRecord?.id || null,
            observacao: `NF-e #${nfeData.numeroNota} — ${nfeData.emitenteNome}`,
          });
        }
      }

      setSuccess(`NF-e #${nfeData.numeroNota} importada com sucesso! ${processItems.filter((i) => i.status === 'novo').length} produto(s) criado(s), ${processItems.filter((i) => i.status !== 'novo').length} atualizado(s).`);
      setNfeData(null);
      setProcessItems([]);
    } catch (e) {
      setError('Erro na importação: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImporting(false);
    }
  }

  const statusIcon = { novo: <span className="text-blue-500 text-xs font-medium">NOVO</span>, atualizado: <span className="text-green-500 text-xs font-medium">ENCONTRADO</span>, existente: <span className="text-slate-400 text-xs font-medium">JÁ EXISTE</span> };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar NF-e XML</h1>
        <p className="text-slate-500 text-sm">Importe notas fiscais para atualizar estoque automaticamente</p>
      </div>

      {/* Drop Zone */}
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

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
          <XCircle size={20} />{error}
        </div>
      )}
      {warning && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl">
          <AlertCircle size={20} />{warning}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl">
          <CheckCircle size={20} />{success}
        </div>
      )}

      {/* Preview */}
      {nfeData && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-blue-500" />
              <div>
                <h2 className="font-semibold text-slate-900">NF-e #{nfeData.numeroNota} — {nfeData.emitenteNome}</h2>
                <p className="text-xs text-slate-400">
                  Chave: {nfeData.chaveAcesso} · Total:{' '}
                  {Number(nfeData.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              {processItems.length} produto(s) na nota:
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2">Código</th>
                  <th className="text-left py-2">Descrição</th>
                  <th className="text-right py-2">Qtd</th>
                  <th className="text-right py-2">Custo Un.</th>
                  <th className="text-center py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {processItems.map((item, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="py-2 font-mono text-xs text-slate-500">{item.codigo || '—'}</td>
                    <td className="py-2 text-slate-800">{item.descricao}</td>
                    <td className="py-2 text-right">{item.quantidade}</td>
                    <td className="py-2 text-right">{Number(item.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="py-2 text-center">{statusIcon[item.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
            <Button onClick={handleImport} loading={importing}>
              Confirmar Importação
            </Button>
            <Button variant="secondary" onClick={() => { setNfeData(null); setProcessItems([]); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
