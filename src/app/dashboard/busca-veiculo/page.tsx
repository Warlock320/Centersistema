'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Car, Search, Package } from 'lucide-react';
import type { Produto } from '@/types/database.types';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BuscaVeiculoPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const supabase = createClient();

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setSearched(true);

    // Busca produtos cujo campo aplicacoes (text[]) contenha termos do veículo.
    // Supabase não suporta ilike em arrays diretamente, então buscamos todos ativos
    // e filtramos client-side para flexibilidade (case-insensitive, parcial).
    // Para bases grandes, uma RPC seria melhor, mas para o volume típico de autopeças isso funciona bem.
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, nome, aplicacoes, preco, estoque, ativo')
      .eq('ativo', true)
      .order('nome');

    const termos = trimmed.toLowerCase().split(/\s+/);

    const filtered = (data || []).filter((p) => {
      if (!p.aplicacoes || p.aplicacoes.length === 0) return false;
      // Cada termo precisa casar com pelo menos uma entrada de aplicacoes
      return termos.every((termo) =>
        p.aplicacoes.some((ap: string) => ap.toLowerCase().includes(termo))
      );
    });

    setResults(filtered as Produto[]);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Car size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Busca por Veículo</h1>
          <p className="text-sm text-slate-500">Encontre peças compatíveis por modelo de veículo</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder='Ex: "Gol G5 2010", "Civic 2018", "Palio 1.0"...'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button onClick={handleSearch} loading={loading} className="shrink-0">
            <Search size={16} />
            Buscar
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Digite o modelo, marca ou ano do veículo. Todos os termos precisam corresponder.
        </p>
      </div>

      {/* Results */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center gap-2 text-slate-400">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Buscando...
          </div>
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum produto encontrado</p>
          <p className="text-sm text-slate-400 mt-1">
            Tente usar termos diferentes ou mais genéricos, como apenas o modelo ou marca.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {results.length} produto{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
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
                      {p.codigo || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {p.nome}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.aplicacoes.map((ap, i) => (
                          <span
                            key={i}
                            className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                          >
                            {ap}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                      {formatBRL(p.preco)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-medium ${p.estoque <= 0 ? 'text-red-500' : p.estoque <= (p.estoque_minimo || 0) ? 'text-amber-500' : 'text-green-600'}`}>
                        {p.estoque}
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
