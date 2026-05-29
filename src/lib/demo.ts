import type { Usuario } from '@/types/database.types';

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const DEMO_COOKIE = 'demo_session';

export const DEMO_USER: Usuario = {
  id: 'demo-user-id',
  empresa_id: 'demo-empresa-id',
  nome: 'Admin Demo',
  email: 'admin@demo.com',
  roles: ['admin'],
  ativo: true,
  created_at: new Date().toISOString(),
};

// Fluent query builder mock — suporta todo o padrão Supabase
function createBuilder(returnData: unknown = [], count: number | null = null): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  const resolved = { data: returnData, error: null, count };

  const chains = [
    'select', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike',
    'in', 'is', 'not', 'or', 'and', 'filter', 'order', 'limit', 'range',
    'head', 'match', 'contains', 'containedBy', 'overlaps', 'textSearch',
    'insert', 'update', 'upsert', 'delete', 'returning',
  ];

  chains.forEach((m) => { self[m] = () => self; });

  self.single = () => Promise.resolve({
    data: Array.isArray(returnData) ? (returnData[0] ?? null) : returnData,
    error: null,
  });
  self.maybeSingle = () => Promise.resolve({ data: null, error: null });
  self.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(res, rej);
  self.catch = (rej: (e: unknown) => unknown) => Promise.resolve(resolved).catch(rej);
  self.finally = (fn: () => void) => Promise.resolve(resolved).finally(fn);

  return self;
}

// Mock completo do cliente Supabase
export function createMockClient() {
  return {
    from: (_table: string) => createBuilder(),

    rpc: (_fn: string, _args?: unknown) => Promise.resolve({ data: null, error: null }),

    auth: {
      getUser: () => Promise.resolve({
        data: { user: { id: DEMO_USER.id, email: DEMO_USER.email } },
        error: null,
      }),
      getSession: () => Promise.resolve({
        data: { session: { user: { id: DEMO_USER.id } } },
        error: null,
      }),
      signInWithPassword: (_c: unknown) => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: (_cb: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },

    channel: (_name: string) => ({
      on: (_event: string, _filter: unknown, _cb: unknown) => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: () => {},
  };
}
