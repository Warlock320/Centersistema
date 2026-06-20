'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Car, Search, Package, ChevronRight, RotateCcw } from 'lucide-react';
import type { Produto } from '@/types/database.types';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface FipeMarca { codigo: string; nome: string }
interface FipeModelo { codigo: number; nome: string }
interface FipeAno { codigo: string; nome: string }

const FIPE_BASE = 'https://parallelum.com.br/fipe/api/v1';

export default function BuscaVeiculoPage() {
  const supabase = createClient();

  // FIPE
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

  // Busca texto livre
  const [queryTexto, setQueryTexto] = useState('');

  // Resultados
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Carregar marcas da FIPE
  useEffect(() => {
    setLoadingFipe(true);
    fetch(`${FIPE_BASE}/${tipoVeiculo}/marcas`)
      .then((r) => r.json())
      .then((d) => setMarcas(d || []))
      .catch(() => setMarcas([]))
      .finally(() => setLoadingFipe(false));
    setMarcaSel(''); setModeloSel(''); setAnoSel('');
    setModelos([]); setAnos([]);
    setMarcaNome(''); setModeloNome(''); setAnoNome('');
  }, [tipoVeiculo]);

  // Carregar modelos ao selecionar marca
  useEffect(() => {
    if (!marcaSel) { setModelos([]); return; }
    setLoadingFipe(true);
    fetch(`${FIPE_BASE}/${tipoVeiculo}/marcas/${marcaSel}/modelos`)
      .then((r) => r.json())
      .then((d) => setModelos(d?.modelos || []))
      .catch(() => setModelos([]))
      .finally(() => setLoadingFipe(false));
    setModeloSel(''); setAnoSel('');
    setAnos([]);
    setModeloNome(''); setAnoNome('');
  }, [marcaSel, tipoVeiculo]);

  // Carregar anos ao selecionar modelo
  useEffect(() => {
    if (!marcaSel || !modeloSel) { setAnos([]); return; }
    setLoadingFipe(true);
    fetch(`${FIPE_BASE}/${tipoVeiculo}/marcas/${marcaSel}/modelos/${modeloSel}/anos`)
      .then((r) => r.json())
      .then((d) => setAnos(d || []))
      .catch(() => setAnos([]))
      .finally(() => setLoadingFipe(false));
    setAnoSel('');
    setAnoNome('');
  }, [modeloSel, marcaSel, tipoVeiculo]);

  // Buscar peças no estoque
  async function buscarPecas(termos: string) {
    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, ref, nome, aplicacoes, codigos_auxiliares, preco, estoque, estoque_minimo, ativo')
      .eq('ativo', true)
      .order('nome');

    const palavras = termos.toLowerCase().split(/\s+/).filter(Boolean);

    const filtered = (data || []).filter((p) => {
      if (!p.aplicacoes || p.aplicacoes.length === 0) return false;
      return palavras.every((termo) =>
        p.aplicacoes.some((ap: string) => ap.toLowerCase().includes(termo))
      );
    });

    setResults(filtered as Produto[]);
    setLoading(false);
  }

  function buscarPorFipe() {
    const termos = [marcaNome, modeloNome, anoNome].filter(Boolean).join(' ');
    if (termos.trim()) {
      setQueryTexto(termos);
      buscarPecas(termos);
    }
  }

  function buscarPorTexto() {
    if (queryTexto.trim()) buscarPecas(queryTexto.trim());
  }

  function resetar() {
    setMarcaSel(''); setModeloSel(''); setAnoSel('');
    setMarcaNome(''); setModeloNome(''); setAnoNome('');
    setQueryTexto(''); setResults([]); setSearched(false);
  }

  // Auto-buscar quando selecionar o ano (ou modelo se não tiver ano)
  useEffect(() => {
    if (marcaNome && modeloNome && anoNome) buscarPorFipe();
  }, [anoNome]);

  const selecoesTexto = [marcaNome, modeloNome, anoNome].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Car size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Busca por Veículo</h1>
            <p className="text-sm text-slate-500">Encontre peças compatíveis por modelo — dados da tabela FIPE</p>
          </div>
        </div>
        {searched && (
          <Button variant="ghost" size="sm" onClick={resetar}>
            <RotateCcw size={14} /> Nova busca
          </Button>
        )}
      </div>

      {/* Seleção FIPE guiada */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Busca guiada (FIPE)</h2>

        {/* Tipo de veículo */}
        <div className="flex gap-2">
          {([['carros', 'Carros'], ['motos', 'Motos'], ['caminhoes', 'Caminhões']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setTipoVeiculo(val)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                tipoVeiculo === val ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Selects em linha */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Marca</label>
            <select value={marcaSel} onChange={(e) => {
              setMarcaSel(e.target.value);
              setMarcaNome(e.target.options[e.target.selectedIndex]?.text || '');
            }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="">Selecione a marca...</option>
              {marcas.map((m) => <option key={m.codigo} value={m.codigo}>{m.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Modelo</label>
            <select value={modeloSel} disabled={!marcaSel} onChange={(e) => {
              setModeloSel(e.target.value);
              setModeloNome(e.target.options[e.target.selectedIndex]?.text || '');
            }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50">
              <option value="">Selecione o modelo...</option>
              {modelos.map((m) => <option key={m.codigo} value={String(m.codigo)}>{m.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Ano</label>
            <select value={anoSel} disabled={!modeloSel} onChange={(e) => {
              setAnoSel(e.target.value);
              setAnoNome(e.target.options[e.target.selectedIndex]?.text || '');
            }} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50">
              <option value="">Selecione o ano...</option>
              {anos.map((a) => <option key={a.codigo} value={a.codigo}>{a.nome}</option>)}
            </select>
          </div>
        </div>

        {selecoesTexto.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Selecionado:</span>
            <div className="flex items-center gap-1">
              {selecoesTexto.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{s}</span>
                  {i < selecoesTexto.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
                </span>
              ))}
            </div>
            {!anoSel && modeloSel && (
              <Button variant="secondary" size="sm" onClick={buscarPorFipe} className="ml-2">
                <Search size={12} /> Buscar
              </Button>
            )}
          </div>
        )}

        {loadingFipe && <p className="text-xs text-slate-400">Carregando dados FIPE...</p>}
      </div>

      {/* Busca por texto (fallback) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Busca por texto livre</h2>
        <div className="flex gap-3">
          <input
            value={queryTexto}
            onChange={(e) => setQueryTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscarPorTexto()}
            placeholder='Ex: "Gol G5 2010", "Civic 2018", "Palio 1.0"...'
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button onClick={buscarPorTexto} loading={loading} disabled={!queryTexto.trim()}>
            <Search size={16} /> Buscar
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Busca no campo "aplicações" dos produtos cadastrados. Todos os termos precisam corresponder.
        </p>
      </div>

      {/* Resultados */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          Buscando peças compatíveis...
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma peça encontrada para este veículo</p>
          <p className="text-sm text-slate-400 mt-1">
            Verifique se os produtos estão cadastrados com as aplicações corretas, ou tente termos mais genéricos.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {results.length} peça{results.length !== 1 ? 's' : ''} compatíve{results.length !== 1 ? 'is' : 'l'}
            </span>
            <span className="text-xs text-slate-400">
              Veículo: {selecoesTexto.join(' ') || queryTexto}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Código</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Nome</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Aplicações</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">Preço</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {p.codigo || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{p.nome}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.aplicacoes.map((ap, i) => (
                          <span key={i} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {ap}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap font-medium">
                      {formatBRL(p.preco)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-medium ${
                        Number(p.estoque) <= 0 ? 'text-red-500' :
                        Number(p.estoque) <= Number(p.estoque_minimo || 0) ? 'text-amber-500' : 'text-green-600'
                      }`}>
                        {Number(p.estoque).toFixed(0)} un
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
