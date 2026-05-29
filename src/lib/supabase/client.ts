import { createBrowserClient } from '@supabase/ssr';
import { DEMO_MODE, createMockClient } from '@/lib/demo';

export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (DEMO_MODE) return createMockClient() as unknown as ReturnType<typeof createBrowserClient>;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
