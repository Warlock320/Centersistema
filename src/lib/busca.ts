// Busca inteligente reutilizável (multi-termo + sem acento).
// Usada no Combobox e no balcão para padronizar a pesquisa em todo o sistema.

/** minúsculas + remove acentos (oleo acha "Óleo", ignicao acha "Ignição"). */
export function normalizar(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Verdadeiro se TODOS os termos da busca aparecem no texto (ex.: "gol amortece"). */
export function matchBusca(texto: string, query: string): boolean {
  const termos = normalizar(query).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = normalizar(texto);
  return termos.every((t) => alvo.includes(t));
}
