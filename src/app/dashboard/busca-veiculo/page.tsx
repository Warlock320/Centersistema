'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Car, Search, Package, ChevronRight, RotateCcw, ImageOff, ExternalLink } from 'lucide-react';
import type { Produto } from '@/types/database.types';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface FipeMarca { codigo: string; nome: string }
interface FipeModelo { codigo: number; nome: string }
interface FipeAno { codigo: string; nome: string }

const FIPE_BASE = 'https://parallelum.com.br/fipe/api/v1';

const ABREVIACOES: Record<string, string[]> = {
  volkswagen: ['vw', 'volks'],
  chevrolet: ['gm', 'chevy'],
  mercedes: ['mb'],
  mitsubishi: ['mmc'],
  hyundai: ['hb'],
};

function expandirTermos(termos: string[]): string[] {
  const expandidos: string[] = [...termos];
  for (const t of termos) {
    for (const [full, abrevs] of Object.entries(ABREVIACOES)) {
      if (t === full) expandidos.push(...abrevs);
      if (abrevs.includes(t)) expandidos.push(full);
    }
  }
  return [...new Set(expandidos)];
}

function matchProduto(p: { nome: string; codigo: string | null; ref: string | null; aplicacoes: string[]; codigos_auxiliares: string[] }, termos: string[]): boolean {
  const expandidos = expandirTermos(termos);
  const textoCompleto = [
    p.nome,
    p.codigo || '',
    p.ref || '',
    ...(p.aplicacoes || []),
    ...(p.codigos_auxiliares || []),
  ].join(' ').toLowerCase();

  return expandidos.some((termo) => textoCompleto.includes(termo));
}

