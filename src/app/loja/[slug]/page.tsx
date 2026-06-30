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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getData(slug);
  if (!d) return { title: 'Catálogo' };
  const titulo = d.empresa.catalogo_titulo || d.empresa.nome;
  return { title: titulo, description: d.empresa.catalogo_descricao || '', openGraph: { title: titulo, images: d.empresa.logo_url ? [d.empresa.logo_url] : [] } };
}

export default async function CatalogoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getData(slug);
  if (!d) return notFound();

  const { empresa: emp, produtos } = d;
  const cor = emp.tema_cor_primaria || '#3b82f6';
  const titulo = emp.catalogo_titulo || emp.nome;
  const categorias = [...new Set(produtos.map((p) => p.categoria_nome).filter(Boolean))] as string[];
  const total = produtos.length;
  const emEstoque = produtos.filter((p) => p.estoque > 0).length;

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b}
    .header{background:${cor};padding:0}
    .header-inner{max-width:1200px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;gap:20px}
    .logo{width:64px;height:64px;border-radius:16px;object-fit:cover;background:#fff;border:3px solid rgba(255,255,255,0.3);flex-shrink:0}
    .logo-placeholder{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
    .header h1{color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px}
    .header p{color:rgba(255,255,255,0.8);font-size:14px;margin-top:4px}
    .header-stats{margin-left:auto;text-align:right;flex-shrink:0}
    .header-stats span{display:block;color:rgba(255,255,255,0.9);font-size:13px}
    .header-stats strong{color:#fff;font-size:20px;font-weight:700}
    .main{max-width:1200px;margin:0 auto;padding:32px 20px}
    .cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
    .cat-btn{padding:7px 16px;border-radius:99px;border:1.5px solid ${cor};background:transparent;color:${cor};font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .15s}
    .cat-btn:hover,.cat-btn.active{background:${cor};color:#fff}
    .section-title{font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
    .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:all .2s;display:flex;flex-direction:column}
    .card:hover{box-shadow:0 8px 24px rgba(0,0,0,0.12);transform:translateY(-2px)}
    .card-img{height:180px;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
    .card-img img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
    .card:hover .card-img img{transform:scale(1.05)}
    .card-img-placeholder{font-size:56px;opacity:.3}
    .badge-cat{position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.55);color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.5px;backdrop-filter:blur(4px)}
    .badge-stock-off{position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px}
    .card-body{padding:16px;flex:1;display:flex;flex-direction:column;gap:6px}
    .card-nome{font-size:14px;font-weight:700;color:#1e293b;line-height:1.4}
    .card-cod{font-size:11px;color:#94a3b8;font-family:monospace}
    .card-price{font-size:22px;font-weight:800;color:${cor};margin-top:auto;padding-top:10px}
    .card-price-sub{font-size:11px;color:#94a3b8;font-weight:400}
    .btn-wa{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;background:#22c55e;color:#fff;padding:11px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;transition:background .15s}
    .btn-wa:hover{background:#16a34a}
    .btn-wa svg{flex-shrink:0}
    .empty{text-align:center;padding:80px 20px;color:#94a3b8}
    .empty-icon{font-size:64px;margin-bottom:16px}
    .footer{text-align:center;padding:32px 20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:48px}
    .footer a{color:${cor};text-decoration:none;font-weight:600}
    @media(max-width:640px){
      .header h1{font-size:20px}
      .header-stats{display:none}
      .grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
      .card-img{height:140px}
      .card-body{padding:12px}
      .card-price{font-size:18px}
    }
  `;

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{titulo}</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        {/* Header */}
        <header className="header">
          <div className="header-inner">
            {emp.logo_url
              ? <img src={emp.logo_url} alt={emp.nome} className="logo" />
              : <div className="logo-placeholder">🏪</div>}
            <div>
              <h1>{titulo}</h1>
              {emp.catalogo_descricao && <p>{emp.catalogo_descricao}</p>}
            </div>
            <div className="header-stats">
              <strong>{total}</strong>
              <span>produto{total !== 1 ? 's' : ''}</span>
              <span style={{ marginTop: 4 }}>{emEstoque} disponíveis</span>
            </div>
          </div>
        </header>

        <main className="main">
          {/* Filtro por categoria */}
          {categorias.length > 1 && (
            <div className="cats">
              {categorias.map((c) => (
                <a key={c} href={`#cat-${c}`} className="cat-btn">{c}</a>
              ))}
            </div>
          )}

          {/* Produtos por categoria */}
          {categorias.length > 1 ? categorias.map((cat) => {
            const prods = produtos.filter((p) => p.categoria_nome === cat);
            return (
              <div key={cat} id={`cat-${cat}`} style={{ marginBottom: 48 }}>
                <p className="section-title">{cat} ({prods.length})</p>
                <div className="grid">
                  {prods.map((p) => <Card key={p.id} p={p} cor={cor} whatsapp={emp.catalogo_whatsapp} />)}
                </div>
              </div>
            );
          }) : (
            <div className="grid">
              {produtos.map((p) => <Card key={p.id} p={p} cor={cor} whatsapp={emp.catalogo_whatsapp} />)}
            </div>
          )}

          {total === 0 && (
            <div className="empty">
              <div className="empty-icon">🏪</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#64748b' }}>Nenhum produto disponível</p>
              <p style={{ marginTop: 8, fontSize: 14 }}>Volte em breve!</p>
            </div>
          )}
        </main>

        <footer className="footer">
          Vitrine criada com <a href="https://bluesyserp.com.br" target="_blank" rel="noopener">BluesysERP</a> · by ZeroTr3z
        </footer>
      </body>
    </html>
  );
}

function Card({ p, cor, whatsapp }: { p: ProdutoPublico; cor: string; whatsapp: string | null }) {
  const semEstoque = p.estoque <= 0;
  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse: ${p.nome} — ${brl(p.preco)}`)}`
    : null;

  return (
    <div className="card">
      <div className="card-img">
        {p.imagem_url
          ? <img src={p.imagem_url} alt={p.nome} />
          : <span className="card-img-placeholder">📦</span>}
        {p.categoria_nome && <span className="badge-cat">{p.categoria_nome}</span>}
        {semEstoque && <span className="badge-stock-off">Esgotado</span>}
      </div>
      <div className="card-body">
        <p className="card-nome">{p.nome}</p>
        {p.codigo && <p className="card-cod">Cód: {p.codigo}</p>}
        <div className="card-price">
          {brl(p.preco)}
          {!semEstoque && <span className="card-price-sub"> · em estoque</span>}
        </div>
        {waLink && !semEstoque && (
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-wa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Pedir via WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
