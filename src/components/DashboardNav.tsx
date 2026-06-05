'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, FileText, CheckSquare,
  ShoppingCart, FileInput, BarChart2, Settings, LogOut,
  Search, X, ChevronRight, ChevronDown, Bell, Truck, Wallet,
  ArrowDownCircle, ArrowUpCircle, Landmark, Building2, Tags, Warehouse, Bike, Wrench, Scale, CreditCard,
  FileBarChart, ShieldAlert, Menu, Store
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Usuario } from '@/types/database.types';
import { DEMO_MODE, DEMO_COOKIE } from '@/lib/demo';
import { resolveRoles, ROLE_LABELS, type Permission } from '@/lib/permissions';
import { usePermissions } from '@/components/PermissionsProvider';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: Permission | Permission[];
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
      { href: '/dashboard/estoque', label: 'Estoque', icon: Warehouse, permission: 'view_estoque' },
      { href: '/dashboard/fornecedores', label: 'Fornecedores', icon: Truck, permission: 'view_fornecedores' },
      { href: '/dashboard/veiculos', label: 'Veículos', icon: Bike, permission: 'view_veiculos' },
      { href: '/dashboard/empresas', label: 'Empresas (CNPJs)', icon: Building2, permission: 'manage_config' },
    ],
  },
  {
    label: 'COMERCIAL',
    items: [
      { href: '/dashboard/balcao', label: 'Balcão', icon: Store, permission: 'operar_balcao' },
      { href: '/dashboard/orcamentos', label: 'Orçamentos', icon: FileText, permission: 'view_orcamentos' },
      { href: '/dashboard/aprovacoes', label: 'Aprovações', icon: CheckSquare, permission: 'approve_orcamentos' },
      { href: '/dashboard/pedidos', label: 'Pedidos', icon: ShoppingCart, permission: 'view_pedidos' },
      { href: '/dashboard/os', label: 'Ordens de Serviço', icon: Wrench, permission: 'view_os' },
      { href: '/dashboard/nfe', label: 'Importar NF-e', icon: FileInput, permission: 'view_nfe' },
    ],
  },
  {
    label: 'CREDIÁRIO',
    items: [
      { href: '/dashboard/crediario', label: 'Crediário', icon: CreditCard, permission: ['view_financeiro', 'gerir_crediario'] },
    ],
  },
  {
    label: 'FINANCEIRO',
    items: [
      { href: '/dashboard/financeiro', label: 'Visão Financeira', icon: Wallet, permission: 'view_financeiro' },
      { href: '/dashboard/financeiro/receber', label: 'Contas a Receber', icon: ArrowDownCircle, permission: ['view_financeiro', 'registrar_venda'] },
      { href: '/dashboard/financeiro/pagar', label: 'Contas a Pagar', icon: ArrowUpCircle, permission: 'view_financeiro' },
      { href: '/dashboard/financeiro/caixa', label: 'Caixa', icon: Wallet, permission: 'operar_caixa' },
      { href: '/dashboard/financeiro/caixa/relatorios', label: 'Relatórios de Caixa', icon: FileBarChart, permission: ['view_financeiro', 'gerir_caixa'] },
      { href: '/dashboard/financeiro/bancos', label: 'Contas Bancárias', icon: Landmark, permission: 'edit_financeiro' },
      { href: '/dashboard/financeiro/conciliacao', label: 'Conciliação', icon: Scale, permission: 'edit_financeiro' },
      { href: '/dashboard/financeiro/categorias', label: 'Categorias', icon: Tags, permission: 'edit_financeiro' },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart2, permission: 'view_relatorios' },
      { href: '/dashboard/auditoria', label: 'Auditoria', icon: ShieldAlert, permission: 'view_auditoria' },
      { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, permission: 'manage_config' },
    ],
  },
];

// Relógio ao vivo (data + hora atual). Atualiza a cada segundo no cliente.
function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null; // evita mismatch de hidratação (hora só no cliente)
  return (
    <div className="hidden sm:flex flex-col items-end leading-tight">
      <span className="text-sm font-semibold text-slate-700 tabular-nums">{now.toLocaleTimeString('pt-BR')}</span>
      <span className="text-[11px] text-slate-400 capitalize">{now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
    </div>
  );
}

interface SearchResult {
  type: 'cliente' | 'produto';
  id: string;
  label: string;
  sublabel?: string;
}

export function DashboardNav({ usuario, collapsed = false }: { usuario: Usuario | null; collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const userRoles = resolveRoles(usuario || {});

  // Item ativo = rota mais específica (href mais longo) que casa com o pathname.
  // Evita que /dashboard/financeiro fique ativo nas sub-rotas /dashboard/financeiro/*.
  const activeHref = navSections
    .flatMap((s) => s.items)
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const { can } = usePermissions();

  // Seção (accordion) que contém a rota ativa
  const activeSection = navSections.find((s) => s.items.some((it) => it.href === activeHref))?.label;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertas, setAlertas] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer no mobile
  // Accordion: começa com a seção ativa aberta (determinístico → sem mismatch de hidratação)
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(activeSection ? [activeSection] : []));
  const searchRef = useRef<HTMLDivElement>(null);

  const toggleSection = (label: string) => setOpenSections((prev) => {
    const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n;
  });

  // Fecha o menu mobile ao trocar de rota
  useEffect(() => { setSidebarOpen(false); }, [pathname]);
  // Garante que a seção da rota atual fique aberta ao navegar
  useEffect(() => { if (activeSection) setOpenSections((prev) => new Set(prev).add(activeSection)); }, [activeSection]);

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
      {/* Overlay do drawer (só mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — drawer no mobile, fixa no desktop (recolhível) */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-50 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:-translate-x-full' : 'md:translate-x-0'}`}>
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <Logo size={40} className="ring-2 ring-white/10" />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Center Auto</p>
              <p className="text-slate-400 text-xs">Gestão de Peças</p>
            </div>
            {/* Alternar modo claro/escuro */}
            <ThemeToggle className="ml-auto -mr-1" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4 no-scrollbar">
          {navSections.map((section) => {
            const sectionItems = section.items.filter((item) =>
              Array.isArray(item.permission) ? item.permission.some((p) => can(p)) : can(item.permission)
            );
            if (sectionItems.length === 0) return null;
            const aberta = openSections.has(section.label);
            return (
              <div key={section.label}>
                <button type="button" onClick={() => toggleSection(section.label)}
                  className="w-full px-3 mb-1 flex items-center justify-between text-xs font-bold text-slate-600 tracking-widest hover:text-slate-300 transition-colors">
                  <span>{section.label}</span>
                  <ChevronDown size={13} className={`transition-transform ${aberta ? '' : '-rotate-90'}`} />
                </button>
                <div className={`space-y-0.5 ${aberta ? '' : 'hidden'}`}>
                  {sectionItems.map((item) => {
                    const isActive = item.href === activeHref;
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
      <header className={`fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 z-30 flex items-center px-4 md:px-6 gap-3 md:gap-4 transition-all duration-200 ${collapsed ? 'md:left-0' : 'md:left-64'}`}>
        {/* Hambúrguer (só mobile) */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>

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

        <div className="flex items-center gap-4 ml-auto">
          <HeaderClock />
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
    </>
  );
}
