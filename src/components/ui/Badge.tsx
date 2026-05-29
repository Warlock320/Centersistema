import type { OrcamentoStatus, PedidoStatus } from '@/types/database.types';

const orcamentoColors: Record<OrcamentoStatus, string> = {
  criado: 'bg-slate-100 text-slate-700',
  orcamento_enviado: 'bg-blue-100 text-blue-700',
  aguardando_aprovacao: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-green-100 text-green-700',
  aguardando_pecas: 'bg-orange-100 text-orange-700',
  enviado: 'bg-teal-100 text-teal-700',
  cancelado: 'bg-red-100 text-red-700',
};

const orcamentoLabels: Record<OrcamentoStatus, string> = {
  criado: 'Criado',
  orcamento_enviado: 'Enviado',
  aguardando_aprovacao: 'Ag. Aprovação',
  aprovado: 'Aprovado',
  aguardando_pecas: 'Ag. Peças',
  enviado: 'Enviado',
  cancelado: 'Cancelado',
};

const pedidoColors: Record<PedidoStatus, string> = {
  aberto: 'bg-blue-100 text-blue-700',
  em_andamento: 'bg-yellow-100 text-yellow-700',
  faturado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
};

const pedidoLabels: Record<PedidoStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
};

interface Props {
  type: 'orcamento' | 'pedido' | 'role' | 'generic';
  value: string;
  label?: string;
}

export function Badge({ type, value, label }: Props) {
  let className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  let text = label || value;

  if (type === 'orcamento') {
    className += ' ' + (orcamentoColors[value as OrcamentoStatus] || 'bg-slate-100 text-slate-700');
    text = orcamentoLabels[value as OrcamentoStatus] || value;
  } else if (type === 'pedido') {
    className += ' ' + (pedidoColors[value as PedidoStatus] || 'bg-slate-100 text-slate-700');
    text = pedidoLabels[value as PedidoStatus] || value;
  } else if (type === 'role') {
    const roleColors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-700',
      gestor: 'bg-blue-100 text-blue-700',
      financeiro: 'bg-emerald-100 text-emerald-700',
      vendedor: 'bg-amber-100 text-amber-700',
    };
    className += ' ' + (roleColors[value] || 'bg-slate-100 text-slate-700');
    text = value.charAt(0).toUpperCase() + value.slice(1);
  } else {
    className += ' bg-slate-100 text-slate-700';
  }

  return <span className={className}>{text}</span>;
}
