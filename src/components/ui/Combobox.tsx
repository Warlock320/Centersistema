'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Search } from 'lucide-react';
import { matchBusca } from '@/lib/busca';

export interface ComboOption { value: string; label: string; sublabel?: string; keywords?: string }

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  /** Texto do botão de criação no rodapé (ex: "Cadastrar fornecedor"). */
  createLabel?: string;
  /** Chamado ao clicar em criar; recebe o texto digitado. */
  onCreate?: (typed: string) => void;
}

export function Combobox({ label, value, onChange, options, placeholder, createLabel, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Busca multi-termo + sem acento (em label + sublabel + keywords)
  const filtered = query.trim()
    ? options.filter((o) => matchBusca(`${o.label} ${o.sublabel || ''} ${o.keywords || ''}`, query))
    : options;

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        {/* Campo */}
        <div
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm cursor-text focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
        >
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={open ? query : (selected?.label || '')}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected ? selected.label : (placeholder || 'Selecione ou digite...')}
            className="flex-1 outline-none bg-transparent text-slate-900 placeholder:text-slate-400 min-w-0"
          />
          <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {value && (
              <button type="button" onClick={() => select('')}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-50">
                Limpar seleção
              </button>
            )}
            {filtered.length === 0 && !onCreate && (
              <p className="px-3 py-3 text-sm text-slate-400">Nenhum resultado</p>
            )}
            {filtered.map((o) => (
              <button key={o.value} type="button" onClick={() => select(o.value)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="text-slate-800 block truncate">{o.label}</span>
                  {o.sublabel && <span className="text-xs text-slate-400">{o.sublabel}</span>}
                </span>
                {o.value === value && <Check size={14} className="text-blue-600 shrink-0" />}
              </button>
            ))}
            {onCreate && (
              <button type="button"
                onClick={() => { onCreate(query); setOpen(false); setQuery(''); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100 font-medium sticky bottom-0 bg-white">
                <Plus size={14} />
                {query ? `Criar "${query}"` : (createLabel || 'Cadastrar novo')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
