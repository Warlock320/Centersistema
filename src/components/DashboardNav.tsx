'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, FileText, CheckSquare,
  ShoppingCart, FileInput, BarChart2, Settings, LogOut,
  Search, X, ChevronRight, Bell, Truck, Wallet,
  ArrowDownCircle, ArrowUpCircle, Landmark
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Usuario } from '@/types/database.types';
import { DEMO_MODE, DEMO_COOKIE } from '@/lib/demo';
import { can, resolveRoles, ROLE_LABELS, type Permission } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: Permission;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'GERAL',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view_dashboard' },
    ],
  },
  {
    label: 'CADASTROS',
    items: [
      { href: '/dashboard/clientes', label: 'Clientes', icon: Users, permission: 'view_clientes' },
      { href: '/dashboard/produtos', label: 'Produtos', icon: Package, permission: 'view_produtos' },
      { href: '/dashboard/fornecedores', label: 'Fornecedores', icon: Truck, permission: 'view_fornecedores' },
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      { href: '/dashboard/orcamentos', label: 'Orçamentos', icon: FileText, permission: 'view_orcamentos' },
      { href: '/dashboard/aprovacoes', label: 'Aprovações', icon: CheckSquare, permission: 'approve_orcamentos' },
      { href: '/dashboard/pedidos', label: 'Pedidos', icon: ShoppingCart, permission: 'view_pedidos' },
      { href: '/dashboard/nfe', label: 'Importar NF-e', icon: FileInput, permission: 'view_nfe' },
    ],
  },
  {
    label: 'FINANCEIRO',
    items: [
      { href: '/dashboard/financeiro', label: 'Visão Financeira', icon: Wallet, permission: 'view_financeiro' },
      { href: '/dashboard/financeiro/receber', label: 'Contas a Receber', icon: ArrowDownCircle, permission: 'view_financeiro' },
      { href: '/dashboard/financeiro/pagar', label: 'Contas a Pagar', icon: ArrowUpCircle, permission: 'view_financeiro' },
      { href: '/dashboard/financeiro/bancos', label: 'Contas Bancárias', icon: Landmark, permission: 'edit_financeiro' },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart2, permission: 'view_relatorios' },
      { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, permission: 'manage_config' },
    ],
  },
];

interface SearchResult {
  type: 'cliente' | 'produto';
  id: string;
  label: string;
  sublabel?: string;
}

export function DashboardNav({ usuario }: { usuario: Usuario | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const userRoles = resolveRoles(usuario || {});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertas, setAlertas] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAlertas = async () => {
      const { count } = await supabase
        .from('v_produtos_abaixo_minimo')
        .select('id', { count: 'exact', head: true });
      setAlertas(count || 0);
    };
    loadAlertas();
  }, []);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      const [clientes, produtos] = await Promise.all([
        supabase.from('clientes').select('id,nome,cpf_cnpj').ilike('nome', `%${searchQuery}%`).limit(5),
        supabase.from('produtos').select('id,nome,codigo').ilike('nome', `%${searchQuery}%`).limit(5),
      ]);

      const results: SearchResult[] = [
        ...(clientes.data || []).map((c) => ({
          type: 'cliente' as const,
          id: c.id,
          label: c.nome,
          sublabel: c.cpf_cnpj || 'Cliente',
        })),
        ...(produtos.data || []).map((p) => ({
          type: 'produto' as const,
          id: p.id,
          label: p.nome,
          sublabel: p.codigo ? `SKU: ${p.codigo}` : 'Produto',
        })),
      ];

      setSearchResults(results);
      setSearchOpen(results.length > 0);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    if (DEMO_MODE) {
      document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
      router.push('/login');
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleSearchSelect = (result: SearchResult) => {
    setSearchQuery('');
    setSearchOpen(false);
    if (result.type === 'cliente') {
      router.push('/dashboard/clientes');
    } else {
      router.push('/dashboard/produtos');
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-40">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Center Auto</p>
              <p className="text-slate-400 text-xs">Gestão de Peças</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {navSections.map((section) => {
            const sectionItems = section.items.filter((item) => can(userRoles, item.permission));
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.label}>
                <p className="px-3 mb-1 text-xs font-bold text-slate-600 tracking-widest">{section.label}</p>
                <div className="space-y-0.5">
                  {sectionItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        {item.label}
                        {item.href === '/dashboard/aprovacoes' && alertas > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {alertas > 9 ? '9+' : alertas}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
              {usuario?.nome?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{usuario?.nome || 'Usuário'}</p>
              <p className="text-slate-400 text-xs truncate">{userRoles.map((r) => ROLE_LABELS[r]).join(' · ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-100 z-30 flex items-center px-6 gap-4">
        {/* Global Search */}
        <div ref={searchRef} className="relative flex-1 max-w-lg">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar clientes e produtos... (3+ caracteres)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSearchSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${result.type === 'cliente' ? 'bg-blue-500' : 'bg-green-500'}`}>
                    {result.type === 'cliente' ? <Users size={12} /> : <Package size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{result.label}</p>
                    <p className="text-xs text-slate-400">{result.sublabel}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {DEMO_MODE && (
            <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
              DEMO
            </span>
          )}
          {alertas > 0 && (
            <Link
              href="/dashboard"
              className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Alertas de estoque"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {alertas > 9 ? '9+' : alertas}
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
}
