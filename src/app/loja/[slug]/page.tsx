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

  // Busca direta por empresa_id para garantir todos os produtos
  const { data: produtos } = await admin.from('produtos')
    .select('id, codigo, nome, preco, estoque, imagem_url, aplicacoes, categoria:categorias(nome)')
    .eq('empresa_id', emp.id)
    .eq('ativo', true)
    .eq('visivel_catalogo', true)
    .order('nome');

  const prods = (produtos || []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    codigo: p.codigo as string | null,
    nome: p.nome as string,
    preco: Number(p.preco),
    estoque: Number(p.estoque),
    imagem_url: p.imagem_url as string | null,
    tags: null,
    aplicacoes: p.aplicacoes as string[] | null,
    categoria_nome: p.categoria ? (p.categoria as Record<string, unknown>).nome as string : null,
  })) as ProdutoPublico[];

  return { empresa: emp, produtos: prods };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getData(slug);
  if (!d) return { title: 'Catálogo' };
  const titulo = d.empresa.catalogo_titulo || d.empresa.nome;
  return { title: titulo, description: d.empresa.catalogo_descricao || '' };
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

  // CSS isolado com prefixo loja- para não conflitar
  const css = `
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9}*{box-sizing:border-box}
    .lh{background:${cor}}.lhi{max-width:1200px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;gap:20px}
    .ll{width:64px;height:64px;border-radius:16px;object-fit:cover;border:3px solid rgba(255,255,255,.3);flex-shrink:0}
    .llph{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
    .lh h1{color:#fff;font-size:24px;font-weight:800;margin:0}.lh p{color:rgba(255,255,255,.8);font-size:13px;margin:3px 0 0}
    .lst{margin-left:auto;text-align:right;flex-shrink:0}.lst b{display:block;color:#fff;font-size:20px;font-weight:800}.lst span{color:rgba(255,255,255,.8);font-size:12px}
    .lm{max-width:1200px;margin:0 auto;padding:28px 20px}
    .lsb{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
    .lsb input{flex:1;min-width:180px;padding:10px 16px;border-radius:99px;border:1.5px solid #e2e8f0;font-size:14px;outline:none;transition:border .15s}
    .lsb input:focus{border-color:${cor}}
    .lcats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
    .lcat{padding:6px 16px;border-radius:99px;border:1.5px solid ${cor};color:${cor};font-size:13px;font-weight:600;cursor:pointer;background:transparent;transition:all .15s}
    .lcat:hover,.lcat.active{background:${cor};color:#fff}
    .lcat-all{background:${cor};color:#fff}
    .lsect{margin-bottom:40px}.lsect-title{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #e2e8f0}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
    .lcard{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:all .2s;display:flex;flex-direction:column}
    .lcard:hover{box-shadow:0 8px 28px rgba(0,0,0,.12);transform:translateY(-3px)}
    .lcard[data-hidden]{display:none}
    .lcimg{height:175px;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
    .lcimg img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.lcard:hover .lcimg img{transform:scale(1.06)}
    .lcph{font-size:52px;opacity:.2}
    .lbcat{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.5px}
    .lboff{position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px}
    .lcbody{padding:14px;flex:1;display:flex;flex-direction:column;gap:4px}
    .lcnome{font-size:14px;font-weight:700;color:#1e293b;line-height:1.4}
    .lccod{font-size:11px;color:#94a3b8;font-family:monospace}
    .lcprice{font-size:21px;font-weight:800;color:${cor};margin-top:auto;padding-top:10px}
    .lcprice span{font-size:11px;color:#94a3b8;font-weight:400;display:block;margin-top:1px}
    .lbwa{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:10px;background:#22c55e;color:#fff;padding:10px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;transition:background .15s}
    .lbwa:hover{background:#16a34a}
    .lempty{text-align:center;padding:60px 20px;color:#94a3b8}
    .lfooter{text-align:center;padding:28px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:40px}
    .lfooter a{color:${cor};text-decoration:none;font-weight:600}
    @media(max-width:600px){.lh h1{font-size:18px}.lst{display:none}.lgrid{grid-template-columns:repeat(2,1fr);gap:10px}.lcimg{height:135px}.lcbody{padding:10px}.lcprice{font-size:17px}}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <header className="lh">
        <div className="lhi">
          {emp.logo_url ? <img src={emp.logo_url} alt={emp.nome} className="ll" /> : <div className="llph">🏪</div>}
          <div>
            <h1>{titulo}</h1>
            {emp.catalogo_descricao && <p>{emp.catalogo_descricao}</p>}
          </div>
          <div className="lst">
            <b>{total}</b>
            <span>produtos · {emEstoque} disponíveis</span>
          </div>
        </div>
      </header>

      <main className="lm">
        {/* Busca + filtros — JavaScript inline */}
        <div className="lsb">
          <input type="text" id="loja-busca" placeholder="🔍  Buscar produto por nome ou código..." suppressHydrationWarning />
        </div>

        {categorias.length > 0 && (
          <div className="lcats" id="loja-cats">
            <button className="lcat lcat-all" data-cat="">Todos</button>
            {categorias.map((c) => (
              <button key={c} className="lcat" data-cat={c}>{c}</button>
            ))}
          </div>
        )}

        {/* Produtos (todos renderizados, filtro por JS) */}
        <div className="lgrid" id="loja-grid">
          {produtos.map((p) => {
            const semEstoque = p.estoque <= 0;
            const waLink = emp.catalogo_whatsapp
              ? `https://wa.me/${emp.catalogo_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse: ${p.nome} — ${brl(p.preco)}`)}`
              : null;
            return (
              <div key={p.id} className="lcard"
                data-nome={(p.nome + ' ' + (p.codigo || '')).toLowerCase()}
                data-cat={p.categoria_nome || ''}>
                <div className="lcimg">
                  {p.imagem_url ? <img src={p.imagem_url} alt={p.nome} /> : <span className="lcph">📦</span>}
                  {p.categoria_nome && <span className="lbcat">{p.categoria_nome}</span>}
                  {semEstoque && <span className="lboff">Esgotado</span>}
                </div>
                <div className="lcbody">
                  <p className="lcnome">{p.nome}</p>
                  {p.codigo && <p className="lccod">Cód: {p.codigo}</p>}
                  <div className="lcprice">
                    {brl(p.preco)}
                    {!semEstoque && <span>em estoque</span>}
                  </div>
                  {waLink && !semEstoque && (
                    <a href={waLink} target="_blank" rel="noopener noreferrer" className="lbwa">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Pedir via WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lempty" id="loja-empty" style={{ display: 'none' }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>😕</p>
          <p style={{ fontSize: 17, fontWeight: 600, color: '#64748b' }}>Nenhum produto encontrado</p>
          <p style={{ marginTop: 6, fontSize: 14, color: '#94a3b8' }}>Tente outro termo ou categoria</p>
        </div>

        {total === 0 && (
          <div className="lempty">
            <p style={{ fontSize: 48, marginBottom: 12 }}>🏪</p>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#64748b' }}>Nenhum produto disponível</p>
          </div>
        )}
      </main>

      <footer className="lfooter">
        Vitrine criada com <a href="#" rel="noopener">BluesysERP</a> · by ZeroTr3z
      </footer>

      {/* JS de filtro inline — funciona sem React no client */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          var _cat = '';
          function filtrar() {
            var q = ((document.getElementById('loja-busca')||{}).value||'').toLowerCase().trim();
            var cards = document.querySelectorAll('.lcard');
            var visible = 0;
            cards.forEach(function(c) {
              var show = (!q || (c.dataset.nome||'').includes(q)) && (!_cat || c.dataset.cat === _cat);
              c.style.display = show ? '' : 'none';
              if (show) visible++;
            });
            var em = document.getElementById('loja-empty');
            if (em) em.style.display = visible === 0 ? 'block' : 'none';
          }
          function init() {
            var busca = document.getElementById('loja-busca');
            if (busca) busca.addEventListener('input', filtrar);
            document.querySelectorAll('.lcat').forEach(function(b) {
              b.addEventListener('click', function() {
                _cat = b.dataset.cat || '';
                document.querySelectorAll('.lcat').forEach(function(x) { x.classList.remove('active'); });
                b.classList.add('active');
                filtrar();
              });
            });
          }
          if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
          else init();
        })();
      `}} />
    </>
  );
}