export default function BuscaVeiculoPage() {
  const supabase = createClient();

  const [tipoVeiculo, setTipoVeiculo] = useState<'carros' | 'motos' | 'caminhoes'>('carros');
  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [marcaSel, setMarcaSel] = useState('');
  const [modeloSel, setModeloSel] = useState('');
  const [anoSel, setAnoSel] = useState('');
  const [marcaNome, setMarcaNome] = useState('');
  const [modeloNome, setModeloNome] = useState('');
  const [anoNome, setAnoNome] = useState('');
  const [loadingFipe, setLoadingFipe] = useState(false);
  const [queryTexto, setQueryTexto] = useState('');
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setLoadingFipe(true);
    fetch(`${FIPE_BASE}/${tipoVeiculo}/marcas`)
      .then((r) => r.json()).then((d) => setMarcas(d || []))
      .catch(() => setMarcas([]))
      .finally(() => setLoadingFipe(false));
    setMarcaSel(''); setModeloSel(''); setAnoSel('');
    setModelos([]); setAnos([]);
    setMarcaNome(''); setModeloNome(''); setAnoNome('');
  }, [tipoVeiculo]);

  useEffect(() => {
    if (!marcaSel) { setModelos([]); return; }
    setLoadingFipe(true);
    fetch(`${FIPE_BASE}/${tipoVeiculo}/marcas/${marcaSel}/modelos`)
      .then((r) => r.json()).then((d) => setModelos(d?.modelos || []))
      .catch(() => setModelos([]))
      .finally(() => setLoadingFipe(false));
    setModeloSel(''); setAnoSel(''); setAnos([]);
    setModeloNome(''); setAnoNome('');
  }, [marcaSel, tipoVeiculo]);

  useEffect(() => {
    if (!marcaSel || !modeloSel) { setAnos([]); return; }
    setLoadingFipe(true);
    fetch(`${FIPE_BASE}/${tipoVeiculo}/marcas/${marcaSel}/modelos/${modeloSel}/anos`)
      .then((r) => r.json()).then((d) => setAnos(d || []))
      .catch(() => setAnos([]))
      .finally(() => setLoadingFipe(false));
    setAnoSel(''); setAnoNome('');
  }, [modeloSel, marcaSel, tipoVeiculo]);

  async function buscarPecas(texto: string) {
    setLoading(true);
    setSearched(true);
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, ref, nome, aplicacoes, codigos_auxiliares, preco, estoque, estoque_minimo, imagem_url, ativo')
      .eq('ativo', true).order('nome');

    const termos = texto.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = (data || []).filter((p) => matchProduto(p as Produto, termos));
    setResults(filtered as Produto[]);
    setLoading(false);
  }

  function buscarPorFipe() {
    const termos = [marcaNome, modeloNome, anoNome].filter(Boolean).join(' ');
    if (termos.trim()) { setQueryTexto(termos); buscarPecas(termos); }
  }

  function buscarPorTexto() {
    if (queryTexto.trim()) buscarPecas(queryTexto.trim());
  }

  function resetar() {
    setMarcaSel(''); setModeloSel(''); setAnoSel('');
    setMarcaNome(''); setModeloNome(''); setAnoNome('');
    setQueryTexto(''); setResults([]); setSearched(false);
  }

  useEffect(() => {
    if (marcaNome && modeloNome && anoNome) buscarPorFipe();
  }, [anoNome]);

  const selecoesTexto = [marcaNome, modeloNome, anoNome].filter(Boolean);
  const veiculoTexto = selecoesTexto.join(' ');

  const catalogos = [
    {
      nome: 'Auto Experts',
      cor: 'bg-orange-500',
      url: veiculoTexto
        ? `https://www.google.com/search?q=${encodeURIComponent(`site:autoexperts.com.br ${veiculoTexto}`)}`
        : 'https://www.autoexperts.com.br',
    },
    {
      nome: 'Nakata',
      cor: 'bg-red-600',
      url: veiculoTexto
        ? `https://www.google.com/search?q=${encodeURIComponent(`site:catalogo.nakata.com.br ${veiculoTexto}`)}`
        : 'https://catalogo.nakata.com.br',
    },
    {
      nome: 'Fras-le',
      cor: 'bg-blue-700',
      url: veiculoTexto
        ? `https://www.google.com/search?q=${encodeURIComponent(`site:frasle.com ${veiculoTexto} catalogo`)}`
        : 'https://www.frasle.com/catalogo',
    },
    {
      nome: 'Cofap',
      cor: 'bg-green-700',
      url: veiculoTexto
        ? `https://www.google.com/search?q=${encodeURIComponent(`site:cofap.com.br ${veiculoTexto} catalogo`)}`
        : 'https://www.cofap.com.br',
    },
    {
      nome: 'Monroe',
      cor: 'bg-yellow-600',
      url: veiculoTexto
        ? `https://www.google.com/search?q=${encodeURIComponent(`site:monroe.com.br ${veiculoTexto} catalogo`)}`
        : 'https://www.monroe.com.br',
    },
    {
      nome: 'Google Peças',
      cor: 'bg-slate-700',
      url: `https://www.google.com/search?q=${encodeURIComponent(`${veiculoTexto || 'autopeças'} peças código original`)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Car size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Busca por Veículo</h1>
            <p className="text-sm text-slate-500">Encontre peças compatíveis — dados da tabela FIPE + estoque</p>
          </div>
        </div>
        {searched && (
          <Button variant="ghost" size="sm" onClick={resetar}>
            <RotateCcw size={14} /> Nova busca
          </Button>
        )}
      </div>

      {/* FIPE guiada */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Busca guiada (FIPE)</h2>
        <div className="flex gap-2">
          {([['carros', 'Carros'], ['motos', 'Motos'], ['caminhoes', 'Caminhões']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setTipoVeiculo(val)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                tipoVeiculo === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-300'
              }`}>{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Marca</label>
            <select value={marcaSel} onChange={(e) => { setMarcaSel(e.target.value); setMarcaNome(e.target.options[e.target.selectedIndex]?.text || ''); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Selecione a marca...</option>
              {marcas.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Modelo</label>
            <select value={modeloSel} disabled={!marcaSel} onChange={(e) => { setModeloSel(e.target.value); setModeloNome(e.target.options[e.target.selectedIndex]?.text || ''); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50">
              <option value="">Selecione o modelo...</option>
              {modelos.map((m) => <option key={m.codigo} value={String(m.codigo)}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Ano</label>
            <select value={anoSel} disabled={!modeloSel} onChange={(e) => { setAnoSel(e.target.value); setAnoNome(e.target.options[e.target.selectedIndex]?.text || ''); }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50">
              <option value="">Selecione o ano...</option>
              {anos.map((a) => <option key={a.codigo} value={a.codigo}>{a.nome}</option>)}
            </select>
          </div>
        </div>
        {selecoesTexto.length > 0 && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-slate-500">Selecionado:</span>
            {selecoesTexto.map((s, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{s}</span>
                {i < selecoesTexto.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
              </span>
            ))}
            {modeloSel && !anoSel && (
              <Button variant="secondary" size="sm" onClick={buscarPorFipe} className="ml-2"><Search size={12} /> Buscar</Button>
            )}
          </div>
        )}
        {loadingFipe && <p className="text-xs text-slate-400">Carregando dados FIPE...</p>}
      </div>

      {/* Catálogos Externos */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Catálogos de Peças (externos)</h2>
        <p className="text-xs text-slate-400 mb-3">
          {veiculoTexto
            ? `Consultar peças para "${veiculoTexto}" com códigos originais, imagens e referências`
            : 'Selecione um veículo acima para buscar nos catálogos com o modelo preenchido'}
        </p>
        <div className="flex flex-wrap gap-2">
          {catalogos.map((cat) => (
            <a key={cat.nome} href={cat.url} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity ${cat.cor}`}>
              <ExternalLink size={14} /> {cat.nome}
            </a>
          ))}
        </div>
      </div>

      {/* Texto livre */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Busca por texto livre</h2>
        <div className="flex gap-3">
          <input value={queryTexto} onChange={(e) => setQueryTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscarPorTexto()}
            placeholder='Ex: "Gol", "Civic", "Palio", "VW", "pastilha freio"...'
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <Button onClick={buscarPorTexto} loading={loading} disabled={!queryTexto.trim()}>
            <Search size={16} /> Buscar
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Busca no nome, código, referência e aplicações do produto. Aceita abreviações (VW = Volkswagen, GM = Chevrolet).
        </p>
      </div>

      {/* Resultados */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Buscando peças...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma peça encontrada</p>
          <p className="text-sm text-slate-400 mt-1">
            Tente termos mais genéricos (ex: só a marca ou só o tipo de peça).
            <br />A busca procura no nome, código e aplicações dos produtos.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {results.length} peça{results.length !== 1 ? 's' : ''} encontrada{results.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-400">{selecoesTexto.join(' ') || queryTexto}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {results.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                {/* Foto */}
                <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
                  {p.imagem_url ? (
                    <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff size={20} className="text-slate-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.nome}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {p.codigo && <span className="font-mono">Cód: {p.codigo}</span>}
                    {p.ref && <span className="ml-2 font-mono">Ref: {p.ref}</span>}
                  </p>
                  {p.aplicacoes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.aplicacoes.slice(0, 5).map((ap, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full">{ap}</span>
                      ))}
                      {p.aplicacoes.length > 5 && (
                        <span className="text-[10px] text-slate-400">+{p.aplicacoes.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Preço e estoque */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900">{brl(p.preco)}</p>
                  <p className={`text-xs font-medium ${
                    Number(p.estoque) <= 0 ? 'text-red-500' :
                    Number(p.estoque) <= Number(p.estoque_minimo || 0) ? 'text-amber-500' : 'text-green-600'
                  }`}>
                    {Number(p.estoque) <= 0 ? 'Esgotado' : `${Number(p.estoque).toFixed(0)} em estoque`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
