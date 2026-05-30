'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import type { PlanoContas } from '@/types/database.types';

export default function CategoriasFinanceirasPage() {
  const [categorias, setCategorias] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaReceita, setNovaReceita] = useState('');
  const [novaDespesa, setNovaDespesa] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('plano_contas').select('*').eq('ativo', true).order('codigo');
    setCategorias(data as PlanoContas[] || []);
    setLoading(false);
  }

  async function addCategoria(tipo: 'receita' | 'despesa', nome: string) {
    if (!nome.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const empresaId = (usr as { empresa_id: string })!.empresa_id;
    // Gera próximo código (R/D + sequencial)
    const prefix = tipo === 'receita' ? 'R' : 'D';
    const existentes = categorias.filter((c) => c.tipo === tipo).length;
    const codigo = `${prefix}${String(existentes + 1).padStart(2, '0')}${Date.now().toString().slice(-3)}`;
    await supabase.from('plano_contas').insert({ empresa_id: empresaId, codigo, nome: nome.trim(), tipo });
    setNovaReceita(''); setNovaDespesa('');
    setSaving(false);
    fetchData();
  }

  async function removeCategoria(id: string) {
    await supabase.from('plano_contas').update({ ativo: false }).eq('id', id);
    fetchData();
  }

  const receitas = categorias.filter((c) => c.tipo === 'receita');
  const despesas = categorias.filter((c) => c.tipo === 'despesa');

  function Coluna({ tipo, lista, valor, setValor, cor, Icon }: {
    tipo: 'receita' | 'despesa'; lista: PlanoContas[]; valor: string;
    setValor: (v: string) => void; cor: string; Icon: React.ElementType;
  }) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Icon size={18} className={cor} />
          <h2 className="font-semibold text-slate-900">{tipo === 'receita' ? 'Receitas' : 'Despesas'} ({lista.length})</h2>
        </div>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); addCategoria(tipo, valor); }} className="px-6 py-4 flex gap-2 border-b border-slate-50">
          <input value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder={`Nova categoria de ${tipo}...`}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <Button type="submit" size="sm" loading={saving}><Plus size={14} /> Add</Button>
        </form>
        <div className="divide-y divide-slate-50">
          {lista.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">Nenhuma categoria</p>
          ) : lista.map((c) => (
            <div key={c.id} className="px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-800">{c.nome}</span>
              <button onClick={() => removeCategoria(c.id)}
                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categorias Financeiras</h1>
        <p className="text-slate-500 text-sm">Organize receitas e despesas para classificar os lançamentos</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Coluna tipo="receita" lista={receitas} valor={novaReceita} setValor={setNovaReceita} cor="text-green-500" Icon={TrendingUp} />
          <Coluna tipo="despesa" lista={despesas} valor={novaDespesa} setValor={setNovaDespesa} cor="text-red-500" Icon={TrendingDown} />
        </div>
      )}
    </div>
  );
}
