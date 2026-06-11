'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { parseNfeXml } from '@/lib/nfe/parser';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { matchBusca } from '@/lib/busca';
import { Upload, FileText, Download, Trash2, XCircle, CheckCircle, Search } from 'lucide-react';
import type { NotaSaida, Cliente } from '@/types/database.types';

const BUCKET = 'notas-fiscais';
const moeda = (v: number | null) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dataBR = (s: string | null) => (s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—');
const tipoArquivo = (nome: string) => {
  const n = nome.toLowerCase();
  if (n.endsWith('.xml')) return 'xml';
  if (n.endsWith('.pdf')) return 'pdf';
  return 'outro';
};

export default function NotasSaida({ empresaId }: { empresaId: string }) {
  const supabase = createClient();
  const [notas, setNotas] = useState<NotaSaida[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // formulário de envio
  const [modal, setModal] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ numero_nota: '', chave_acesso: '', destinatario_nome: '', destinatario_doc: '', cliente_id: '', valor_total: 0, data_emissao: '' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      await carregar();
      const { data: cli } = await supabase.from('clientes').select('id, nome').order('nome');
      if (cli) setClientes(cli as Cliente[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('notas_saida').select('*').order('data_emissao', { ascending: false }).order('created_at', { ascending: false });
    setNotas((data as NotaSaida[]) || []);
    setLoading(false);
  }

  const filtradas = notas.filter((n) => {
    const texto = `${n.numero_nota || ''} ${n.destinatario_nome || ''} ${n.destinatario_doc || ''} ${n.chave_acesso || ''} ${n.arquivo_nome}`;
    const matchQ = matchBusca(texto, busca);
    const ref = n.data_emissao || n.created_at.slice(0, 10);
    const matchDe = !de || ref >= de;
    const matchAte = !ate || ref <= ate;
    return matchQ && matchDe && matchAte;
  });

  function resetForm() {
    setArquivo(null);
    setForm({ numero_nota: '', chave_acesso: '', destinatario_nome: '', destinatario_doc: '', cliente_id: '', valor_total: 0, data_emissao: '' });
  }

  async function onPickFile(file: File) {
    setError('');
    setArquivo(file);
    // Se for XML, tenta ler os dados automaticamente
    if (file.name.toLowerCase().endsWith('.xml')) {
      try {
        const txt = await file.text();
        const d = parseNfeXml(txt);
        setForm({
          numero_nota: d.numeroNota ? String(d.numeroNota) : '',
          chave_acesso: d.chaveAcesso || '',
          destinatario_nome: d.destinatario.nome || '',
          destinatario_doc: d.destinatario.doc || '',
          cliente_id: '',
          valor_total: d.valorTotal || 0,
          data_emissao: d.dataEmissao ? d.dataEmissao.slice(0, 10) : '',
        });
      } catch {
        setError('Não consegui ler este XML automaticamente — preencha os campos manualmente.');
      }
    }
  }

  async function enviar() {
    if (!arquivo || !empresaId) { setError('Selecione um arquivo.'); return; }
    setSalvando(true);
    setError('');
    try {
      // dedup por chave (quando houver)
      const chave = form.chave_acesso.trim() || null;
      if (chave) {
        const { data: dup } = await supabase.from('notas_saida').select('id').eq('chave_acesso', chave).maybeSingle();
        if (dup) { setError('Esta nota de saída já foi enviada (chave duplicada).'); setSalvando(false); return; }
      }

      // upload para o Storage: {empresa_id}/{uuid}_{nome}
      const safe = arquivo.name.replace(/[^\w.\-]/g, '_');
      const path = `${empresaId}/${crypto.randomUUID()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arquivo, { upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('notas_saida').insert({
        empresa_id: empresaId,
        chave_acesso: chave,
        numero_nota: form.numero_nota.trim() || null,
        destinatario_nome: form.destinatario_nome.trim() || null,
        destinatario_doc: form.destinatario_doc.trim() || null,
        cliente_id: form.cliente_id || null,
        valor_total: form.valor_total || null,
        data_emissao: form.data_emissao || null,
        arquivo_path: path,
        arquivo_nome: arquivo.name,
        arquivo_tipo: tipoArquivo(arquivo.name),
      });
      if (insErr) { await supabase.storage.from(BUCKET).remove([path]); throw insErr; }

      setSuccess('Nota de saída enviada.');
      setTimeout(() => setSuccess(''), 3000);
      setModal(false);
      resetForm();
      carregar();
    } catch (e) {
      setError('Erro ao enviar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSalvando(false);
    }
  }

  async function baixar(n: NotaSaida) {
    setError('');
    const { data, error: err } = await supabase.storage.from(BUCKET).download(n.arquivo_path);
    if (err || !data) { setError('Não foi possível baixar o arquivo.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = n.arquivo_nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function excluir(n: NotaSaida) {
    if (!confirm(`Excluir a nota ${n.numero_nota || n.arquivo_nome}? O arquivo será removido.`)) return;
    await supabase.storage.from(BUCKET).remove([n.arquivo_path]);
    await supabase.from('notas_saida').delete().eq('id', n.id);
    carregar();
  }

  return (
    <div className="space-y-4">
      {error && <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl"><XCircle size={20} />{error}</div>}
      {success && <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl"><CheckCircle size={20} />{success}</div>}

      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº, destinatário, chave..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 max-w-full" />
          </div>
          <label className="text-xs text-slate-500">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="block mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" /></label>
          <label className="text-xs text-slate-500">Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="block mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" /></label>
        </div>
        <Button onClick={() => { resetForm(); setModal(true); }}><Upload size={16} /> Enviar nota de saída</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left px-4 py-3">Nº</th>
              <th className="text-left px-4 py-3">Destinatário</th>
              <th className="text-left px-4 py-3">Emissão</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-left px-4 py-3">Arquivo</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhuma nota de saída enviada.</td></tr>}
            {filtradas.map((n) => (
              <tr key={n.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{n.numero_nota || '—'}</td>
                <td className="px-4 py-3 text-slate-700">{n.destinatario_nome || '—'}<span className="block text-xs text-slate-400">{n.destinatario_doc}</span></td>
                <td className="px-4 py-3 text-slate-600">{dataBR(n.data_emissao)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{moeda(n.valor_total)}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-xs text-slate-500"><FileText size={13} /> {n.arquivo_tipo?.toUpperCase()}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => baixar(n)} title="Baixar" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={16} /></button>
                    <button onClick={() => excluir(n)} title="Excluir" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de envio */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Upload size={18} className="text-blue-500" />
              <h2 className="font-semibold text-slate-900">Enviar nota de saída</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center cursor-pointer hover:border-blue-400">
                <input ref={inputRef} type="file" accept=".xml,.pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} />
                <FileText size={24} className="text-slate-300 mx-auto mb-1" />
                <p className="text-sm text-slate-600">{arquivo ? arquivo.name : 'Clique para selecionar o XML ou PDF'}</p>
                {arquivo && <p className="text-xs text-slate-400 mt-0.5">Trocar arquivo</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm"><span className="text-slate-500 text-xs">Número</span>
                  <input value={form.numero_nota} onChange={(e) => setForm((p) => ({ ...p, numero_nota: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></label>
                <label className="text-sm"><span className="text-slate-500 text-xs">Emissão</span>
                  <input type="date" value={form.data_emissao} onChange={(e) => setForm((p) => ({ ...p, data_emissao: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></label>
              </div>
              <label className="text-sm block"><span className="text-slate-500 text-xs">Destinatário</span>
                <input value={form.destinatario_nome} onChange={(e) => setForm((p) => ({ ...p, destinatario_nome: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm"><span className="text-slate-500 text-xs">CPF/CNPJ</span>
                  <input value={form.destinatario_doc} onChange={(e) => setForm((p) => ({ ...p, destinatario_doc: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></label>
                <label className="text-sm"><span className="text-slate-500 text-xs">Valor</span>
                  <input inputMode="numeric" value={formatMoedaInput(form.valor_total)} placeholder="0,00" onChange={(e) => setForm((p) => ({ ...p, valor_total: parseMoedaInput(e.target.value) }))} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" /></label>
              </div>
              <div className="text-sm">
                <Combobox label="Cliente (opcional)" value={form.cliente_id} onChange={(v) => setForm((p) => ({ ...p, cliente_id: v }))}
                  options={clientes.map((c) => ({ value: c.id, label: c.nome }))} placeholder="Vincular a um cliente..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <Button onClick={enviar} loading={salvando} disabled={!arquivo}>Enviar</Button>
              <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
