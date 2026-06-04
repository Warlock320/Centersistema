// Login pode ser um nome simples (ex: "jean") em vez de e-mail.
// O Supabase Auth exige um e-mail por baixo, então sintetizamos um
// e-mail interno a partir do login. Quem usa e-mail real continua igual.
export const LOGIN_DOMAIN = 'centersistema.app';

export function loginToEmail(input: string): string {
  const v = (input || '').trim();
  if (!v) return v;
  if (v.includes('@')) return v.toLowerCase();
  return `${v.toLowerCase().replace(/\s+/g, '')}@${LOGIN_DOMAIN}`;
}
