'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { ShieldCheck, FileKey, Trash2, AlertTriangle, CheckCircle, Upload } from 'lucide-react';

interface CertMeta {
  titular_nome: string | null;
  titular_cnpj: string | null;
  validade: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const dataBR = (s: string | null) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—');

export default function CertificadoSection() {
  const toast = useToast();
  const [cert, setCert] = useState<CertMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [senha, setSenha] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const res = await fetch('/api/certificado');
      const json = await res.json();
      if (res.ok) setCert(json.certificado);
    } finally {
      setLoading(false);
    }
  }

  async function importar() {
    if (!arquivo) { toast.error('Selecione o arquivo .pfx/.p12.'); return; }
    if (!senha) { toast.error('Informe a senha do certificado.'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('senha', senha);
      const res = await fetch('/api/certificado', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao importar certificado.'); return; }
      toast.success('Certificado importado com sucesso.');
      setSenha(''); setArquivo(null);
      if (inputRef.current) inputRef.current.value = '';
      carregar();
    } catch {
      toast.error('Erro de conexão ao importar.');
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (!confirm('Remover o certificado digital desta empresa?')) return;
    setRemovendo(true);
    try {
      const res = await fetch('/api/certificado', { method: 'DELETE' });
      if (!res.ok) { const j = await res.json(); toast.error(j.error || 'Erro ao remover.'); return; }
      toast.success('Certificado removido.');
      setCert(null);
    } finally {
      setRemovendo(false);
    }
  }

  const expirado = cert?.validade ? cert.validade < new Date().toISOString().slice(0, 10) : false;
  const venceEmBreve = cert?.validade && !expirado
    ? (new Date(cert.validade).getTime() - Date.now()) / 86400000 <= 30 : false;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <ShieldCheck size={18} className="text-blue-500" />
        <h2 className="font-semibold text-slate-900">Certificado Digital (NF-e)</h2>
      </div>

      <div className="px-6 py-6 space-y-5">
        <p className="text-sm text-slate-500">
          Certificado <b>A1 (e-CNPJ)</b> usado para consultar notas fiscais junto à SEFAZ.
          O arquivo e a senha ficam protegidos no servidor — nunca são exibidos depois de salvos.
        </p>

        {/* Status atual */}
        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : cert ? (
          <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border ${
            expirado ? 'bg-red-50 border-red-200' : venceEmBreve ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
          }`}>
            <FileKey size={20} className={expirado ? 'text-red-500' : venceEmBreve ? 'text-amber-600' : 'text-green-600'} />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800">{cert.titular_nome || 'Certificado instalado'}</p>
              <p className="text-slate-500">
                {cert.titular_cnpj && <>CNPJ {cert.titular_cnpj} · </>}
                Validade: <b>{dataBR(cert.validade)}</b>
                {expirado && <span className="text-red-600 font-medium"> · EXPIRADO</span>}
                {venceEmBreve && <span className="text-amber-700 font-medium"> · vence em breve</span>}
              </p>
            </div>
            <Button variant="secondary" onClick={remover} loading={removendo}><Trash2 size={15} /> Remover</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
            <AlertTriangle size={16} /> Nenhum certificado instalado.
          </div>
        )}

        {/* Importar / substituir */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <h3 className="text-sm font-medium text-slate-700">{cert ? 'Substituir certificado' : 'Importar certificado'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <label className="text-sm">
              <span className="text-slate-500 text-xs">Arquivo (.pfx / .p12)</span>
              <input ref={inputRef} type="file" accept=".pfx,.p12" onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                className="block w-full mt-1 text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-sm hover:file:bg-slate-200" />
            </label>
            <label className="text-sm">
              <span className="text-slate-500 text-xs">Senha do certificado</span>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••"
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
            </label>
          </div>
          <Button onClick={importar} loading={enviando} disabled={!arquivo || !senha}>
            <Upload size={15} /> {cert ? 'Substituir' : 'Importar'}
          </Button>
          {arquivo && <span className="ml-3 text-xs text-slate-500 inline-flex items-center gap-1"><CheckCircle size={13} /> {arquivo.name}</span>}
        </div>
      </div>
    </div>
  );
}
