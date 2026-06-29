import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface PecaCatalogo {
  codigo: string;
  descricao: string;
  marca: string;
  imagem: string | null;
  sistema: string | null;
}

async function buscarAutoExperts(marca: string, modelo: string, ano: string): Promise<PecaCatalogo[]> {
  const query = `${marca} ${modelo} ${ano}`.trim();
  try {
    const res = await fetch(
      `https://www.autoexperts.com.br/api/search?q=${encodeURIComponent(query)}&type=vehicle`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.products)) {
      return data.products.map((p: Record<string, unknown>) => ({
        codigo: String(p.code || p.sku || ''),
        descricao: String(p.name || p.description || ''),
        marca: String(p.brand || ''),
        imagem: p.image ? String(p.image) : null,
        sistema: p.category ? String(p.category) : null,
      }));
    }
  } catch { /* API não acessível ou formato diferente */ }

  // Fallback: tenta buscar via HTML scraping da página de resultados
  try {
    const url = `https://www.autoexperts.com.br/busca?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return parseHtmlProducts(html);
  } catch { /* site inacessível */ }

  return [];
}

function sanitizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch { /* URL inválida */ }
  return null;
}

function parseHtmlProducts(html: string): PecaCatalogo[] {
  const pecas: PecaCatalogo[] = [];
  // Tenta extrair dados de produtos de HTML genérico de catálogos
  // Padrão: cards com imagem, código, descrição, marca
  const productRegex = /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/i;
  const titleRegex = /<(?:h[2-4]|span|p|a)[^>]*class="[^"]*(?:title|name|desc)[^"]*"[^>]*>([^<]+)/i;
  const codeRegex = /(?:cod|código|ref|sku)[.:]\s*([A-Z0-9\-/]+)/i;

  let match;
  while ((match = productRegex.exec(html)) !== null) {
    const block = match[1];
    const img = imgRegex.exec(block);
    const title = titleRegex.exec(block);
    const code = codeRegex.exec(block);

    if (title || code) {
      pecas.push({
        codigo: (code?.[1] || '').replace(/[<>"'&]/g, ''),
        descricao: (title?.[1] || '').trim().replace(/[<>"'&]/g, ''),
        marca: '',
        imagem: sanitizeUrl(img?.[1] || null),
        sistema: null,
      });
    }
  }
  return pecas;
}

// Busca em múltiplas fontes em paralelo
async function buscarCatalogos(marca: string, modelo: string, ano: string): Promise<PecaCatalogo[]> {
  const resultados = await Promise.allSettled([
    buscarAutoExperts(marca, modelo, ano),
  ]);

  const pecas: PecaCatalogo[] = [];
  for (const r of resultados) {
    if (r.status === 'fulfilled') pecas.push(...r.value);
  }
  return pecas;
}

export async function GET(request: Request) {
  // Auth check
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const marca = searchParams.get('marca') || '';
  const modelo = searchParams.get('modelo') || '';
  const ano = searchParams.get('ano') || '';

  if (!marca && !modelo) {
    return NextResponse.json({ error: 'Informe ao menos marca ou modelo.' }, { status: 400 });
  }

  const pecas = await buscarCatalogos(marca, modelo, ano);

  return NextResponse.json({
    query: `${marca} ${modelo} ${ano}`.trim(),
    total: pecas.length,
    pecas,
    fonte: pecas.length > 0 ? 'catalogo_externo' : null,
    aviso: pecas.length === 0
      ? 'Nenhuma peça encontrada via catálogos online. Os catálogos externos podem estar indisponíveis ou o veículo não foi encontrado.'
      : null,
  });
}
