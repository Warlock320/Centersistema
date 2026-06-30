import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface EmpresaPublica {
  id: string;
  nome: string;
  logo_url: string | null;
  catalogo_ativo: boolean;
  catalogo_titulo: string | null;
  catalogo_descricao: string | null;
  catalogo_whatsapp: string | null;
  tema_cor_primaria: string | null;
}

interface ProdutoPublico {
  id: string;
  codigo: string | null;
  nome: string;
  preco: number;
  estoque: number;
  imagem_url: string | null;
  tags: string[] | null;
  aplicacoes: string[] | null;
  categoria_nome: string | null;
}

async function getData(slug: string) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: empresa } = await admin.from('empresas')
    .select('id, nome, logo_url, catalogo_ativo, catalogo_titulo, catalogo_descricao, catalogo_whatsapp, tema_cor_primaria')
    .eq('catalogo_slug', slug).single();
  const emp = empresa as EmpresaPublica | null;
  if (!emp || !emp.catalogo_ativo) return null;
  const { data: produtos } = await admin.from('v_catalogo_publico')
    .select('id, codigo, nome, preco, estoque, imagem_url, tags, aplicacoes, categoria_nome')
    .eq('empresa_nome', emp.nome).order('nome');
  return { empresa: emp, produtos: (produtos || []) as ProdutoPublico[] };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await getData(params.slug);
  if (!d) return { title: 'Catálogo' };
  const titulo = (d.empresa as { catalogo_titulo: string | null }).catalogo_titulo || (d.empresa as { nome: string }).nome;
  return { title: titulo, description: (d.empresa as { catalogo_descricao: string | null }).catalogo_descricao || '' };
}

export default async function CatalogoPage({ params }: { params: { slug: string } }) {
  const d = await getData(params.slug);
  if (!d) return notFound();

  const emp = d.empresa;
  const cor = emp.tema_cor_primaria || '#3b82f6';
  const titulo = emp.catalogo_titulo || emp.nome;
  const produtos = d.produtos;

  const categorias = [...new Set(produtos.map((p) => p.categoria_nome).filter(Boolean))];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: cor, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        {emp.logo_url && <img src={emp.logo_url} alt={emp.nome} style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', background: '#fff' }} />}
        <div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>{titulo}</h1>
          {emp.catalogo_descricao && <p style={{ color: 'rgba(255,255,255,0.8)', margin: '2px 0 0', fontSize: 13 }}>{emp.catalogo_descricao}</p>}
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Stats */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: '#64748b' }}>
            {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
          </span>
          {categorias.map((c) => (
            <a key={c} href={`#${c}`} style={{ background: cor + '15', border: `1px solid ${cor}40`, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: cor, textDecoration: 'none' }}>{c}</a>
          ))}
        </div>

        {/* Grid de produtos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {produtos.map((p) => (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 160, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {p.imagem_url
                  ? <img src={p.imagem_url} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 48 }}>📦</span>}
              </div>
              <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {p.categoria_nome && <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.categoria_nome}</span>}
                <p style={{ margin: '4px 0', fontWeight: 600, fontSize: 14, color: '#1e293b', lineHeight: 1.3 }}>{p.nome}</p>
                {p.codigo && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>Cód: {p.codigo}</p>}
                <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: cor }}>{brl(p.preco)}</span>
                  {p.estoque > 0
                    ? <span style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 20 }}>Em estoque</span>
                    : <span style={{ fontSize: 11, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: 20 }}>Esgotado</span>}
                </div>
                {emp.catalogo_whatsapp && (
                  <a href={`https://wa.me/${emp.catalogo_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${p.nome} (${brl(p.preco)})`)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ marginTop: 8, display: 'block', textAlign: 'center', background: '#25d366', color: '#fff', padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    Pedir via WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {produtos.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
            <span style={{ fontSize: 48 }}>🏪</span>
            <p style={{ marginTop: 16 }}>Nenhum produto disponível no momento.</p>
          </div>
        )}
      </div>

      <footer style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8', fontSize: 12, borderTop: '1px solid #e2e8f0', marginTop: 40 }}>
        Vitrine criada com <strong>BluesysERP</strong> by ZeroTr3z
      </footer>
    </div>
  );
}
