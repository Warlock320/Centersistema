import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = Number(searchParams.get('size')) || 192;

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await admin.from('empresas').select('logo_url').limit(1).single();
    const logoUrl = (data as { logo_url: string | null } | null)?.logo_url;

    if (logoUrl) {
      const imgRes = await fetch(logoUrl);
      if (imgRes.ok) {
        const blob = await imgRes.blob();
        return new NextResponse(blob.stream() as unknown as ReadableStream, {
          headers: {
            'Content-Type': imgRes.headers.get('content-type') || 'image/png',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
  } catch {}

  // Fallback: SVG genérico azul
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#2563eb"/>
    <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial,sans-serif" font-weight="bold" font-size="${size * 0.4}">ERP</text>
  </svg>`;

  return new NextResponse(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
  });
}
