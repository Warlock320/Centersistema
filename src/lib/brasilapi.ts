// Integração com a BrasilAPI para consulta de CNPJ.
// Docs: https://brasilapi.com.br/docs#tag/CNPJ
// A BrasilAPI é pública (sem chave) e libera CORS, então pode ser chamada do client.

export interface DadosCNPJ {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  enderecoCompleto: string;
  situacao: string;
}

/** Remove tudo que não é dígito. */
export function somenteDigitos(v: string): string {
  return (v || '').replace(/\D/g, '');
}

/** True se a string (limpa) tem 14 dígitos (CNPJ). */
export function isCNPJ(v: string): boolean {
  return somenteDigitos(v).length === 14;
}

/** True se a string (limpa) tem 11 dígitos (CPF). */
export function isCPF(v: string): boolean {
  return somenteDigitos(v).length === 11;
}

/** Formata CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(v: string): string {
  const d = somenteDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Formata CPF: 000.000.000-00 */
export function formatCPF(v: string): string {
  const d = somenteDigitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Formata CPF ou CNPJ conforme o tamanho. */
export function formatCpfCnpj(v: string): string {
  return somenteDigitos(v).length > 11 ? formatCNPJ(v) : formatCPF(v);
}

/** Consulta um CNPJ na BrasilAPI e retorna os dados normalizados. */
export async function buscarCNPJ(cnpj: string): Promise<DadosCNPJ> {
  const clean = somenteDigitos(cnpj);
  if (clean.length !== 14) throw new Error('CNPJ deve ter 14 dígitos');

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'CNPJ não encontrado na Receita.' : 'Erro ao consultar o CNPJ.');
  }
  const d = await res.json();

  const enderecoCompleto = [d.logradouro, d.numero, d.bairro]
    .filter(Boolean)
    .join(', ');

  return {
    cnpj: clean,
    razaoSocial: d.razao_social || '',
    nomeFantasia: d.nome_fantasia || d.razao_social || '',
    email: d.email || '',
    telefone: d.ddd_telefone_1 ? formatTelefone(d.ddd_telefone_1) : '',
    logradouro: d.logradouro || '',
    numero: d.numero || '',
    bairro: d.bairro || '',
    municipio: d.municipio || '',
    uf: d.uf || '',
    cep: d.cep ? formatCEP(d.cep) : '',
    enderecoCompleto,
    situacao: d.descricao_situacao_cadastral || '',
  };
}

function formatCEP(v: string): string {
  const d = somenteDigitos(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatTelefone(v: string): string {
  const d = somenteDigitos(v);
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v;
}
