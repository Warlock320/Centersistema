'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = pageSize ? (page - 1) * pageSize + 1 : 0;
  const end = pageSize && totalItems ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <div className="text-xs text-slate-400">
        {totalItems && pageSize ? `${start}–${end} de ${totalItems}` : `Página ${page} de ${totalPages}`}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p: number;
          if (totalPages <= 7) { p = i + 1; }
          else if (page <= 4) { p = i + 1; }
          else if (page >= totalPages - 3) { p = totalPages - 6 + i; }
          else { p = page - 3 + i; }
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={`min-w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                p === page ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>{p}</button>
          );
        })}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[], pageSize = 20) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  return {
    totalPages,
    totalItems: items.length,
    pageSize,
    getPage: (page: number) => items.slice((page - 1) * pageSize, page * pageSize),
  };
}
