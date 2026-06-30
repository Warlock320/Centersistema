import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE } from '@/lib/demo';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // No demo mode, a proteção é baseada no cookie demo_session
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const hasDemo = request.cookies.get(DEMO_COOKIE)?.value === '1';
    if (!hasDemo && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (hasDemo && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isDashboard = pathname.startsWith('/dashboard');

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Exclui: assets estáticos, API pública, vitrine pública (/loja/*), ícone dinâmico, branding
  matcher: ['/((?!_next/static|_next/image|favicon.ico|loja|api/icon|api/branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
