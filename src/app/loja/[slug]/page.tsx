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
  const precos = produtos.map((p) => p.preco).filter((v) => v > 0);
  const precoMin = precos.length ? Math.floor(Math.min(...precos)) : 0;
  const precoMax = precos.length ? Math.ceil(Math.max(...precos)) : 9999;

  const css = `
    body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9}*{box-sizing:border-box}
    .lh{background:${cor}}.lhi{max-width:1200px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;gap:20px}
    .ll{width:64px;height:64px;border-radius:16px;object-fit:cover;border:3px solid rgba(255,255,255,.3);flex-shrink:0}
    .llph{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0}
    .lh h1{color:#fff;font-size:24px;font-weight:800;margin:0}.lh p{color:rgba(255,255,255,.8);font-size:13px;margin:3px 0 0}
    .lst{margin-left:auto;text-align:right;flex-shrink:0}.lst b{display:block;color:#fff;font-size:20px;font-weight:800}.lst span{color:rgba(255,255,255,.8);font-size:12px}
    .lm{max-width:1200px;margin:0 auto;padding:28px 20px}
    .lsb{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
    .lsb input[type=text]{flex:1;min-width:200px;padding:11px 18px;border-radius:99px;border:1.5px solid #e2e8f0;font-size:14px;outline:none;transition:border .15s;background:#fff}
    .lsb input[type=text]:focus{border-color:${cor};box-shadow:0 0 0 3px ${cor}22}
    .lfiltros{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;align-items:center}
    .lfsel{padding:8px 14px;border-radius:99px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:600;outline:none;cursor:pointer;background:#fff;color:#475569;transition:border .15s;-webkit-appearance:none;appearance:none;padding-right:28px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
    .lfsel:focus{border-color:${cor}}
    .lprange{display:flex;align-items:center;gap:6px;background:#fff;border:1.5px solid #e2e8f0;border-radius:99px;padding:6px 14px;transition:border .15s}
    .lprange:focus-within{border-color:${cor}}
    .lprange label{font-size:12px;color:#94a3b8;font-weight:600;white-space:nowrap}
    .lprange input{width:76px;border:none;outline:none;font-size:13px;font-weight:600;color:#1e293b;background:transparent;-moz-appearance:textfield}
    .lprange input::-webkit-outer-spin-button,.lprange input::-webkit-inner-spin-button{-webkit-appearance:none}
    .lprange span{color:#cbd5e1;font-size:12px}
    .ltoggle{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600;color:#475569;user-select:none;padding:8px 16px;border-radius:99px;border:1.5px solid #e2e8f0;background:#fff;transition:all .15s;white-space:nowrap}
    .ltoggle.on{background:${cor};color:#fff;border-color:${cor}}
    .ltoggle .ldot{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .ltoggle.on .ldot::after{content:'';width:6px;height:6px;background:#fff;border-radius:50%;display:block}
    .lcats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
    .lcat{padding:7px 18px;border-radius:99px;border:1.5px solid ${cor};color:${cor};font-size:13px;font-weight:600;cursor:pointer;background:transparent;transition:all .15s}
    .lcat:hover,.lcat.active{background:${cor};color:#fff}
    .lcat-all{background:${cor};color:#fff}
    .lcount{font-size:12px;color:#94a3b8;font-weight:500;margin-bottom:16px;padding:0 2px}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}
    .lcard{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:all .2s;display:flex;flex-direction:column}
    .lcard:hover{box-shadow:0 8px 28px rgba(0,0,0,.12);transform:translateY(-3px)}
    .lcimg{height:175px;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
    .lcimg img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.lcard:hover .lcimg img{transform:scale(1.06)}
    .lcph{font-size:52px;opacity:.2}
    .lbcat{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.5px}
    .lboff{position:absolute;top:10px;right:10px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px}
    .lcbody{padding:14px;flex:1;display:flex;flex-direction:column;gap:4px}
    .lcnome{font-size:14px;font-weight:700;color:#1e293b;line-height:1.4;margin:0}
    .lccod{font-size:11px;color:#94a3b8;font-family:monospace;margin:0}
    .lcaplic{font-size:11px;color:#64748b;margin:4px 0 0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .lcprice{font-size:21px;font-weight:800;color:${cor};margin-top:auto;padding-top:10px}
    .lcprice span{font-size:11px;color:#94a3b8;font-weight:400;display:block;margin-top:1px}
    .lbwa{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:10px;background:#22c55e;color:#fff;padding:10px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;transition:background .15s}
    .lbwa:hover{background:#16a34a}
    .lempty{text-align:center;padding:60px 20px;color:#94a3b8}
    .lfooter{text-align:center;padding:28px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:40px}
    .lfooter a{color:${cor};text-decoration:none;font-weight:600}
    @media(max-width:700px){.lh h1{font-size:18px}.lst{display:none}.lgrid{grid-template-columns:repeat(2,1fr);gap:10px}.lcimg{height:135px}.lcbody{padding:10px}.lcprice{font-size:17px}.lprange{display:none}}
  `;

  const js = `
(function(){
  var _cat='', _soEst=false;
  function val(id){return(document.getElementById(id)||{}).value||'';}
  function filtrar(){
    var q=val('loja-busca').toLowerCase().trim();
    var pmin=parseFloat(val('loja-pmin'))||0;
    var pmaxRaw=val('loja-pmax');
    var pmax=pmaxRaw?parseFloat(pmaxRaw):Infinity;
    var ordem=val('loja-ordem')||'az';
    var grid=document.getElementById('loja-grid');
    var cards=Array.from(grid.querySelectorAll('.lcard'));
    // sort
    cards.sort(function(a,b){
      if(ordem==='az') return (a.dataset.nome||'').localeCompare(b.dataset.nome||'','pt-BR',{sensitivity:'base'});
      if(ordem==='za') return (b.dataset.nome||'').localeCompare(a.dataset.nome||'','pt-BR',{sensitivity:'base'});
      if(ordem==='menor') return (parseFloat(a.dataset.preco)||0)-(parseFloat(b.dataset.preco)||0);
      if(ordem==='maior') return (parseFloat(b.dataset.preco)||0)-(parseFloat(a.dataset.preco)||0);
      return 0;
    });
    cards.forEach(function(c){grid.appendChild(c);});
    // filter
    var visible=0;
    cards.forEach(function(c){
      var nome=c.dataset.nome||'';
      var aplic=c.dataset.aplic||'';
      var cat=c.dataset.cat||'';
      var preco=parseFloat(c.dataset.preco)||0;
      var est=parseInt(c.dataset.estoque)||0;
      var matchQ=!q||nome.includes(q)||aplic.includes(q);
      var matchCat=!_cat||cat===_cat;
      var matchP=preco>=pmin&&preco<=pmax;
      var matchE=!_soEst||est>0;
      var show=matchQ&&matchCat&&matchP&&matchE;
      c.style.display=show?'':'none';
      if(show)visible++;
    });
    var total=${total};
    var cnt=document.getElementById('loja-count');
    if(cnt){
      cnt.textContent=visible===total
        ?total+' produto'+(total===1?'':'s')
        :visible+' de '+total+' produto'+(total===1?'':'s');
    }
    var em=document.getElementById('loja-empty');
    if(em)em.style.display=visible===0?'block':'none';
  }
  function init(){
    ['loja-busca','loja-pmin','loja-pmax'].forEach(function(id){
      var el=document.getElementById(id);
      if(el)el.addEventListener('input',filtrar);
    });
    var sel=document.getElementById('loja-ordem');
    if(sel)sel.addEventListener('change',filtrar);
    var estBtn=document.getElementById('loja-estoque');
    if(estBtn)estBtn.addEventListener('click',function(){
      _soEst=!_soEst;
      estBtn.classList.toggle('on',_soEst);
      filtrar();
    });
    document.querySelectorAll('.lcat').forEach(function(b){
      b.addEventListener('click',function(){
        _cat=b.dataset.cat||'';
        document.querySelectorAll('.lcat').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');
        filtrar();
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <header className="lh">
        <div className="lhi">
          {emp.logo_url
            ? <img src={emp.logo_url} alt={emp.nome} className="ll" />
            : <div className="llph">🏪</div>}
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

        {/* Busca principal */}
        <div className="lsb">
          <input
            type="text"
            id="loja-busca"
            placeholder="🔍  Buscar por nome, código ou aplicação (ex: VW Gol 2015)..."
            suppressHydrationWarning
          />
        </div>

        {/* Linha de filtros */}
        <div className="lfiltros">
          <select id="loja-ordem" className="lfsel" suppressHydrationWarning>
            <option value="az">Nome A → Z</option>
            <option value="za">Nome Z → A</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
          </select>

          {precos.length > 0 && (
            <div className="lprange">
              <label>R$</label>
              <input
                type="number"
                id="loja-pmin"
                placeholder={String(precoMin)}
                min={0}
                suppressHydrationWarning
              />
              <span>–</span>
              <input
                type="number"
                id="loja-pmax"
                placeholder={String(precoMax)}
                min={0}
                suppressHydrationWarning
              />
            </div>
          )}

          <button id="loja-estoque" className="ltoggle" suppressHydrationWarning>
            <span className="ldot" />
            Apenas disponíveis
          </button>
        </div>

        {/* Categorias */}
        {categorias.length > 0 && (
          <div className="lcats" id="loja-cats">
            <button className="lcat lcat-all" data-cat="">Todos</button>
            {categorias.map((c) => (
              <button key={c} className="lcat" data-cat={c}>{c}</button>
            ))}
          </div>
        )}

        {/* Contador de resultados */}
        <p className="lcount" id="loja-count">
          {total} produto{total !== 1 ? 's' : ''}
        </p>

        {/* Grid */}
        <div className="lgrid" id="loja-grid">
          {produtos.map((p) => {
            const semEstoque = p.estoque <= 0;
            const aplicStr = (p.aplicacoes || []).join(' | ');
            const aplicSearch = (p.aplicacoes || []).join(' ').toLowerCase();
            const waLink = emp.catalogo_whatsapp
              ? `https://wa.me/${emp.catalogo_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Tenho interesse: ${p.nome} — ${brl(p.preco)}`)}`
              : null;
            return (
              <div
                key={p.id}
                className="lcard"
                data-nome={(p.nome + ' ' + (p.codigo || '')).toLowerCase()}
                data-cat={p.categoria_nome || ''}
                data-preco={p.preco}
                data-estoque={p.estoque}
                data-aplic={aplicSearch}
              >
                <div className="lcimg">
                  {p.imagem_url
                    ? <img src={p.imagem_url} alt={p.nome} loading="lazy" />
                    : <span className="lcph">📦</span>}
                  {p.categoria_nome && <span className="lbcat">{p.categoria_nome}</span>}
                  {semEstoque && <span className="lboff">Esgotado</span>}
                </div>
                <div className="lcbody">
                  <p className="lcnome">{p.nome}</p>
                  {p.codigo && <p className="lccod">Cód: {p.codigo}</p>}
                  {aplicStr && (
                    <p className="lcaplic" title={aplicStr}>
                      🚗 {aplicStr}
                    </p>
                  )}
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
          <p style={{ marginTop: 6, fontSize: 14, color: '#94a3b8' }}>Tente outro termo ou ajuste os filtros</p>
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

      <script dangerouslySetInnerHTML={{ __html: js }} />
    </>
  );
}
