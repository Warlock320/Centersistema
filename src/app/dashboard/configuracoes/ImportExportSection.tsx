'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';

export default function ImportExportSection() {
  const toast = useToast();
  const supabase = createClient();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<'produtos' | 'clientes'>('produtos');

  async function exportCSV(table: 'produtos' | 'clientes') {
    setExporting(table);
    const sep = ';';
    const bom = '﻿';

    if (table === 'produtos') {
      const { data } = await supabase.from('produtos').select('codigo, ref, nome, preco, custo, estoque, estoque_minimo').eq('ativo', true).order('nome');
      const rows = (data || []) as Record<string, unknown>[];
      const header = ['Código', 'Referência', 'Nome', 'Preço', 'Custo', 'Estoque', 'Estoque Mínimo'].join(sep);
      const lines = rows.map((r) => [r.codigo || '', r.ref || '', r.nome, Number(r.preco).toFixed(2), Number(r.custo).toFixed(2), Number(r.estoque).toFixed(0), Number(r.estoque_minimo).toFixed(0)].join(sep));
      download(bom + [header, ...lines].join('\n'), `produtos_${new Date().toISOString().slice(0, 10)}.csv`);
    } else {
      const { data } = await supabase.from('clientes').select('nome, tipo, cpf_cnpj, email, telefone, celular, cidade, estado').eq('ativo', true).order('nome');
      const rows = (data || []) as Record<string, unknown>[];
      const header = ['Nome', 'Tipo', 'CPF/CNPJ', 'Email', 'Telefone', 'Celular', 'Cidade', 'Estado'].join(sep);
      const lines = rows.map((r) => [r.nome, r.tipo, r.cpf_cnpj || '', r.email || '', r.telefone || '', r.celular || '', r.cidade || '', r.estado || ''].join(sep));
      download(bom + [header, ...lines].join('\n'), `clientes_${new Date().toISOString().slice(0, 10)}.csv`);
    }
    setExporting('');
    toast.success(`${table === 'produtos' ? 'Produtos' : 'Clientes'} exportados!`);
  }

  function download(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').slice(1); // pula header
      const sep = text.includes(';') ? ';' : ',';

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      const empresaId = (usr as { empresa_id: string })?.empresa_id;
      if (!empresaId) throw new Error('Empresa não encontrada');

      let count = 0;
      if (importTarget === 'produtos') {
        for (const line of lines) {
          const [codigo, ref, nome, preco, custo, estoque, estoque_minimo] = line.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''));
          if (!nome) continue;
          await supabase.from('produtos').insert({
            empresa_id: empresaId, codigo: codigo || null, ref: ref || null, nome,
            preco: Number(preco?.replace(',', '.')) || 0, custo: Number(custo?.replace(',', '.')) || 0,
            estoque: Number(estoque?.replace(',', '.')) || 0, estoque_minimo: Number(estoque_minimo?.replace(',', '.')) || 0,
          });
          count++;
        }
      } else {
        for (const line of lines) {
          const [nome, tipo, cpf_cnpj, email, telefone, celular, cidade, estado] = line.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''));
          if (!nome) continue;
          await supabase.from('clientes').insert({
            empresa_id: empresaId, nome, tipo: tipo === 'juridica' ? 'juridica' : 'fisica',
            cpf_cnpj: cpf_cnpj || null, email: email || null, telefone: telefone || null,
            celular: celular || null, cidade: cidade || null, estado: estado || null,
          });
          count++;
        }
      }
      toast.success(`${count} ${importTarget === 'produtos' ? 'produto(s)' : 'cliente(s)'} importado(s)!`);
    } catch (err) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-blue-500" />
        <h2 className="font-semibold text-slate-900">Importar / Exportar Dados</h2>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Exportar */}
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Exportar para CSV</h3>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => exportCSV('produtos')} loading={exporting === 'produtos'}>
              <Download size={14} /> Exportar Produtos
            </Button>
            <Button variant="secondary" onClick={() => exportCSV('clientes')} loading={exporting === 'clientes'}>
              <Download size={14} /> Exportar Clientes
            </Button>
          </div>
        </div>

        {/* Importar */}
        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Importar de CSV</h3>
          <p className="text-xs text-slate-400 mb-3">
            O CSV deve ter cabeçalho na primeira linha. Separador: ponto-e-vírgula (;) ou vírgula (,).
          </p>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Tipo de dados</label>
              <select value={importTarget} onChange={(e) => setImportTarget(e.target.value as 'produtos' | 'clientes')}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
                <option value="produtos">Produtos</option>
                <option value="clientes">Clientes</option>
              </select>
            </div>
            <div>
              <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
              <Button onClick={() => inputRef.current?.click()} loading={importing}>
                <Upload size={14} /> Selecionar CSV
              </Button>
            </div>
          </div>
          <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
            <p className="font-medium mb-1">Formato esperado:</p>
            <p><strong>Produtos:</strong> Código;Referência;Nome;Preço;Custo;Estoque;Estoque Mínimo</p>
            <p><strong>Clientes:</strong> Nome;Tipo;CPF/CNPJ;Email;Telefone;Celular;Cidade;Estado</p>
          </div>
        </div>
      </div>
    </div>
  );
}
