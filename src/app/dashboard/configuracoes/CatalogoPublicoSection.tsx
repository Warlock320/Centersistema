'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Globe, Copy, CheckCircle, ExternalLink } from 'lucide-react';

export default function CatalogoPublicoSection() {
  const supabase = createClient();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [empresaId, setEmpresaId] = useState('');
  const [form, setForm] = useState({
    catalogo_ativo: false,
    catalogo_slug: '',
    catalogo_titulo: '',
    catalogo_descricao: '',
    catalogo_whatsapp: '',
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      if (!usr) return;
      const eid = (usr as { empresa_id: string }).empresa_id;
      setEmpresaId(eid);

      const { data: emp } = await supabase.from('empresas')
        .select('catalogo_ativo, catalogo_slug, catalogo_titulo, catalogo_descricao, catalogo_whatsapp')
        .eq('id', eid).single();
      if (emp) {
        const e = emp as typeof form;
        setForm({
          catalogo_ativo: e.catalogo_ativo || false,
          catalogo_slug: e.catalogo_slug || '',
          catalogo_titulo: e.catalogo_titulo || '',
          catalogo_descricao: e.catalogo_descricao || '',
          catalogo_whatsapp: e.catalogo_whatsapp || '',
        });
      }
      setLoading(false);
    })();
  }, [supabase]);

  async function handleSave() {
    if (!form.catalogo_slug.trim()) { toast.error('Defina um endereço (slug) para o catálogo.'); return; }
    if (!/^[a-z0-9-]+$/.test(form.catalogo_slug)) { toast.error('O endereço só pode ter letras minúsculas, números e hífens.'); return; }
    setSaving(true);
    const { error } = await supabase.from('empresas').update({
      catalogo_ativo: form.catalogo_ativo,
      catalogo_slug: form.catalogo_slug.toLowerCase(),
      catalogo_titulo: form.catalogo_titulo || null,
      catalogo_descricao: form.catalogo_descricao || null,
      catalogo_whatsapp: form.catalogo_whatsapp || null,
    }).eq('id', empresaId);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Catálogo salvo!');
    setSaving(false);
  }

  const catalogoUrl = form.catalogo_slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/loja/${form.catalogo_slug}` : '';

  function copiarLink() {
    navigator.clipboard.writeText(catalogoUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-slate-400">Carregando...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Vitrine Pública</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${form.catalogo_ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {form.catalogo_ativo ? 'Online' : 'Offline'}
          </span>
          <button onClick={() => setForm((p) => ({ ...p, catalogo_ativo: !p.catalogo_ativo }))}
            className={`w-11 h-6 rounded-full relative transition-colors ${form.catalogo_ativo ? 'bg-green-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${form.catalogo_ativo ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        <p className="text-sm text-slate-500">Crie uma vitrine pública com seus produtos. Qualquer pessoa com o link pode ver, sem precisar de login.</p>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Endereço da vitrine *</label>
          <div className="flex gap-2">
            <span className="flex items-center px-3 bg-slate-50 border border-slate-200 rounded-l-lg text-sm text-slate-400 whitespace-nowrap">/loja/</span>
            <input value={form.catalogo_slug} onChange={(e) => setForm((p) => ({ ...p, catalogo_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              placeholder="minha-loja" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-r-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          {form.catalogo_slug && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-blue-600 font-mono truncate">{catalogoUrl}</span>
              <button onClick={copiarLink} className="text-slate-400 hover:text-blue-600 shrink-0">
                {copiado ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
              <a href={catalogoUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 shrink-0">
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Título da vitrine" value={form.catalogo_titulo} onChange={(e) => setForm((p) => ({ ...p, catalogo_titulo: e.target.value }))} placeholder="Ex: Catálogo de Produtos" />
          <Input label="WhatsApp para pedidos" value={form.catalogo_whatsapp} onChange={(e) => setForm((p) => ({ ...p, catalogo_whatsapp: e.target.value }))} placeholder="5511999999999" />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">Descrição</label>
          <textarea value={form.catalogo_descricao} onChange={(e) => setForm((p) => ({ ...p, catalogo_descricao: e.target.value }))}
            placeholder="Ex: Peças e acessórios automotivos com entrega" rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
          Para controlar quais produtos aparecem na vitrine, use o campo <strong>"Visível no catálogo"</strong> no cadastro de cada produto.
        </div>

        <Button onClick={handleSave} loading={saving}><Globe size={15} /> Salvar vitrine</Button>
      </div>
    </div>
  );
}
